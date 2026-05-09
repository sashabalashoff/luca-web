"use client";

import { useI18n } from "@/shared/i18n/i18n-provider";
import { createSupabaseBrowserClient } from "@/shared/lib/supabase/client";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { LanguageSwitcher } from "@/shared/ui/language-switcher";
import { ThemeSwitcher } from "@/shared/ui/theme-switcher";
import { ArrowRight, GoogleLogo, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { useState } from "react";

export function LoginView({ locale }: { locale: string }) {
  const { t } = useI18n();
  const supabase = createSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function signInWithEmail() {
    setIsLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/${locale}/auth/callback`
      }
    });

    setIsLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert(locale === "ru" ? "Ссылка отправлена на email" : "Magic link sent");
  }

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/${locale}/auth/callback`
      }
    });
  }

  return (
    <main className="luca-bg flex min-h-screen items-center justify-center px-5 py-5">
      <div className="fixed right-5 top-5 flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeSwitcher />
      </div>

      <Card className="w-full max-w-[460px] p-7">
        <div className="mb-8">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-[24px] border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))]">
            <Sparkle size={24} weight="duotone" />
          </div>

          <div className="font-mono text-sm uppercase tracking-[0.28em] text-[rgb(var(--muted))]">
            LUCA
          </div>

          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em]">
            {locale === "ru" ? "Войти в LUCA" : "Sign in to LUCA"}
          </h1>

          <p className="mt-3 leading-7 text-[rgb(var(--muted))]">
            {locale === "ru"
              ? "AI-first пространство для личных и бизнес-финансов."
              : "AI-first workspace for personal and business money."}
          </p>
        </div>

        <div className="space-y-3">
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="h-13 w-full rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-4 text-sm outline-none transition placeholder:text-[rgb(var(--muted))] focus:border-[rgb(var(--foreground))]"
          />

          <Button
            onClick={signInWithEmail}
            disabled={!email || isLoading}
            className="w-full justify-between"
          >
            <span>{locale === "ru" ? "Продолжить с email" : "Continue with email"}</span>
            <ArrowRight size={18} weight="bold" />
          </Button>

          <Button
            onClick={signInWithGoogle}
            variant="secondary"
            className="w-full justify-between"
          >
            <span>{locale === "ru" ? "Продолжить с Google" : "Continue with Google"}</span>
            <GoogleLogo size={18} weight="bold" />
          </Button>
        </div>
      </Card>
    </main>
  );
}