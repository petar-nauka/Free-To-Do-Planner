import { useState, useEffect } from 'react';

const STORAGE_KEY = 'todayPlanEnabled';

export function useTodayPlanSettings() {
  const [isEnabled, setIsEnabled] = useState<boolean>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'true';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(isEnabled));
  }, [isEnabled]);

  const toggleEnabled = () => {
    setIsEnabled(!isEnabled);
  };

  return {
    isEnabled,
    setIsEnabled,
    toggleEnabled,
  };
}
