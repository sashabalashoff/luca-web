"use client";

import { createSupabaseBrowserClient } from "@/shared/lib/supabase/client";
import { LanguageSwitcher } from "@/shared/ui/language-switcher";
import { ThemeSwitcher } from "@/shared/ui/theme-switcher";
import { ArrowRightIcon, GoogleLogoIcon } from "@phosphor-icons/react/dist/ssr";
import { useState } from "react";

export function LoginView({ locale }: { locale: string }) {
  const supabase = createSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const isRu = locale === "ru";

  async function signInWithEmail() {
    if (!email) return;
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
    setSent(true);
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
    <div className="relative flex min-h-dvh items-center justify-center bg-[rgb(var(--background))] px-4">
      <div className="absolute right-4 top-4 flex items-center gap-1">
        <LanguageSwitcher />
        <ThemeSwitcher />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-10">
          <div className="mb-1 text-[13px] font-semibold uppercase tracking-widest text-[rgb(var(--accent))]">
            LUCA
          </div>
          <h1 className="text-[1.875rem] font-bold tracking-tight text-[rgb(var(--foreground))]">
            {isRu ? "Войти" : "Sign in"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[rgb(var(--muted))]">
            {isRu
              ? "AI-first пространство для личных и бизнес-финансов."
              : "AI-first workspace for personal and business money."}
          </p>
        </div>

        {sent ? (
          <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6 text-center">
            <div className="mb-3 text-3xl">✉️</div>
            <div className="font-semibold">
              {isRu ? "Проверь почту" : "Check your email"}
            </div>
            <p className="mt-1.5 text-sm text-[rgb(var(--muted))]">
              {isRu
                ? `Magic link отправлен на ${email}`
                : `Magic link sent to ${email}`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              onClick={signInWithGoogle}
              className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] text-sm font-medium transition-colors hover:bg-[rgb(var(--surface-soft))] active:scale-[0.99]"
            >
              <GoogleLogoIcon size={15} weight="bold" />
              {isRu ? "Продолжить с Google" : "Continue with Google"}
            </button>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-[rgb(var(--border))]" />
              <span className="text-xs text-[rgb(var(--muted))]">
                {isRu ? "или по email" : "or with email"}
              </span>
              <div className="h-px flex-1 bg-[rgb(var(--border))]" />
            </div>

            <div className="flex gap-2">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && signInWithEmail()}
                placeholder={isRu ? "email@example.com" : "you@example.com"}
                type="email"
                className="h-11 min-w-0 flex-1 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3.5 text-sm outline-none transition placeholder:text-[rgb(var(--muted))] focus:border-[rgb(var(--accent))] focus:ring-2 focus:ring-[rgb(var(--accent)/0.12)]"
              />
              <button
                onClick={signInWithEmail}
                disabled={!email || isLoading}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--accent))] text-white transition hover:bg-[rgb(var(--accent-hover))] disabled:opacity-40 active:scale-[0.97]"
              >
                <ArrowRightIcon size={15} weight="bold" />
              </button>
            </div>
          </div>
        )}

        <p className="mt-8 text-center text-xs text-[rgb(var(--muted))]">
          {isRu
            ? "Входя, ты соглашаешься с условиями использования LUCA."
            : "By signing in, you agree to LUCA's terms of service."}
        </p>
      </div>
    </div>
  );
}
