/**
 * Reassigns employeeIdCode on existing users to the canonical Trace roster.
 *
 *   npx tsx --env-file=.env.local scripts/update-trace-ids.ts           (dry-run)
 *   npx tsx --env-file=.env.local scripts/update-trace-ids.ts --apply   (writes)
 *
 * Matching is case-insensitive on fullName. Missing users are reported as
 * SKIP; nothing is created here. The two-step assign (null everyone we
 * touch, then write the new codes) avoids the @unique(employeeIdCode)
 * constraint tripping on swaps.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface Assignment {
  fullName: string;
  traceId: string;
}

const ROSTER: Assignment[] = [
  { fullName: 'Fuad M Khalid Hossen',              traceId: 'TRACE-0001' },
  { fullName: 'Mohammed Mahraj-ul-Alam Samrat',    traceId: 'TRACE-0002' },
  { fullName: 'Abu Saleh Muhammad Saifullah',      traceId: 'TRACE-0003' },
  { fullName: 'Nabeel Khan',                       traceId: 'TRACE-0004' },
  { fullName: 'Mimma Afrin',                       traceId: 'TRACE-0005' },
  { fullName: 'Tahsina Shiva',                     traceId: 'TRACE-0006' },
  { fullName: 'Recardo Saurav Antor Halder',       traceId: 'TRACE-0007' },
  { fullName: 'Rubayat E Shams Anik',              traceId: 'TRACE-0008' },
  { fullName: 'Ahmed Julker Nine',                 traceId: 'TRACE-0009' },
  { fullName: 'Mahanaz Akter Lopa',                traceId: 'TRACE-0010' },
  { fullName: 'Fahmida Akter',                     traceId: 'TRACE-0011' },
  { fullName: 'Shefayat E Shams',                  traceId: 'TRACE-0012' },
  { fullName: 'Md. Muftehedul Islam Mithul',       traceId: 'TRACE-0013' },
  { fullName: 'Naved Afnan',                       traceId: 'TRACE-0014' },
  { fullName: 'Riya Biswas',                       traceId: 'TRACE-0015' },
  { fullName: 'Md Mahamudul Hasan',                traceId: 'TRACE-0016' },
];

async function main() {
  const apply = process.argv.includes('--apply');
  console.log(apply ? '=== APPLYING ===' : '=== DRY-RUN (add --apply to write) ===');

  const resolved: Array<{ userId: string; fullName: string; current: string | null; traceId: string }> = [];
  const missing: string[] = [];

  for (const row of ROSTER) {
    const user = await prisma.user.findFirst({
      where: { fullName: { equals: row.fullName, mode: 'insensitive' } },
      select: { id: true, fullName: true, employeeIdCode: true },
    });
    if (!user) {
      missing.push(row.fullName);
      console.log(`  SKIP   | ${row.fullName.padEnd(38)} | not found in DB`);
      continue;
    }
    resolved.push({
      userId: user.id,
      fullName: user.fullName,
      current: user.employeeIdCode,
      traceId: row.traceId,
    });
    const cur = user.employeeIdCode ?? '-';
    console.log(`  ${apply ? 'UPDATE' : 'DRYRUN'} | ${user.fullName.padEnd(38)} | ${cur.padEnd(12)} -> ${row.traceId}`);
  }

  console.log(`\nMatched ${resolved.length} of ${ROSTER.length}; missing: ${missing.length}`);
  if (!apply) {
    console.log('\nRun again with --apply to write.');
    return;
  }

  // Two-step assignment inside a single transaction so no unique-constraint
  // conflict can occur when swapping codes between existing users.
  await prisma.$transaction(async (tx) => {
    // Step 1: null out the employeeIdCode on every user we're about to touch.
    for (const r of resolved) {
      await tx.user.update({
        where: { id: r.userId },
        data: { employeeIdCode: null },
      });
    }
    // Step 2: assign the new codes.
    for (const r of resolved) {
      await tx.user.update({
        where: { id: r.userId },
        data: { employeeIdCode: r.traceId },
      });
    }
  });

  console.log(`\nDone. ${resolved.length} user${resolved.length === 1 ? '' : 's'} updated.`);
  if (missing.length > 0) {
    console.log(`Still missing (create manually or re-run after they exist):\n  - ${missing.join('\n  - ')}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
