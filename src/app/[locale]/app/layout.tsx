import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import { redirect } from "next/navigation";
import { AppShell } from "./ui/app-shell";

export default async function LucaAppLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createSupabaseServerClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  return <AppShell locale={locale}>{children}</AppShell>;
}