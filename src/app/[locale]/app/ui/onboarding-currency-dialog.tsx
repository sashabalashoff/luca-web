"use client";

import { useI18n } from "@/shared/i18n/i18n-provider";
import { useLuca } from "@/shared/providers/luca-provider";
import { CheckIcon, MagnifyingGlassIcon } from "@phosphor-icons/react/dist/ssr";
import { useState, useMemo } from "react";

const CURRENCIES: { code: string; name: string }[] = [
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "RUB", name: "Russian Ruble" },
  { code: "GBP", name: "British Pound" },
  { code: "AED", name: "UAE Dirham" },
  { code: "CNY", name: "Chinese Yuan" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "INR", name: "Indian Rupee" },
  { code: "BRL", name: "Brazilian Real" },
  { code: "MXN", name: "Mexican Peso" },
  { code: "KZT", name: "Kazakhstani Tenge" },
  { code: "UAH", name: "Ukrainian Hryvnia" },
  { code: "GEL", name: "Georgian Lari" },
  { code: "TRY", name: "Turkish Lira" },
  { code: "CHF", name: "Swiss Franc" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "HKD", name: "Hong Kong Dollar" },
  { code: "SEK", name: "Swedish Krona" },
  { code: "NOK", name: "Norwegian Krone" },
  { code: "DKK", name: "Danish Krone" },
  { code: "PLN", name: "Polish Zloty" },
  { code: "CZK", name: "Czech Koruna" },
  { code: "HUF", name: "Hungarian Forint" },
  { code: "RON", name: "Romanian Leu" },
  { code: "SAR", name: "Saudi Riyal" },
  { code: "BYN", name: "Belarusian Ruble" },
  { code: "KGS", name: "Kyrgyzstani Som" },
  { code: "UZS", name: "Uzbekistani Som" },
  { code: "AMD", name: "Armenian Dram" },
  { code: "AZN", name: "Azerbaijani Manat" },
  { code: "IDR", name: "Indonesian Rupiah" },
  { code: "THB", name: "Thai Baht" },
  { code: "VND", name: "Vietnamese Dong" },
  { code: "KRW", name: "South Korean Won" },
  { code: "ZAR", name: "South African Rand" },
];

function detectLocaleCurrency(): string {
  try {
    const locale = new Intl.Locale(navigator.language);
    const REGION_CURRENCY: Record<string, string> = {
      RU: "RUB", UA: "UAH", BY: "BYN", KZ: "KZT", GE: "GEL",
      GB: "GBP", DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR",
      PL: "PLN", CZ: "CZK", HU: "HUF", RO: "RON", TR: "TRY",
      AE: "AED", SA: "SAR", CN: "CNY", JP: "JPY", IN: "INR",
      BR: "BRL", MX: "MXN", AU: "AUD", CA: "CAD", CH: "CHF",
      SE: "SEK", NO: "NOK", DK: "DKK", SG: "SGD", HK: "HKD",
    };
    const region = (locale as Intl.Locale & { region?: string }).region;
    return (region && REGION_CURRENCY[region]) ?? "USD";
  } catch {
    return "USD";
  }
}

export function OnboardingCurrencyDialog() {
  const { t } = useI18n();
  const { workspace, isNewUser, confirmOnboarding } = useLuca();

  const [selected, setSelected] = useState<string>(() => workspace?.baseCurrency ?? detectLocaleCurrency());
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return CURRENCIES;
    return CURRENCIES.filter(
      (c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
    );
  }, [search]);

  if (!isNewUser) return null;

  async function handleConfirm() {
    setSaving(true);
    try {
      await confirmOnboarding(selected);
    } finally {
      setSaving(false);
    }
  }

  const autoDetected = detectLocaleCurrency();
  const isAutoDetected = selected === autoDetected;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl bg-[rgb(var(--surface))] border border-[rgb(var(--border))] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="mb-3 text-2xl">💰</div>
          <h2 className="text-lg font-semibold text-[rgb(var(--foreground))]">
            {t("onboarding.title")}
          </h2>
          <p className="mt-1 text-sm text-[rgb(var(--muted))]">{t("onboarding.subtitle")}</p>
        </div>

        {/* Current selection */}
        <div className="mx-6 mb-3 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-soft))] px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-base font-semibold text-[rgb(var(--foreground))]">
              {selected}
            </div>
            <div className="text-xs text-[rgb(var(--muted))]">
              {CURRENCIES.find((c) => c.code === selected)?.name ?? selected}
              {isAutoDetected && (
                <span className="ml-2 opacity-60">· {t("onboarding.autoDetected")}</span>
              )}
            </div>
          </div>
          <CheckIcon size={16} className="text-[rgb(var(--positive))]" weight="bold" />
        </div>

        {/* Search + list */}
        <div className="mx-6 mb-3 relative">
          <MagnifyingGlassIcon
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--muted))]"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("onboarding.search")}
            className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))]"
          />
        </div>
        <div className="mx-6 mb-4 max-h-48 overflow-y-auto rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
          {filtered.map((c) => (
            <button
              key={c.code}
              onClick={() => setSelected(c.code)}
              className={[
                "flex w-full items-center justify-between px-4 py-2.5 text-sm transition-colors",
                c.code === selected
                  ? "bg-[rgb(var(--accent))] text-white"
                  : "hover:bg-[rgb(var(--surface-soft))] text-[rgb(var(--foreground))]",
              ].join(" ")}
            >
              <span>
                <span className="font-medium">{c.code}</span>
                <span className={["ml-2", c.code === selected ? "opacity-80" : "text-[rgb(var(--muted))]"].join(" ")}>
                  {c.name}
                </span>
              </span>
              {c.code === selected && <CheckIcon size={14} weight="bold" />}
            </button>
          ))}
        </div>

        {/* Confirm button */}
        <div className="px-6 pb-6">
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="w-full rounded-xl bg-[rgb(var(--accent))] py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? t("common.loading") : t("onboarding.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
