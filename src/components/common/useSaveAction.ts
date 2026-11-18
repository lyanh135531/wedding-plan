'use client';

import { useRef, useState } from 'react';

/** Lock duplicate clicks, preserve form state on failure, and close only after a successful save. */
export function useSaveAction() {
  const lock = useRef(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const runSave = async (action: () => void | Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    setSaveError(null);
    try { await action(); }
    catch (error) { setSaveError(error instanceof Error ? error.message : 'Không thể lưu dữ liệu.'); }
    finally { lock.current = false; setSaving(false); }
  };
  return { saving, saveError, runSave };
}
