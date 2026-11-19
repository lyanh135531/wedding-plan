import * as React from 'react';
import { redirect } from 'next/navigation';
import { SetupWizard } from '@/components/modules/auth/SetupWizard';
import { getCurrentSession } from '@/lib/auth/session';
import { getWeddingSettings } from '@/lib/settings/settings';

const h = React.createElement;

export default async function SetupPage() {
  const session = await getCurrentSession();
  if (!session) redirect('/login');
  if (session.role !== 'owner' || await getWeddingSettings(session)) redirect('/overview');

  return h(
    'main',
    {
      className:
        'min-h-screen flex items-center justify-center p-4 bg-bg-page',
    },
    h(SetupWizard, {
      prefillExampleData: false,
    })
  );
}
