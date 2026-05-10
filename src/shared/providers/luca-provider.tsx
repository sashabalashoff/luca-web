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
};

type LucaContextValue = {
  workspace: LucaWorkspace | null;
  accounts: LucaAccount[];
  defaultAccount: LucaAccount | null;
  isLoading: boolean;
  reload: () => Promise<void>;
};

const LucaContext = createContext<LucaContextValue | null>(null);

export function LucaProvider({ children }: { children: React.ReactNode }) {
  const [workspace, setWorkspace] = useState<LucaWorkspace | null>(null);
  const [accounts, setAccounts] = useState<LucaAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function load() {
    setIsLoading(true);
    try {
      const bootstrap = await apiFetch<{ workspace: LucaWorkspace }>(
        "/api/bootstrap",
        {
          method: "POST",
          body: JSON.stringify({
            name: "Personal",
            type: "PERSONAL",
            baseCurrency: "USD"
          })
        }
      );
      setWorkspace(bootstrap.workspace);

      const accountsResult = await apiFetch<{ accounts: LucaAccount[] }>(
        `/api/accounts?workspaceId=${bootstrap.workspace.id}`
      );
      setAccounts(accountsResult.accounts);
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
        workspace,
        accounts,
        defaultAccount: accounts[0] ?? null,
        isLoading,
        reload: load
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
