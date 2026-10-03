import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, parseBody, err } from '@/lib/api';
import { buildChatbotSystemPrompt } from '@/lib/chatKb';
import { prisma } from '@/lib/db';

const Body = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(4000),
      })
    )
    .min(1)
    .max(20),
});

/**
 * Preferred model + fallback ladder. If gemini-3.6-flash is overloaded
 * (503) or missing, we walk down the list before giving up. Each entry
 * is tried once with a short backoff.
 */
const GEMINI_MODELS = ['gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-2.0-flash'];

/** Sleep helper for the retry backoff. */
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * POST /api/chat
 *   Google Gemini-backed chat with a scoped system prompt.
 *   Requires GEMINI_API_KEY. Rate-limited via requireAuth's built-in cap.
 *
 *   Resilience: transient 429/503 upstream errors trigger a single
 *   retry with 800ms backoff, then a fallback to the next model in
 *   GEMINI_MODELS. Only 5xx-family upstream failures surface to the
 *   caller — everything else returns a friendly reply.
 */
export async function POST(req: Request) {
  const [, error] = await requireAuth(req, {
    rateLimit: { max: 20, windowMs: 60_000 },
  });
  if (error) return error;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: 'NOT_CONFIGURED',
        message:
          "Chat isn't configured on this deployment yet. Ask your Super Admin to add GEMINI_API_KEY.",
      },
      { status: 501 }
    );
  }

  const [input, badReq] = await parseBody(req, Body);
  if (badReq) return badReq;

  // Pull the live office window + leave defaults so Tracy's answers reflect
  // the current Admin → Settings values rather than a hardcoded 9-to-5. If
  // the lookup fails we silently fall through to the static defaults in
  // buildChatbotSystemPrompt().
  const settings = await prisma.systemSettings
    .findUnique({ where: { id: 'singleton' } })
    .catch(() => null);
  const systemPrompt = buildChatbotSystemPrompt({
    workStartTime: settings?.workStartTime ?? '09:00',
    workEndTime: settings?.workEndTime ?? '17:00',
    standardHoursPerDay: settings?.standardHoursPerDay ?? 8,
  });

  try {
    const requestBody = JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: input.messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      generationConfig: {
        maxOutputTokens: 800,
        temperature: 0.4,
      },
    });

    let res: Response | null = null;
    let lastStatus = 0;
    let lastBody = '';

    outer: for (const model of GEMINI_MODELS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      // Try up to twice: once, then once more after 800ms backoff.
      for (let attempt = 0; attempt < 2; attempt++) {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: requestBody,
        });
        if (r.ok) { res = r; break outer; }
        lastStatus = r.status;
        lastBody = await r.text();
        // Retry / fallback only on transient overload; permanent errors
        // (4xx except 429) bail immediately.
        if (r.status !== 429 && r.status !== 503) break;
        if (attempt === 0) await sleep(800);
      }
    }

    if (!res) {
      console.error('[chat] gemini upstream exhausted', lastStatus, lastBody);
      // Overload / rate limit -> friendlier message. Everything else -> generic.
      const friendly =
        lastStatus === 429 || lastStatus === 503
          ? "The assistant is a bit busy right now. Give it a few seconds and try again."
          : 'The assistant is temporarily unavailable.';
      return err(502, 'UPSTREAM', friendly);
    }

    const data = (await res.json()) as {
      candidates?: {
        content?: { parts?: { text?: string }[] };
        finishReason?: string;
      }[];
      promptFeedback?: { blockReason?: string };
    };

    if (data.promptFeedback?.blockReason) {
      return NextResponse.json({
        reply:
          "I couldn't respond to that - the request was filtered by safety rules. Try rephrasing?",
      });
    }

    const text =
      data.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? '')
        .join('')
        .trim() ?? '';

    return NextResponse.json({ reply: text || '…' });
  } catch (e) {
    console.error('[chat] unexpected error', e);
    return err(500, 'INTERNAL', 'The assistant hit an internal error.');
  }
}
