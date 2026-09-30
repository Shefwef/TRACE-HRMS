/**
 * Reassigns employeeIdCode on the 16-person Trace roster + creates any
 * missing user rows so the whole roster resolves. Sets line manager
 * mapping for the four new hires (users 1-12 keep whatever LM they
 * already have in the DB).
 *
 *   npx tsx --env-file=.env.local scripts/update-trace-ids.ts           (dry-run)
 *   npx tsx --env-file=.env.local scripts/update-trace-ids.ts --apply   (writes)
 *
 * Users that don't exist yet (13-16 currently) are created as EMPLOYEE
 * with a placeholder Clerk id (`placeholder_<traceId>`) and a placeholder
 * email (`<traceId>@trace.placeholder`). HR must send them a real Clerk
 * invite from Administration -> Employees later; that flow will update
 * the id/email to the real Clerk values and clear the placeholder marks.
 *
 * Two-step assignment (null every touched code, then re-write) avoids
 * the @unique(employeeIdCode) constraint tripping on swaps.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface RosterRow {
  fullName: string;
  traceId: string;
  /** null = no line manager (top of hierarchy). */
  lineManagerName: string | null;
  /** Only honoured on user creation; existing rows keep their designation. */
  designation?: string;
}

const ROSTER: RosterRow[] = [
  { fullName: 'Fuad M Khalid Hossen',              traceId: 'TRACE-0001', lineManagerName: null },
  { fullName: 'Mohammed Mahraj-ul-Alam Samrat',    traceId: 'TRACE-0002', lineManagerName: null },
  { fullName: 'Abu Saleh Muhammad Saifullah',      traceId: 'TRACE-0003', lineManagerName: 'Fuad M Khalid Hossen' },
  { fullName: 'Nabeel Khan',                       traceId: 'TRACE-0004', lineManagerName: 'Fuad M Khalid Hossen' },
  { fullName: 'Mimma Afrin',                       traceId: 'TRACE-0005', lineManagerName: 'Abu Saleh Muhammad Saifullah' },
  { fullName: 'Tahsina Shiva',                     traceId: 'TRACE-0006', lineManagerName: 'Fuad M Khalid Hossen' },
  { fullName: 'Recardo Saurav Antor Halder',       traceId: 'TRACE-0007', lineManagerName: 'Fuad M Khalid Hossen' },
  { fullName: 'Rubayat E Shams Anik',              traceId: 'TRACE-0008', lineManagerName: 'Fuad M Khalid Hossen' },
  { fullName: 'Ahmed Julker Nine',                 traceId: 'TRACE-0009', lineManagerName: 'Fuad M Khalid Hossen' },
  { fullName: 'Mahanaz Akter Lopa',                traceId: 'TRACE-0010', lineManagerName: 'Fuad M Khalid Hossen' },
  { fullName: 'Fahmida Akter',                     traceId: 'TRACE-0011', lineManagerName: 'Fuad M Khalid Hossen' },
  { fullName: 'Shefayat E Shams',                  traceId: 'TRACE-0012', lineManagerName: 'Tahsina Shiva' },
  // New hires — created as EMPLOYEE with placeholder credentials, HR
  // sends real Clerk invites from Administration -> Employees later.
  { fullName: 'Md. Muftehedul Islam Mithul',       traceId: 'TRACE-0013', lineManagerName: 'Tahsina Shiva',        designation: 'Employee' },
  { fullName: 'Naved Afnan',                       traceId: 'TRACE-0014', lineManagerName: 'Rubayat E Shams Anik', designation: 'Research Intern' },
  { fullName: 'Riya Biswas',                       traceId: 'TRACE-0015', lineManagerName: 'Rubayat E Shams Anik', designation: 'Research Intern' },
  { fullName: 'Md Mahamudul Hasan',                traceId: 'TRACE-0016', lineManagerName: 'Rubayat E Shams Anik', designation: 'Research Intern' },
];

function placeholderEmail(traceId: string): string {
  return `${traceId.toLowerCase()}@trace.placeholder`;
}

function placeholderId(traceId: string): string {
  return `placeholder_${traceId.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
}

async function main() {
  const apply = process.argv.includes('--apply');
  console.log(apply ? '=== APPLYING ===' : '=== DRY-RUN (add --apply to write) ===\n');

  interface Resolved {
    row: RosterRow;
    user: { id: string; fullName: string; employeeIdCode: string | null; lineManagerId: string | null } | null;
    action: 'update' | 'create';
  }

  const resolved: Resolved[] = [];
  for (const row of ROSTER) {
    const user = await prisma.user.findFirst({
      where: { fullName: { equals: row.fullName, mode: 'insensitive' } },
      select: { id: true, fullName: true, employeeIdCode: true, lineManagerId: true },
    });
    resolved.push({ row, user, action: user ? 'update' : 'create' });
    if (user) {
      console.log(`  ${apply ? 'UPDATE' : 'DRYRUN'} | ${row.fullName.padEnd(38)} | ${(user.employeeIdCode ?? '-').padEnd(12)} -> ${row.traceId}`);
    } else {
      console.log(`  ${apply ? 'CREATE' : 'DRYRUN'} | ${row.fullName.padEnd(38)} | (new)        -> ${row.traceId}   LM=${row.lineManagerName ?? '-'}`);
    }
  }

  const toCreate = resolved.filter((r) => r.action === 'create').length;
  const toUpdate = resolved.filter((r) => r.action === 'update').length;
  console.log(`\nMatched ${toUpdate} · Will create ${toCreate}`);

  if (!apply) {
    console.log('\nRun again with --apply to write.');
    return;
  }

  await prisma.$transaction(async (tx) => {
    // Step 1: null out employeeIdCode on every user we're about to touch,
    // so swapping codes between existing rows doesn't trip @unique.
    for (const r of resolved) {
      if (r.user) {
        await tx.user.update({ where: { id: r.user.id }, data: { employeeIdCode: null } });
      }
    }

    // Step 2: create missing users (Mithul, Naved, Riya, Mahamudul).
    for (const r of resolved) {
      if (r.action !== 'create') continue;
      const id = placeholderId(r.row.traceId);
      await tx.user.create({
        data: {
          id,
          fullName: r.row.fullName,
          email: placeholderEmail(r.row.traceId),
          role: 'EMPLOYEE',
          roles: ['EMPLOYEE'],
          employeeIdCode: r.row.traceId,
          designation: r.row.designation ?? null,
          isActive: true,
          // lineManagerId is set in Step 4 (needs LM's id, may be another new row).
        },
      });
    }

    // Step 3: write new employeeIdCode onto existing users.
    for (const r of resolved) {
      if (r.action !== 'update' || !r.user) continue;
      await tx.user.update({
        where: { id: r.user.id },
        data: { employeeIdCode: r.row.traceId },
      });
    }

    // Step 4: for the newly-created rows only, set lineManagerId by
    // looking up the manager by fullName (managers exist by now since
    // 1-12 were resolved above and 13-16 don't manage each other).
    for (const r of resolved) {
      if (r.action !== 'create' || !r.row.lineManagerName) continue;
      const mgr = await tx.user.findFirst({
        where: { fullName: { equals: r.row.lineManagerName, mode: 'insensitive' } },
        select: { id: true },
      });
      if (!mgr) {
        console.warn(`  WARN: line manager "${r.row.lineManagerName}" for ${r.row.fullName} not found`);
        continue;
      }
      await tx.user.update({
        where: { id: placeholderId(r.row.traceId) },
        data: { lineManagerId: mgr.id },
      });
    }
  });

  console.log(`\nDone. Updated ${toUpdate}, created ${toCreate}.`);
  if (toCreate > 0) {
    console.log('\nNew employees have placeholder Clerk ids + emails and cannot sign in yet.');
    console.log('Send them a proper invite from Administration -> Employees when ready.');
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
