"use client";

import { Locale } from "@/shared/config/locales";
import { Dictionary } from "@/shared/i18n/translate";
import { I18nProvider } from "@/shared/i18n/i18n-provider";
import { ThemeProvider } from "./theme-provider";

export function AppProviders({
  locale,
  dictionary,
  children
}: {
  locale: Locale;
  dictionary: Dictionary;
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <I18nProvider locale={locale} dictionary={dictionary}>
        {children}
      </I18nProvider>
    </ThemeProvider>
  );
}