'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Web Speech API wrapper for one-shot voice-to-text commands.
 *
 * - `supported`  : true if `SpeechRecognition` or `webkitSpeechRecognition`
 *                  is available on `window`. Chrome / Edge / Safari expose
 *                  it; Firefox does not (as of 2026).
 * - `listening`  : true while the browser's recorder is open.
 * - `error`      : last non-recoverable error from the recognizer.
 * - `start(onFinalTranscript)` : opens the mic and calls the callback with
 *   the final transcript once the user stops speaking (or `stop()` is
 *   called). Interim results are NOT exposed - the caller only ever sees
 *   the final text so there's no "live transcription" rendered anywhere.
 * - `stop()`     : stop recording manually. The current partial transcript
 *   (if any) is still delivered via the onFinalTranscript callback.
 */

// Minimal subset of the Web Speech API shape we actually touch.
type SpeechRecognitionResult = { 0: { transcript: string }; isFinal: boolean };
type SpeechRecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResult>;
};
type SpeechRecognitionErrorEvent = { error: string };

interface MinimalSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionCtor = new () => MinimalSpeechRecognition;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface UseVoiceInput {
  supported: boolean;
  listening: boolean;
  error: string | null;
  start: (onFinalTranscript: (text: string) => void) => void;
  stop: () => void;
}

export function useVoiceInput(options?: { lang?: string }): UseVoiceInput {
  const lang = options?.lang ?? 'en-US';
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<MinimalSpeechRecognition | null>(null);
  const transcriptRef = useRef<string>('');
  const callbackRef = useRef<((text: string) => void) | null>(null);

  useEffect(() => {
    setSupported(getRecognitionCtor() !== null);
  }, []);

  // Clean up any in-flight recognition if the component unmounts mid-session.
  useEffect(() => {
    return () => {
      if (recRef.current) {
        try { recRef.current.abort(); } catch { /* ignore */ }
        recRef.current = null;
      }
    };
  }, []);

  const start = useCallback((onFinal: (text: string) => void) => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError('Voice input is not supported in this browser.');
      return;
    }
    // Belt-and-braces: if a previous session is still open, abort it first.
    if (recRef.current) {
      try { recRef.current.abort(); } catch { /* ignore */ }
      recRef.current = null;
    }
    const rec = new Ctor();
    rec.continuous = false;
    // Interim results are collected but NEVER shown to the user - we just
    // need them so the final transcript is complete even if the user
    // stops the recording manually.
    rec.interimResults = true;
    rec.lang = lang;

    transcriptRef.current = '';
    callbackRef.current = onFinal;
    setError(null);

    rec.onresult = (e) => {
      let finalText = '';
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      // Running concatenation - final text is appended, interim text replaces.
      if (finalText) transcriptRef.current += finalText;
      // Interim is intentionally dropped from the stored value so a manual
      // stop still delivers only the stable, final-only portion.
      void interimText;
    };

    rec.onerror = (e) => {
      // "no-speech" and "aborted" are normal end-of-session signals; don't surface.
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setError('Microphone permission denied.');
      } else {
        setError(`Voice input error: ${e.error}`);
      }
    };

    rec.onend = () => {
      setListening(false);
      recRef.current = null;
      const text = transcriptRef.current.trim();
      if (text && callbackRef.current) callbackRef.current(text);
      transcriptRef.current = '';
      callbackRef.current = null;
    };

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch (e) {
      // Chrome throws if start() is called twice in a row.
      setError(e instanceof Error ? e.message : 'Could not start voice input.');
      setListening(false);
      recRef.current = null;
    }
  }, [lang]);

  const stop = useCallback(() => {
    if (recRef.current) {
      try { recRef.current.stop(); } catch { /* onend will clean up */ }
    }
  }, []);

  return { supported, listening, error, start, stop };
}
