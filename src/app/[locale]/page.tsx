import { isLocale } from "@/shared/config/locales";
import { redirect } from "next/navigation";

export default async function LocaleHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${isLocale(locale) ? locale : "en"}/login`);
}
