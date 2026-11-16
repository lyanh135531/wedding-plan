'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { VendorDetailScreen } from '@/components/modules/vendors/VendorDetailScreen';

export default function VendorDetailPage({
  params: initialParams,
}: {
  params?: { id: string };
}) {
  const routerParams = useParams();
  const id = initialParams?.id || (routerParams?.id as string) || '';

  return React.createElement(VendorDetailScreen, { vendorId: id });
}
