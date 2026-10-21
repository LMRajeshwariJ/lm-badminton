"use client";

import { useCallback, useEffect, useState } from "react";

const EVENT_NAME = "lm-local-preference";

export function useLocalBoolean(key: string, defaultValue: boolean) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    const read = () => {
      try {
        const stored = localStorage.getItem(key);
        setValue(stored === null ? defaultValue : stored === "true");
      } catch {}
    };
    const onPreference = (event: Event) => {
      if ((event as CustomEvent<string>).detail === key) read();
    };
    read();
    window.addEventListener("storage", read);
    window.addEventListener(EVENT_NAME, onPreference);
    return () => {
      window.removeEventListener("storage", read);
      window.removeEventListener(EVENT_NAME, onPreference);
    };
  }, [defaultValue, key]);

  const update = useCallback((next: boolean) => {
    setValue(next);
    try {
      localStorage.setItem(key, String(next));
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: key }));
    } catch {}
  }, [key]);

  return [value, update] as const;
}
