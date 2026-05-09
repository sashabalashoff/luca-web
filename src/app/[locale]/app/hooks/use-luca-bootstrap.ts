"use client";

import { apiFetch } from "@/shared/api/client";
import { useEffect, useState } from "react";

export type Workspace = {
  id: string;
  name: string;
  type: "PERSONAL" | "BUSINESS" | "CUSTOM";
  baseCurrency: string;
};

export type Account = {
  id: string;
  workspaceId: string;
  name: string;
  currency: string;
  currentBalance: string;
};

export function useLucaBootstrap() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function load() {
    setIsLoading(true);

    const bootstrap = await apiFetch<{ workspace: Workspace }>("/api/bootstrap", {
      method: "POST",
      body: JSON.stringify({
        name: "Personal",
        type: "PERSONAL",
        baseCurrency: "USD"
      })
    });

    setWorkspace(bootstrap.workspace);

    const accountsResult = await apiFetch<{ accounts: Account[] }>(
      `/api/accounts?workspaceId=${bootstrap.workspace.id}`
    );

    setAccounts(accountsResult.accounts);
    setIsLoading(false);
  }

  useEffect(() => {
    load().catch((error) => {
      console.error(error);
      setIsLoading(false);
    });
  }, []);

  return {
    workspace,
    accounts,
    defaultAccount: accounts[0] ?? null,
    isLoading,
    reload: load
  };
}