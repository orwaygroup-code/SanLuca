"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { LOCALES, DEFAULT_LOCALE, type Locale } from "./types";
import type { Dictionary } from "./dictionaries/es";
import es from "./dictionaries/es";
import en from "./dictionaries/en";
import ja from "./dictionaries/ja";
import zh from "./dictionaries/zh";
import de from "./dictionaries/de";

const dictionaries: Record<Locale, Dictionary> = { es, en, ja, zh, de };
const STORAGE_KEY = "sanluca-locale";

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Dictionary;
  /** Format a number as a price with MXN suffix when not in Spanish. */
  price: (value: number) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function isLocale(v: string | null): v is Locale {
  return !!v && (LOCALES as readonly string[]).includes(v);
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  // Hydrate from localStorage after mount
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (isLocale(saved)) setLocaleState(saved);
    } catch {}
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try { window.localStorage.setItem(STORAGE_KEY, l); } catch {}
    if (typeof document !== "undefined") {
      document.documentElement.lang = l;
    }
  }, []);

  // Sync <html lang> on locale change
  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = locale;
  }, [locale]);

  const t = dictionaries[locale];

  const price = useCallback(
    (value: number) => {
      const rounded = Math.round(value);
      const formatted = new Intl.NumberFormat(localeToBcp47(locale), {
        maximumFractionDigits: 0,
      }).format(rounded);
      return locale === "es" ? `$${formatted}` : `$${formatted} MXN`;
    },
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, price }}>
      {children}
    </I18nContext.Provider>
  );
}

function localeToBcp47(l: Locale): string {
  switch (l) {
    case "es": return "es-MX";
    case "en": return "en-US";
    case "ja": return "ja-JP";
    case "zh": return "zh-CN";
    case "de": return "de-DE";
  }
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Fallback so server-rendered components don't crash before provider mounts.
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => {},
      t: dictionaries[DEFAULT_LOCALE],
      price: (v: number) => `$${Math.round(v)}`,
    } as I18nContextValue;
  }
  return ctx;
}
