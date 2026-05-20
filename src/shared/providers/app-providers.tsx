"use client";

import { Locale } from "@/shared/config/locales";
import { Dictionary } from "@/shared/i18n/translate";
import { I18nProvider } from "@/shared/i18n/i18n-provider";
import { useEffect } from "react";
import { SWRConfig } from "swr";
import { ThemeProvider } from "./theme-provider";

function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => { /* SW optional — fail silently */ });
    }
  }, []);
  return null;
}

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
    <SWRConfig value={{
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 15_000,
      errorRetryCount: 1,
      keepPreviousData: true,
    }}>
      <ThemeProvider>
        <I18nProvider locale={locale} dictionary={dictionary}>
          <ServiceWorkerRegistrar />
          {children}
        </I18nProvider>
      </ThemeProvider>
    </SWRConfig>
  );
}