import { useEffect, useState, useSyncExternalStore } from 'react';

export function useSharedSettingsValue(settings, key) {
  const value = useSyncExternalStore(
    (cb) => settings.subscribe((changedKey) => {
      if (changedKey === key) cb();
    }),
    () => settings.get(key)
  );
  return value;
}

export function useSharedSettingValues(settings, keys) {
  const [snapshot, setSnapshot] = useState(() =>
    Object.fromEntries(keys.map((k) => [k, settings.get(k)]))
  );

  useEffect(() => {
    const unsubscribe = settings.subscribe((key) => {
      if (keys.includes(key)) {
        setSnapshot((prev) => ({ ...prev, [key]: settings.get(key) }));
      }
    });
    setSnapshot(Object.fromEntries(keys.map((k) => [k, settings.get(k)])));
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, keys.join(',')]);

  return snapshot;
}
