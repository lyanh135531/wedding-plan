'use client';

import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react';

export type UserRole = 'owner' | 'family_view';

export interface RoleContextValue {
  userId?: string;
  role: UserRole;
  isOwner: boolean;
  isFamily: boolean;
  allowedEventIds: string[] | null; // null = all events allowed (Owner)
  setRoleForPreview: (role: UserRole) => void; // Developer/preview toggle
  setAllowedEventIds: (ids: string[] | null) => void;
  canAccessRoute: (pathname: string) => boolean;
  canMutate: boolean;
  canViewFinance: boolean;
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

// Danh sách các route cấm hoàn toàn với người nhà (Family View-only)
export const FORBIDDEN_FAMILY_ROUTES: readonly string[] = [
  '/budget',
  '/costs',
  '/payments',
  '/fund',
  '/gifts',
  '/data/import',
  '/history',
  '/sharing',
  '/after-wedding',
];

export interface RoleProviderProps {
  initialUserId?: string;
  initialRole?: UserRole;
  initialAllowedEventIds?: string[] | null;
  children?: ReactNode;
}

export const RoleProvider: React.FC<RoleProviderProps> = ({
  initialUserId,
  initialRole = 'owner',
  initialAllowedEventIds = null,
  children,
}) => {
  const [role, setRole] = useState<UserRole>(initialRole);
  const [allowedEventIds, setAllowedEventIds] = useState<string[] | null>(initialAllowedEventIds);

  const isOwner = role === 'owner';
  const isFamily = role === 'family_view';

  const canAccessRoute = (pathname: string): boolean => {
    if (isOwner) return true;
    if (!pathname) return true;
    const lower = pathname.toLowerCase();
    const normalized = lower.startsWith('/') ? lower : `/${lower}`;
    return !FORBIDDEN_FAMILY_ROUTES.some(
      (route) => normalized === route || normalized.startsWith(`${route}/`)
    );
  };

  const value = useMemo<RoleContextValue>(
    () => ({
      userId: initialUserId,
      role,
      isOwner,
      isFamily,
      allowedEventIds,
      setRoleForPreview: setRole,
      setAllowedEventIds,
      canAccessRoute,
      canMutate: isOwner,
      canViewFinance: isOwner,
    }),
    [role, allowedEventIds, isOwner, isFamily, initialUserId]
  );

  return React.createElement(RoleContext.Provider, { value }, children);
};

export const useRole = (): RoleContextValue => {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
};
