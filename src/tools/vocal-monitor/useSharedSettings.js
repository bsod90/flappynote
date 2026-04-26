import { useEffect, useState } from 'react';

export function useSharedSettingsValue(settings, key) {
  const [value, setValue] = useState(() => settings.get(key));
  useEffect(() => {
    setValue(settings.get(key));
    return settings.subscribe((changedKey) => {
      if (changedKey === key) setValue(settings.get(key));
    });
  }, [settings, key]);
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
