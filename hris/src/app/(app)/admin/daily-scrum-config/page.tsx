import { redirect } from 'next/navigation';
import { ensureUserInDb } from '@/lib/auth';
import { DailyScrumConfig } from '@/screens/admin/DailyScrumConfig';

export default async function Page() {
  const user = await ensureUserInDb();
  if (!user) redirect('/sign-in');

  const roles = user.roles.length > 0 ? user.roles : [user.role];
  const isHr = roles.includes('HR') || roles.includes('SUPER_ADMIN');
  if (!isHr) redirect('/admin');

  return <DailyScrumConfig />;
}
