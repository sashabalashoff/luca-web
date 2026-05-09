"use client";

import { useI18n } from "@/shared/i18n/i18n-provider";
import { createSupabaseBrowserClient } from "@/shared/lib/supabase/client";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { GearSix, SignOut } from "@phosphor-icons/react/dist/ssr";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const router = useRouter();
  const { locale } = useI18n();
  const supabase = createSupabaseBrowserClient();

  async function signOut() {
    await supabase.auth.signOut();
    router.push(`/${locale}/login`);
  }

  return (
    <div>
      <div className="mb-6">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-1.5 text-xs text-[rgb(var(--muted))]">
          <GearSix size={14} weight="duotone" />
          System
        </div>

        <h1 className="text-4xl font-semibold tracking-[-0.055em]">Settings</h1>
      </div>

      <Card className="p-8">
        <div className="flex items-center justify-between gap-5">
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.04em]">
              Account
            </h2>
            <p className="mt-2 text-[rgb(var(--muted))]">
              Workspaces, accounts, categories and billing will be here.
            </p>
          </div>

          <Button onClick={signOut} variant="secondary" className="gap-2">
            <SignOut size={18} weight="bold" />
            Sign out
          </Button>
        </div>
      </Card>
    </div>
  );
}