export const LOCALES = ["es", "en", "ja", "zh", "de"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "es";

export const LOCALE_META: Record<Locale, { code: string; native: string; english: string }> = {
  es: { code: "ES", native: "Español",  english: "Spanish"  },
  en: { code: "EN", native: "English",  english: "English"  },
  ja: { code: "JA", native: "日本語",     english: "Japanese" },
  zh: { code: "ZH", native: "中文",       english: "Chinese"  },
  de: { code: "DE", native: "Deutsch",   english: "German"   },
};
