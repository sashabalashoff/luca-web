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
    <div className="luca-bg relative flex min-h-screen items-center justify-center px-4">
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeSwitcher />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-10">
          <div className="mb-6 font-mono text-xs font-bold tracking-[0.2em] uppercase text-[rgb(var(--accent))]">
            LUCA
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {isRu ? "Войти в LUCA" : "Sign in to LUCA"}
          </h1>
          <p className="mt-2 text-sm text-[rgb(var(--muted))]">
            {isRu
              ? "AI-first пространство для личных и бизнес-финансов."
              : "AI-first workspace for personal and business money."}
          </p>
        </div>

        {sent ? (
          <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6 text-center">
            <div className="mb-2 text-2xl">✉️</div>
            <div className="font-medium">
              {isRu ? "Проверь почту" : "Check your email"}
            </div>
            <p className="mt-1 text-sm text-[rgb(var(--muted))]">
              {isRu
                ? `Magic link отправлен на ${email}`
                : `Magic link sent to ${email}`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              onClick={signInWithGoogle}
              className="flex h-10 w-full items-center justify-center gap-2.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] text-sm font-medium transition hover:bg-[rgb(var(--surface-soft))] active:scale-[0.99]"
            >
              <GoogleLogoIcon size={16} weight="bold" />
              {isRu ? "Продолжить с Google" : "Continue with Google"}
            </button>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-[rgb(var(--border))]" />
              <span className="text-xs text-[rgb(var(--muted))]">
                {isRu ? "или" : "or"}
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
                className="h-10 min-w-0 flex-1 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 text-sm outline-none transition placeholder:text-[rgb(var(--muted))] focus:border-[rgb(var(--accent))] focus:ring-1 focus:ring-[rgb(var(--accent)/0.3)]"
              />
              <button
                onClick={signInWithEmail}
                disabled={!email || isLoading}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--foreground))] text-[rgb(var(--background))] transition hover:opacity-85 disabled:opacity-40 active:scale-[0.97]"
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
