"use client";

import { createSupabaseBrowserClient } from "@/shared/lib/supabase/client";
import { LanguageSwitcher } from "@/shared/ui/language-switcher";
import { ThemeSwitcher } from "@/shared/ui/theme-switcher";
import {
  ArrowRightIcon,
  FacebookLogoIcon,
  GoogleLogoIcon,
  PaperPlaneTiltIcon,
} from "@phosphor-icons/react/dist/ssr";
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
  const [activeFeatureIndex, setActiveFeatureIndex] = useState(0);
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

  const features = isRu
    ? [
      {
        title: "Записывай расходы в чате",
        userMessage: "Оплатил 12 500 ₽ за рекламу вчера",
        assistantTitle: "Расход готов",
        details: [["Сумма", "−12 500 ₽"], ["Категория", "Реклама"], ["Дата", "Вчера"]],
      },
      {
        title: "Следи за бюджетами",
        userMessage: "Сколько осталось на рекламу в мае?",
        assistantTitle: "Бюджет: Реклама",
        details: [["Лимит", "80 000 ₽"], ["Потрачено", "52 400 ₽"], ["Осталось", "27 600 ₽"]],
      },
      {
        title: "Смотри cash flow",
        userMessage: "Покажи cash flow за этот месяц",
        assistantTitle: "Месяц в плюсе",
        details: [["Доходы", "+243 000 ₽"], ["Расходы", "−178 500 ₽"], ["Итого", "+64 500 ₽"]],
      },
    ]
    : [
      {
        title: "Log expenses in chat",
        userMessage: "Paid $320 for ads yesterday",
        assistantTitle: "Expense ready",
        details: [["Amount", "−$320"], ["Category", "Marketing"], ["Date", "Yesterday"]],
      },
      {
        title: "Track budgets",
        userMessage: "How much is left for ads in May?",
        assistantTitle: "Budget: Marketing",
        details: [["Limit", "$2,000"], ["Spent", "$1,310"], ["Left", "$690"]],
      },
      {
        title: "Review cash flow",
        userMessage: "Show cash flow for this month",
        assistantTitle: "Month is positive",
        details: [["Income", "+$6,200"], ["Expenses", "−$4,540"], ["Net", "+$1,660"]],
      },
    ];
  const activeFeature = features[activeFeatureIndex] ?? features[0];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveFeatureIndex((index) => (index + 1) % features.length);
    }, 3500);

    return () => window.clearInterval(timer);
  }, [features.length]);

  return (
    <div className="grid min-h-dvh bg-[rgb(var(--background))] lg:grid-cols-[minmax(0,1fr)_minmax(440px,0.78fr)]">
      <section className="hidden min-h-dvh bg-[#11140f] text-white lg:flex lg:flex-col">
        <div className="px-12 pt-10 text-xl font-semibold text-[#f3f4ed]">LUCA</div>

        <div className="flex flex-1 items-center px-12 py-10">
          <div className="w-full max-w-[700px]">
            <h2 className="mb-10 max-w-2xl text-[2.05rem] font-semibold leading-tight text-[#c7f05b] xl:text-[2.45rem]">
              {isRu ? "Финансы, которые отвечают как чат" : "Finance that responds like chat"}
            </h2>

            <div key={activeFeature.title} className="luca-feature-fade">
              <div className="mt-6">
                <div className="mb-3 flex justify-end">
                  <div className="max-w-[82%] rounded-2xl rounded-br-md bg-[#f7f7f1] px-4 py-2.5 text-sm font-medium leading-relaxed text-[#151711]">
                    {activeFeature.userMessage}
                  </div>
                </div>

                <div className="max-w-[430px] rounded-2xl rounded-bl-md bg-[#22271f] p-4 shadow-2xl shadow-black/20">
                  <div className="text-sm font-semibold text-[#f3f4ed]">{activeFeature.assistantTitle}</div>
                  <div className="mt-3 divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10">
                    {activeFeature.details.map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between gap-4 px-3 py-2.5">
                        <span className="text-xs text-white/55">{label}</span>
                        <span className="text-xs font-semibold text-[#f3f4ed]">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="relative flex min-h-dvh items-start justify-center px-4 pb-5 pt-14 lg:items-center lg:py-8">
        <div className="absolute right-4 top-4 flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeSwitcher />
        </div>

        <div className="w-full max-w-[420px]">
          <div className="mb-5 lg:hidden">
            <div className="mb-3 text-xl font-semibold text-[rgb(var(--foreground))]">LUCA</div>
            <div className="mb-3 text-[1.25rem] font-semibold leading-tight text-[rgb(var(--accent))]">
              {isRu ? "Финансы в формате чата" : "Finance in chat form"}
            </div>
            <div key={activeFeature.title} className="luca-feature-fade">
              <div className="mt-6">
                <div className="mb-2 flex justify-end">
                  <div className="max-w-[86%] rounded-2xl rounded-br-md bg-[rgb(var(--foreground))] px-3 py-2 text-[13px] leading-relaxed text-[rgb(var(--background))]">
                    {activeFeature.userMessage}
                  </div>
                </div>
                <div className="rounded-2xl rounded-bl-md bg-[rgb(var(--surface-soft))] p-3">
                  <div className="mb-2 text-[13px] font-semibold text-[rgb(var(--foreground))]">
                    {activeFeature.assistantTitle}
                  </div>
                  <div className="space-y-1.5">
                    {activeFeature.details.slice(0, 2).map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between gap-3 text-[10px]">
                        <span className="text-[rgb(var(--muted))]">{label}</span>
                        <span className="font-semibold text-[rgb(var(--foreground))]">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-6 text-center lg:mb-8 lg:text-left">
            <h1 className="text-[1.8rem] font-semibold leading-tight text-[rgb(var(--foreground))] lg:text-[2rem]">
              {isRu ? "Войти в LUCA" : "Log in to LUCA"}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[rgb(var(--muted))] lg:text-base">
              {isRu
                ? "Продолжи работу с операциями, счетами и отчетами."
                : "Continue with your transactions, accounts and reports."}
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
                className="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface))] text-sm font-medium transition-colors hover:bg-[rgb(var(--surface-soft))] active:scale-[0.99] lg:h-14 lg:text-[15px]"
              >
                <GoogleLogoIcon size={15} weight="bold" />
                {isRu ? "Продолжить с Google" : "Continue with Google"}
              </button>

              <button
                onClick={signInWithFacebook}
                className="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface))] text-sm font-medium transition-colors hover:bg-[rgb(var(--surface-soft))] active:scale-[0.99] lg:h-14 lg:text-[15px]"
              >
                <FacebookLogoIcon size={15} weight="bold" />
                {isRu ? "Продолжить с Facebook" : "Continue with Facebook"}
              </button>

              {TELEGRAM_BOT_NAME && (
                <button
                  onClick={triggerTelegramWidget}
                  disabled={tgLoading}
                  className="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface))] text-sm font-medium transition-colors hover:bg-[rgb(var(--surface-soft))] active:scale-[0.99] disabled:opacity-50 lg:h-14 lg:text-[15px]"
                >
                  <PaperPlaneTiltIcon size={15} weight="bold" />
                  {tgLoading
                    ? (isRu ? "Входим..." : "Signing in…")
                    : (isRu ? "Продолжить с Telegram" : "Continue with Telegram")}
                </button>
              )}

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-[rgb(var(--border))]" />
                <span className="text-xs uppercase text-[rgb(var(--muted))]">
                  {isRu ? "или" : "or"}
                </span>
                <div className="h-px flex-1 bg-[rgb(var(--border))]" />
              </div>

              <div className="space-y-3">
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && signInWithEmail()}
                  placeholder={isRu ? "Email" : "Email address"}
                  type="email"
                  className="h-12 w-full rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-5 text-sm outline-none transition placeholder:text-[rgb(var(--muted))] focus:border-[rgb(var(--accent))] focus:ring-2 focus:ring-[rgb(var(--accent)/0.12)] lg:h-14 lg:px-6 lg:text-[15px]"
                />
                <button
                  onClick={signInWithEmail}
                  disabled={!email || isLoading}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[rgb(var(--foreground))] text-sm font-medium text-[rgb(var(--background))] transition hover:opacity-85 disabled:opacity-40 active:scale-[0.98] lg:h-14 lg:text-[15px]"
                >
                  {isLoading ? (isRu ? "Отправляем..." : "Sending...") : (isRu ? "Продолжить" : "Continue")}
                  {!isLoading && <ArrowRightIcon size={15} weight="bold" />}
                </button>
              </div>
            </div>
          )}

          <p className="mt-5 text-center text-xs text-[rgb(var(--muted))] lg:mt-8">
            {isRu
              ? "Входя, ты соглашаешься с условиями использования LUCA."
              : "By signing in, you agree to LUCA's terms of service."}
          </p>
        </div>
      </main>
      <style jsx>{`
        .luca-feature-fade {
          animation: luca-feature-fade 1500ms ease both;
        }

        @keyframes luca-feature-fade {
          from {
            opacity: 0;
            transform: translateY(8px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
