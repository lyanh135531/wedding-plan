import * as React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/lib/auth/session';
import { RoleProvider } from '@/context/RoleContext';
import { EventScopeProvider } from '@/context/EventScopeContext';
import { withTransactionScopedContext } from '@/db/client';
import { events } from '@/db/schema/events';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentSession();
  if (!session) redirect('/login');
  const eventList = await withTransactionScopedContext(session.user.id, session.role,
    async (_client, db) => db.select({ id: events.id, title: events.title, status: events.status }).from(events));
  return React.createElement(RoleProvider, {
    initialRole: session.role,
    initialAllowedEventIds: session.role === 'owner' ? null : session.allowedEventIds,
  }, React.createElement(EventScopeProvider, {
    initialEvents: eventList.map((event) => ({ id: event.id, name: event.title, isCancelled: event.status === 'cancelled' })),
  }, children));
}
