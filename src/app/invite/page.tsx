import { getCurrentSession } from '@/lib/auth/session';
import { InviteAcceptance } from '@/components/modules/auth/InviteAcceptance';
export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams; const session = await getCurrentSession();
  return <main className="min-h-screen bg-page p-6 flex items-center justify-center"><InviteAcceptance token={token || ''} email={session?.user.email || null} /></main>;
}
