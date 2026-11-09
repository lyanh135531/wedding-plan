'use client';

import * as React from 'react';
import { GoogleLoginCard } from '@/components/modules/auth/GoogleLoginCard';
import { usePrototype } from '@/components/testing/PrototypeToolbar';

const h = React.createElement;

export default function LoginPage() {
  const { state } = usePrototype();

  return h(
    'main',
    {
      className:
        'min-h-screen flex items-center justify-center p-4 bg-bg-page',
    },
    h(GoogleLoginCard, {
      isUninvited: state === 'filtered' || state === 'permission_denied',
      isLoading: state === 'loading',
    })
  );
}
