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
  type: string;
  currency: string;
  currentBalance: string;
};

export type Transaction = {
  id: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: string;
  currency: string;
  date: string;
  merchant?: string | null;
  counterparty?: string | null;
  comment?: string | null;
  source: string;
  category?: {
    id: string;
    name: string;
    icon?: string | null;
    color?: string | null;
  } | null;
};

export type AiAction = {
  id: string;
  payloadJson: {
    transactions: Array<{
      type: "INCOME" | "EXPENSE" | "TRANSFER";
      amount: number;
      currency: string;
      categoryName?: string | null;
      merchant?: string | null;
      counterparty?: string | null;
      comment?: string | null;
      confidence: number;
    }>;
  };
};

export type MonthlySummary = {
  income: number;
  expenses: number;
  net: number;
  savingsRate: number;
  categoryBreakdown: Array<{
    name: string;
    amount: number;
  }>;
};