"use client";

import { apiFetch } from "@/shared/api/client";
import { createContext, useContext, useEffect, useState } from "react";

export type LucaWorkspace = {
  id: string;
  name: string;
  type: "PERSONAL" | "BUSINESS" | "CUSTOM";
  baseCurrency: string;
};

export type LucaAccount = {
  id: string;
  workspaceId: string;
  name: string;
  currency: string;
  currentBalance: string;
  type?: string;
  isDebt?: boolean;
};

const WORKSPACE_KEY = "luca-workspace-id";

const REGION_CURRENCY: Record<string, string> = {
  RU: "RUB", UA: "UAH", BY: "BYN", KZ: "KZT", GE: "GEL",
  GB: "GBP", EU: "EUR", DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR",
  PL: "PLN", CZ: "CZK", HU: "HUF", RO: "RON", TR: "TRY",
  AE: "AED", SA: "SAR", CN: "CNY", JP: "JPY", IN: "INR",
  BR: "BRL", MX: "MXN", AU: "AUD", CA: "CAD", CH: "CHF",
  SE: "SEK", NO: "NOK", DK: "DKK", SG: "SGD", HK: "HKD",
};

function detectLocaleCurrency(): string {
  try {
    const locale = new Intl.Locale(navigator.language);
    const region = (locale as Intl.Locale & { region?: string }).region;
    return (region && REGION_CURRENCY[region]) ?? "USD";
  } catch {
    return "USD";
  }
}

type LucaContextValue = {
  workspaces: LucaWorkspace[];
  workspace: LucaWorkspace | null;
  accounts: LucaAccount[];
  defaultAccount: LucaAccount | null;
  isLoading: boolean;
  transactionKey: number;
  setWorkspaceId: (id: string) => void;
  reload: () => Promise<void>;
};

const LucaContext = createContext<LucaContextValue | null>(null);

export function LucaProvider({ children }: { children: React.ReactNode }) {
  const [workspaces, setWorkspaces] = useState<LucaWorkspace[]>([]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<LucaAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [transactionKey, setTransactionKey] = useState(0);

  const workspace =
    workspaces.find((w) => w.id === currentWorkspaceId) ?? workspaces[0] ?? null;

  function setWorkspaceId(id: string) {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(WORKSPACE_KEY, id);
    }
    setCurrentWorkspaceId(id);
    apiFetch<{ accounts: LucaAccount[] }>(`/api/accounts?workspaceId=${id}`)
      .then((r) => setAccounts(r.accounts))
      .catch(console.error);
  }

  async function load() {
    setIsLoading(true);
    try {
      await apiFetch<{ workspace: LucaWorkspace }>("/api/bootstrap", {
        method: "POST",
        body: JSON.stringify({ name: "Personal", type: "PERSONAL", baseCurrency: detectLocaleCurrency() }),
      });

      const wsResult = await apiFetch<{ workspaces: LucaWorkspace[] }>("/api/workspaces");
      setWorkspaces(wsResult.workspaces);

      const savedId =
        typeof localStorage !== "undefined" ? localStorage.getItem(WORKSPACE_KEY) : null;
      const activeWs =
        wsResult.workspaces.find((w) => w.id === savedId) ?? wsResult.workspaces[0];

      if (activeWs) {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(WORKSPACE_KEY, activeWs.id);
        }
        setCurrentWorkspaceId(activeWs.id);

        const accountsResult = await apiFetch<{ accounts: LucaAccount[] }>(
          `/api/accounts?workspaceId=${activeWs.id}`
        );
        setAccounts(accountsResult.accounts);
      }

      setTransactionKey((k) => k + 1);
    } catch (err) {
      console.error("LUCA bootstrap error:", err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <LucaContext.Provider
      value={{
        workspaces,
        workspace,
        accounts,
        defaultAccount: accounts[0] ?? null,
        isLoading,
        transactionKey,
        setWorkspaceId,
        reload: load,
      }}
    >
      {children}
    </LucaContext.Provider>
  );
}

export function useLuca() {
  const ctx = useContext(LucaContext);
  if (!ctx) throw new Error("useLuca must be used inside LucaProvider");
  return ctx;
}
