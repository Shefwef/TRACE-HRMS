/**
 * Recomputes `overtimeMinutes` and `deficitMinutes` on every closed
 * attendance record using the current office window
 * (standard = workEndTime - workStartTime).
 *
 *   npx tsx --env-file=.env.local scripts/recompute-attendance-hours.ts          (dry-run)
 *   npx tsx --env-file=.env.local scripts/recompute-attendance-hours.ts --apply  (writes)
 *
 * Idempotent — re-running yields the same values.
 * Only touches records whose stored values disagree with the recomputed values.
 */
import { PrismaClient } from '@prisma/client';
import { standardMinutesForRoles, standardMinutesFromWindow, STAFF_EXTRA_MINUTES } from '../src/lib/biometric';

const prisma = new PrismaClient();

async function main() {
  const apply = process.argv.includes('--apply');
  console.log(apply ? '=== APPLYING ===' : '=== DRY-RUN (add --apply to write) ===');

  const settings = await prisma.systemSettings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton' },
  });
  const baseStandard  = standardMinutesFromWindow(settings.workStartTime, settings.workEndTime);
  const staffStandard = baseStandard + STAFF_EXTRA_MINUTES;
  console.log(
    `Office window: ${settings.workStartTime} - ${settings.workEndTime}  ` +
    `(employees = ${baseStandard} min / ${(baseStandard / 60).toFixed(2)}h, ` +
    `staff = ${staffStandard} min / ${(staffStandard / 60).toFixed(2)}h)\n`,
  );

  // Only closed days have deterministic overtime/deficit.
  const records = await prisma.attendanceRecord.findMany({
    where: { clockOutTime: { not: null } },
    select: {
      id: true,
      employee: { select: { fullName: true, employeeIdCode: true, roles: true } },
      date: true,
      totalWorkedMinutes: true,
      overtimeMinutes: true,
      deficitMinutes: true,
    },
    orderBy: [{ date: 'asc' }, { employee: { fullName: 'asc' } }],
  });

  let updated = 0, same = 0;
  for (const r of records) {
    const standardMinutes = standardMinutesForRoles(
      r.employee.roles,
      settings.workStartTime,
      settings.workEndTime,
    );
    const expectedOt  = Math.max(0, r.totalWorkedMinutes - standardMinutes);
    const expectedDef = Math.max(0, standardMinutes - r.totalWorkedMinutes);
    if (expectedOt === r.overtimeMinutes && expectedDef === r.deficitMinutes) {
      same += 1;
      continue;
    }
    updated += 1;
    const tag = r.employee.roles.includes('STAFF') ? '[STAFF]' : '       ';
    const name = (r.employee.employeeIdCode ?? '').padEnd(14) + ' ' + r.employee.fullName.padEnd(32);
    console.log(
      `${r.date.toISOString().slice(0, 10)} ${tag} ${name}  ` +
      `worked=${r.totalWorkedMinutes}m  std=${standardMinutes}m  ` +
      `OT ${r.overtimeMinutes}→${expectedOt}  DEF ${r.deficitMinutes}→${expectedDef}`,
    );
    if (apply) {
      await prisma.attendanceRecord.update({
        where: { id: r.id },
        data: { overtimeMinutes: expectedOt, deficitMinutes: expectedDef },
      });
    }
  }

  console.log(`\nTotal closed records: ${records.length}`);
  console.log(`  Already correct:    ${same}`);
  console.log(`  ${apply ? 'Updated' : 'Would update'}: ${updated}`);
  if (!apply && updated > 0) console.log('\nRun again with --apply to write.');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
