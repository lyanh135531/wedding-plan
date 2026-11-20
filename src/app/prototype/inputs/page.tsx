import { notFound } from 'next/navigation';
import { InputControlsPlayground } from '@/components/testing/InputControlsPlayground';

export default function InputControlsPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <InputControlsPlayground />;
}
