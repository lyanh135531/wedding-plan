import { notFound } from 'next/navigation';
import { PrototypePlayground } from '@/components/testing/PrototypePlayground';

export default function PrototypePage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <PrototypePlayground />;
}
