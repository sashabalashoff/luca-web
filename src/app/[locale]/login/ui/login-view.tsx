"use client";

import { createSupabaseBrowserClient } from "@/shared/lib/supabase/client";
import { LanguageSwitcher } from "@/shared/ui/language-switcher";
import { ThemeSwitcher } from "@/shared/ui/theme-switcher";
import { ArrowRightIcon, FacebookLogoIcon, GoogleLogoIcon, PaperPlaneTiltIcon } from "@phosphor-icons/react/dist/ssr";
import { useEffect, useRef, useState } from "react";

type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramUser) => void;
  }
}

const TELEGRAM_BOT_NAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME ?? "";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export function LoginView({ locale }: { locale: string }) {
  const supabase = createSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [tgLoading, setTgLoading] = useState(false);
  const tgWidgetRef = useRef<HTMLDivElement>(null);

  const isRu = locale === "ru";

  // Load Telegram widget script so clicking our button can trigger the widget popup
  useEffect(() => {
    if (!TELEGRAM_BOT_NAME || !tgWidgetRef.current) return;

    window.onTelegramAuth = handleTelegramAuth;

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", TELEGRAM_BOT_NAME);
    script.setAttribute("data-size", "small");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    script.async = true;
    tgWidgetRef.current.appendChild(script);

    return () => {
      delete window.onTelegramAuth;
    };
  }, []);

  async function handleTelegramAuth(user: TelegramUser) {
    setTgLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/telegram`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert((err as { error?: string }).error ?? "Telegram auth failed");
        return;
      }
      const { token_hash, type } = (await res.json()) as { token_hash: string; type: string };
      const { error } = await supabase.auth.verifyOtp({ token_hash, type: type as "magiclink" });
      if (error) {
        alert(error.message);
        return;
      }
      window.location.href = `/${locale}/app`;
    } finally {
      setTgLoading(false);
    }
  }

  function triggerTelegramWidget() {
    // Click the Telegram widget's iframe button via the hidden container
    const iframe = tgWidgetRef.current?.querySelector("iframe");
    if (iframe) {
      iframe.click();
    } else {
      // Widget not loaded yet — use direct link fallback
      if (TELEGRAM_BOT_NAME) {
        window.open(`https://t.me/${TELEGRAM_BOT_NAME}?start=auth`, "_blank");
      }
    }
  }

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

  async function signInWithFacebook() {
    await supabase.auth.signInWithOAuth({
      provider: "facebook",
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

        {/* Hidden Telegram widget container */}
        {TELEGRAM_BOT_NAME && (
          <div ref={tgWidgetRef} className="absolute -left-[9999px] overflow-hidden" aria-hidden />
        )}

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

            <button
              onClick={signInWithFacebook}
              className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] text-sm font-medium transition-colors hover:bg-[rgb(var(--surface-soft))] active:scale-[0.99]"
            >
              <FacebookLogoIcon size={15} weight="bold" />
              {isRu ? "Продолжить с Facebook" : "Continue with Facebook"}
            </button>

            {TELEGRAM_BOT_NAME && (
              <button
                onClick={triggerTelegramWidget}
                disabled={tgLoading}
                className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] text-sm font-medium transition-colors hover:bg-[rgb(var(--surface-soft))] active:scale-[0.99] disabled:opacity-50"
              >
                <PaperPlaneTiltIcon size={15} weight="bold" />
                {tgLoading
                  ? (isRu ? "Входим..." : "Signing in…")
                  : (isRu ? "Продолжить с Telegram" : "Continue with Telegram")}
              </button>
            )}

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
