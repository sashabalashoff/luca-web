import { isLocale, Locale } from "@/shared/config/locales";
import { getDictionary } from "@/shared/i18n/dictionaries";
import { AppProviders } from "@/shared/providers/app-providers";
import { notFound } from "next/navigation";
import "../globals.css";

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const dictionary = await getDictionary(locale);

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <AppProviders locale={locale as Locale} dictionary={dictionary}>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}