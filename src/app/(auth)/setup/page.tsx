'use client';

import * as React from 'react';
import { SetupWizard } from '@/components/modules/auth/SetupWizard';
import { usePrototype } from '@/components/testing/PrototypeToolbar';

const h = React.createElement;

export default function SetupPage() {
  const { state } = usePrototype();

  return h(
    'main',
    {
      className:
        'min-h-screen flex items-center justify-center p-4 bg-bg-page',
    },
    h(SetupWizard, {
      initialState: state,
    })
  );
}
