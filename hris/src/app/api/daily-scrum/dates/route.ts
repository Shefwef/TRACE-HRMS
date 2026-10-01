import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/api';

export async function GET(req: Request) {
  const [, error] = await requireAuth(req);
  if (error) return error;

  // Everyone sees all available dates — view access is unrestricted.
  const entries = await prisma.dailyScrumEntry.findMany({
    where: {},
    select: { date: true },
    distinct: ['date'],
    orderBy: { date: 'desc' },
  });

  const dates = entries.map((e) => e.date.toISOString().slice(0, 10));
  return NextResponse.json({ dates });
}
