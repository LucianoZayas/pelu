'use client';
import { useEffect, useRef } from 'react';

export function useAutosave(dirty: boolean, save: () => void, delay = 30_000) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!dirty) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, delay);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [dirty, save, delay]);
}
