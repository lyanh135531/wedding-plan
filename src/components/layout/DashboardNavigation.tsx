'use client';

import React, { createContext, useContext, type ReactNode } from 'react';
import { DesktopSidebar } from './DesktopSidebar';

const DashboardNavigationContext = createContext(false);

export function useDashboardNavigation() {
  return useContext(DashboardNavigationContext);
}

// Keep the sidebar mounted across routes so its scroll position and focus survive.
export function DashboardNavigation({ children }: { children: ReactNode }) {
  return (
    <DashboardNavigationContext.Provider value={true}>
      <DesktopSidebar />
      {children}
    </DashboardNavigationContext.Provider>
  );
}
