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
  type: "CASH" | "CARD" | "BANK" | "WISE" | "PAYPAL" | "CRYPTO" | "OTHER";
  currency: string;
  initialBalance: string;
  currentBalance: string;
  creditLimit?: string | null;
  isDebt: boolean;
  isArchived: boolean;
};

export type Category = {
  id: string;
  workspaceId: string;
  name: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  icon?: string | null;
  color?: string | null;
  isDefault: boolean;
  parentId?: string | null;
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
  account?: {
    id: string;
    name: string;
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
  period: { start: string; end: string };
  income: number;
  expenses: number;
  net: number;
  savingsRate: number;
  categoryBreakdown: Array<{
    name: string;
    amount: number;
  }>;
};

export type BudgetPeriod = "MONTHLY" | "QUARTERLY" | "YEARLY";

export type Budget = {
  id: string;
  workspaceId: string;
  categoryId?: string | null;
  period: BudgetPeriod;
  year: number;
  month?: number | null;
  amount: string;
  currency: string;
  category?: {
    id: string;
    name: string;
    type: string;
    icon?: string | null;
    color?: string | null;
  } | null;
};
