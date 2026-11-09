'use client';

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { useRole } from './RoleContext';

export interface WeddingEventItem {
  id: string;
  name: string;
  isRepresentative?: boolean;
  isCancelled?: boolean;
}

export interface EventScopeContextValue {
  currentScope: string; // 'all' | 'common' | event UUID
  availableEvents: WeddingEventItem[];
  setScope: (newScope: string) => void;
  // Dirty Form Protection Guard
  registerDirtyForm: (formId: string, isDirty: boolean) => void;
  unregisterDirtyForm: (formId: string) => void;
  isAnyFormDirty: boolean;
  // Guard Dialog State
  pendingScopeChange: string | null;
  showDirtyGuardModal: boolean;
  confirmScopeChange: () => void;
  cancelScopeChange: () => void;
}

const EventScopeContext = createContext<EventScopeContextValue | undefined>(undefined);

export interface EventScopeProviderProps {
  initialEvents?: WeddingEventItem[];
  initialScope?: string;
  initialDirtyForms?: Record<string, boolean>;
  children?: ReactNode;
}

export const EventScopeProvider: React.FC<EventScopeProviderProps> = ({
  initialEvents = [],
  initialScope = 'all',
  initialDirtyForms = {},
  children,
}) => {
  const { isFamily, allowedEventIds } = useRole();
  const [currentScope, setCurrentScope] = useState<string>(initialScope);
  const [dirtyForms, setDirtyForms] = useState<Record<string, boolean>>(initialDirtyForms);
  const [pendingScopeChange, setPendingScopeChange] = useState<string | null>(null);

  const stateRef = React.useRef({
    currentScope,
    dirtyForms,
    pendingScopeChange,
  });

  // Đồng bộ hóa trạng thái mới nhất vào ref
  stateRef.current.currentScope = currentScope;
  stateRef.current.dirtyForms = dirtyForms;
  stateRef.current.pendingScopeChange = pendingScopeChange;

  // Lọc sự kiện theo phân quyền: Người nhà chỉ thấy sự kiện được cấp quyền
  const availableEvents = useMemo(() => {
    if (!isFamily || !allowedEventIds) return initialEvents;
    return initialEvents.filter((ev) => allowedEventIds.includes(ev.id));
  }, [initialEvents, isFamily, allowedEventIds]);

  const registerDirtyForm = useCallback((formId: string, isDirty: boolean) => {
    stateRef.current.dirtyForms = { ...stateRef.current.dirtyForms, [formId]: isDirty };
    setDirtyForms((prev) => {
      if (!isDirty && !(formId in prev)) return prev;
      return { ...prev, [formId]: isDirty };
    });
  }, []);

  const unregisterDirtyForm = useCallback((formId: string) => {
    const copy = { ...stateRef.current.dirtyForms };
    delete copy[formId];
    stateRef.current.dirtyForms = copy;
    setDirtyForms((prev) => {
      if (!(formId in prev)) return prev;
      const prevCopy = { ...prev };
      delete prevCopy[formId];
      return prevCopy;
    });
  }, []);

  const setScope = useCallback(
    (newScope: string) => {
      if (newScope === stateRef.current.currentScope) return;
      const isDirty = Object.values(stateRef.current.dirtyForms).some(Boolean);
      if (isDirty) {
        // Chặn chuyển buổi và hiển thị cảnh báo Dirty Form
        stateRef.current.pendingScopeChange = newScope;
        setPendingScopeChange(newScope);
      } else {
        stateRef.current.currentScope = newScope;
        setCurrentScope(newScope);
      }
    },
    []
  );

  const confirmScopeChange = useCallback(() => {
    if (stateRef.current.pendingScopeChange) {
      const targetScope = stateRef.current.pendingScopeChange;
      stateRef.current.currentScope = targetScope;
      stateRef.current.pendingScopeChange = null;
      stateRef.current.dirtyForms = {};
      setCurrentScope(targetScope);
      setPendingScopeChange(null);
      setDirtyForms({}); // Xóa bỏ cờ dirty sau khi chấp nhận bỏ thay đổi
    }
  }, []);

  const cancelScopeChange = useCallback(() => {
    stateRef.current.pendingScopeChange = null;
    setPendingScopeChange(null);
  }, []);

  const value = useMemo<EventScopeContextValue>(
    () => ({
      get currentScope() {
        return stateRef.current.currentScope;
      },
      get availableEvents() {
        return availableEvents;
      },
      setScope,
      registerDirtyForm,
      unregisterDirtyForm,
      get isAnyFormDirty() {
        return Object.values(stateRef.current.dirtyForms).some(Boolean);
      },
      get pendingScopeChange() {
        return stateRef.current.pendingScopeChange;
      },
      get showDirtyGuardModal() {
        return stateRef.current.pendingScopeChange !== null;
      },
      confirmScopeChange,
      cancelScopeChange,
    }),
    [
      availableEvents,
      setScope,
      registerDirtyForm,
      unregisterDirtyForm,
      confirmScopeChange,
      cancelScopeChange,
    ]
  );

  return React.createElement(EventScopeContext.Provider, { value }, children);
};

export const useEventScope = (): EventScopeContextValue => {
  const context = useContext(EventScopeContext);
  if (!context) {
    throw new Error('useEventScope must be used within an EventScopeProvider');
  }
  return context;
};
