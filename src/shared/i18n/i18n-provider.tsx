"use client";

import type { Locale } from "@/shared/config/locales";
import { createContext, useContext, useMemo } from "react";
import type { Dictionary } from "./translate";
import { translate } from "./translate";

type I18nContextValue = {
  locale: Locale;
  dictionary: Dictionary;
  t: (key: string) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale,
  dictionary,
  children
}: {
  locale: Locale;
  dictionary: Dictionary;
  children: React.ReactNode;
}) {
  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      dictionary,
      t: (key: string) => translate(dictionary, key)
    }),
    [locale, dictionary]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider");
  }

  return context;
}