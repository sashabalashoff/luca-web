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

// ─── AI Operation types (mirrors server/ai/parser.ts) ────────────────────────

export type ParsedTransaction = {
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: number;
  currency: string;
  categoryName?: string | null;
  accountName?: string | null;
  merchant?: string | null;
  counterparty?: string | null;
  comment?: string | null;
  date: string;
  confidence: number;
};

export type CreateTransactionsOp = {
  type: "CREATE_TRANSACTIONS";
  transactions: ParsedTransaction[];
};

export type CreateAccountOp = {
  type: "CREATE_ACCOUNT";
  name: string;
  accountType: "CASH" | "CARD" | "BANK" | "WISE" | "PAYPAL" | "CRYPTO" | "OTHER";
  currency: string;
  initialBalance: number;
  isDebt: boolean;
};

export type CreateCategoriesOp = {
  type: "CREATE_CATEGORIES";
  categories: Array<{
    name: string;
    categoryType: "INCOME" | "EXPENSE";
    icon?: string | null;
    color?: string | null;
  }>;
};

export type SetBudgetOp = {
  type: "SET_BUDGET";
  categoryName: string;
  amount: number;
  currency: string;
  period: "MONTHLY" | "QUARTERLY" | "YEARLY";
};

export type CreateGoalOp = {
  type: "CREATE_GOAL";
  name: string;
  targetAmount: number;
  currency: string;
  deadline?: string | null;
};

export type DeleteTransactionsOp = {
  type: "DELETE_TRANSACTIONS";
  ids: string[];
};

export type UpdateTransactionOp = {
  type: "UPDATE_TRANSACTION";
  id: string;
  fields: {
    amount?: number;
    currency?: string;
    merchant?: string | null;
    comment?: string | null;
    date?: string;
    categoryId?: string | null;
  };
};

export type UpdateGoalProgressOp = {
  type: "UPDATE_GOAL_PROGRESS";
  goalName: string;
  amount: number;
};

export type AiOperation =
  | CreateTransactionsOp
  | CreateAccountOp
  | CreateCategoriesOp
  | SetBudgetOp
  | CreateGoalOp
  | DeleteTransactionsOp
  | UpdateTransactionOp
  | UpdateGoalProgressOp;

export type AiAction = {
  id: string;
  status: string;
  payloadJson: {
    intent?: string;
    message?: string;
    operations?: AiOperation[];
    // Legacy field
    transactions?: ParsedTransaction[];
  };
};

export type AnswerWidget = {
  type:
    | "transactions_table"
    | "spending_chart"
    | "cashflow_chart"
    | "budget_cards"
    | "goals_cards"
    | "account_balances";
  title?: string | null;
  data: unknown;
};

export type AnswerPayload = {
  widgets: AnswerWidget[];
};

// ─── Reports ────────────────────────────────────────────────────────────────

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
