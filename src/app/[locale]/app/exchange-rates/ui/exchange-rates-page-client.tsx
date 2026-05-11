"use client";

import { apiFetch } from "@/shared/api/client";
import { useI18n } from "@/shared/i18n/i18n-provider";
import { useLuca } from "@/shared/providers/luca-provider";
import { ArrowsClockwiseIcon, ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";
import { useEffect, useState, useCallback } from "react";

type RatesResponse = {
  base: string;
  rates: Record<string, number>;
  time: number;
  nextUpdate: number;
  history: Record<string, Record<string, number>>;
};

const CURRENCY_NAMES: Record<string, string> = {
  USD: "US Dollar", EUR: "Euro", GBP: "British Pound",
  RUB: "Russian Ruble", AED: "UAE Dirham", CNY: "Chinese Yuan",
  JPY: "Japanese Yen", TRY: "Turkish Lira", KZT: "Kazakhstani Tenge",
  UAH: "Ukrainian Hryvnia", CAD: "Canadian Dollar", AUD: "Australian Dollar",
  CHF: "Swiss Franc", INR: "Indian Rupee", BRL: "Brazilian Real",
  MXN: "Mexican Peso", SGD: "Singapore Dollar", HKD: "Hong Kong Dollar",
  PLN: "Polish Zloty", CZK: "Czech Koruna", SEK: "Swedish Krona",
  NOK: "Norwegian Krone", THB: "Thai Baht", VND: "Vietnamese Dong",
  IDR: "Indonesian Rupiah", PHP: "Philippine Peso", MYR: "Malaysian Ringgit",
  BTC: "Bitcoin", ETH: "Ethereum", USDT: "Tether",
};

const CURRENCY_FLAGS: Record<string, string> = {
  USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧", RUB: "🇷🇺", AED: "🇦🇪",
  CNY: "🇨🇳", JPY: "🇯🇵", TRY: "🇹🇷", KZT: "🇰🇿", UAH: "🇺🇦",
  CAD: "🇨🇦", AUD: "🇦🇺", CHF: "🇨🇭", INR: "🇮🇳", BRL: "🇧🇷",
  MXN: "🇲🇽", SGD: "🇸🇬", HKD: "🇭🇰", PLN: "🇵🇱", CZK: "🇨🇿",
  SEK: "🇸🇪", NOK: "🇳🇴", THB: "🇹🇭", VND: "🇻🇳", IDR: "🇮🇩",
  PHP: "🇵🇭", MYR: "🇲🇾", BTC: "₿", ETH: "Ξ", USDT: "💵",
};

function Sparkline({ data, currency }: { data: Record<string, Record<string, number>>; currency: string }) {
  const dates = Object.keys(data).sort();
  if (dates.length < 2) return <div className="h-8 w-20" />;

  const values = dates.map((d) => data[d]?.[currency]).filter((v): v is number => v != null);
  if (values.length < 2) return <div className="h-8 w-20" />;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const W = 80;
  const H = 32;

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - ((v - min) / range) * (H - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const last = values[values.length - 1];
  const first = values[0];
  const up = last >= first;

  return (
    <svg width={W} height={H} className="overflow-visible">
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={up ? "rgb(var(--positive))" : "rgb(var(--negative))"}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function formatRate(rate: number, currency: string): string {
  if (rate >= 1000) return rate.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (rate >= 1) return rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  if (currency === "BTC" || currency === "ETH") return rate.toFixed(8);
  return rate.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 });
}

function getChange(history: Record<string, Record<string, number>>, currency: string): number | null {
  const dates = Object.keys(history).sort();
  if (dates.length < 2) return null;
  const first = history[dates[0]]?.[currency];
  const last = history[dates[dates.length - 1]]?.[currency];
  if (first == null || last == null || first === 0) return null;
  return ((last - first) / first) * 100;
}

export function ExchangeRatesPageClient() {
  const { t } = useI18n();
  const { workspace } = useLuca();
  const [data, setData] = useState<RatesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");

  // Converter state
  const [fromAmount, setFromAmount] = useState("1");
  const [fromCurrency, setFromCurrency] = useState("");
  const [toCurrency, setToCurrency] = useState(workspace?.baseCurrency ?? "USD");

  const base = workspace?.baseCurrency ?? "USD";

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await apiFetch<RatesResponse>(
        `/api/exchange-rates?base=${base}&history=7`
      );
      setData(res);
      if (!fromCurrency) setFromCurrency(base);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [base, fromCurrency]);

  useEffect(() => { load(); }, [workspace]);

  const filtered = data
    ? Object.entries(data.rates).filter(([code]) => {
        const q = search.toLowerCase();
        return !q || code.toLowerCase().includes(q) || (CURRENCY_NAMES[code] ?? "").toLowerCase().includes(q);
      })
    : [];

  // Convert: fromAmount in fromCurrency → toCurrency
  function convert(): string {
    if (!data || !fromAmount) return "–";
    const n = parseFloat(fromAmount);
    if (isNaN(n)) return "–";

    // from → base → to
    let amountInBase: number;
    if (fromCurrency === base) {
      amountInBase = n;
    } else {
      const rate = data.rates[fromCurrency];
      if (!rate) return "–";
      amountInBase = n / rate;
    }

    let result: number;
    if (toCurrency === base) {
      result = amountInBase;
    } else {
      const toRate = data.rates[toCurrency];
      if (!toRate) return "–";
      result = amountInBase * toRate;
    }
    return formatRate(result, toCurrency);
  }

  const updatedAt = data
    ? new Date(data.time * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : null;

  const availableCurrencies = data
    ? [base, ...Object.keys(data.rates)]
    : [base];

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("exchangeRates.title")}</h1>
          <p className="mt-0.5 text-sm text-[rgb(var(--muted))]">
            {updatedAt ? `${t("exchangeRates.updated")}: ${updatedAt}` : t("exchangeRates.subtitle")}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-[rgb(var(--border))] px-3 py-2 text-sm text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--surface-soft))] hover:text-[rgb(var(--foreground))] disabled:opacity-40"
        >
          <ArrowsClockwiseIcon size={14} className={loading ? "animate-spin" : ""} />
          {t("exchangeRates.refresh")}
        </button>
      </div>

      {/* Currency Converter */}
      <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-5">
        <h2 className="mb-4 text-sm font-semibold text-[rgb(var(--foreground))]">
          {t("exchangeRates.converter")}
        </h2>
        <div className="flex items-center gap-3">
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-[11px] font-medium text-[rgb(var(--muted))]">{t("exchangeRates.from")}</label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                step="any"
                value={fromAmount}
                onChange={(e) => setFromAmount(e.target.value)}
                className="h-10 w-full min-w-0 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm outline-none transition focus:border-[rgb(var(--accent))] focus:ring-2 focus:ring-[rgb(var(--accent)/0.12)]"
              />
              <select
                value={fromCurrency}
                onChange={(e) => setFromCurrency(e.target.value)}
                className="h-10 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-2 text-sm outline-none focus:border-[rgb(var(--accent))]"
              >
                {availableCurrencies.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <ArrowRightIcon size={16} className="mt-5 shrink-0 text-[rgb(var(--muted))]" />

          <div className="flex flex-1 flex-col gap-1">
            <label className="text-[11px] font-medium text-[rgb(var(--muted))]">{t("exchangeRates.to")}</label>
            <div className="flex gap-2">
              <div className="h-10 flex-1 min-w-0 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-3 text-sm font-semibold flex items-center text-[rgb(var(--foreground))]">
                {convert()}
              </div>
              <select
                value={toCurrency}
                onChange={(e) => setToCurrency(e.target.value)}
                className="h-10 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-2 text-sm outline-none focus:border-[rgb(var(--accent))]"
              >
                {availableCurrencies.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Rates Table */}
      <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] overflow-hidden">
        {/* Search */}
        <div className="border-b border-[rgb(var(--border-soft))] px-4 py-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("exchangeRates.search")}
            className="w-full bg-transparent text-sm outline-none placeholder:text-[rgb(var(--muted-soft))]"
          />
        </div>

        {/* Header row */}
        <div className="grid grid-cols-[2fr_2fr_1.5fr_auto] gap-4 border-b border-[rgb(var(--border-soft))] px-4 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--muted-soft))]">
            {t("exchangeRates.currency")}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--muted-soft))]">
            1 {base} =
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--muted-soft))] text-right">
            7d
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--muted-soft))] text-right pr-1">
            %
          </span>
        </div>

        {loading ? (
          <div className="space-y-px py-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="mx-2 h-12 animate-pulse rounded-lg bg-[rgb(var(--surface-soft))]"
              />
            ))}
          </div>
        ) : error ? (
          <div className="py-12 text-center text-sm text-[rgb(var(--muted))]">
            {t("exchangeRates.error")}
          </div>
        ) : (
          <div className="divide-y divide-[rgb(var(--border-soft))]">
            {filtered.map(([code, rate]) => {
              const change = data ? getChange(data.history, code) : null;
              const flag = CURRENCY_FLAGS[code] ?? "💱";
              const name = CURRENCY_NAMES[code] ?? code;
              return (
                <div
                  key={code}
                  className="grid grid-cols-[2fr_2fr_1.5fr_auto] items-center gap-4 px-4 py-3 hover:bg-[rgb(var(--surface-soft))] transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg leading-none">{flag}</span>
                    <div>
                      <div className="text-sm font-semibold text-[rgb(var(--foreground))]">{code}</div>
                      <div className="text-xs text-[rgb(var(--muted))]">{name}</div>
                    </div>
                  </div>
                  <div className="font-mono text-sm text-[rgb(var(--foreground))]">
                    {formatRate(rate, code)}
                  </div>
                  <div className="flex justify-end">
                    {data && <Sparkline data={data.history} currency={code} />}
                  </div>
                  <div className="min-w-[48px] text-right">
                    {change != null ? (
                      <span
                        className={[
                          "text-xs font-medium",
                          change > 0
                            ? "text-[rgb(var(--positive))]"
                            : change < 0
                            ? "text-[rgb(var(--negative))]"
                            : "text-[rgb(var(--muted))]",
                        ].join(" ")}
                      >
                        {change > 0 ? "+" : ""}
                        {change.toFixed(2)}%
                      </span>
                    ) : (
                      <span className="text-xs text-[rgb(var(--muted-soft))]">–</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
