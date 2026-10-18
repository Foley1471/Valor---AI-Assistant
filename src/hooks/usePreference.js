import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

export function usePreference() {
  const [pref, setPref] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { items } = await base44.entities.UserPreference.filter(
        {},
        { sort: '-created_date', limit: 1 }
      );
      setPref(items[0] || null);
    } catch (e) {
      setPref(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(
    async (data) => {
      if (pref && pref.id) {
        const updated = await base44.entities.UserPreference.update(pref.id, data);
        setPref(updated);
        return updated;
      }
      const created = await base44.entities.UserPreference.create(data);
      setPref(created);
      return created;
    },
    [pref]
  );

  return { pref, loading, save, reload: load };
}