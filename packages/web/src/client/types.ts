export type User = {
  id: number;
  name: string;
  display_order: number;
};

export type Expense = {
  id: number;
  month_id: number;
  user_id: number;
  description: string;
  amount: number;
  note: string | null;
  is_fixed: number;
  sort_order: number;
  created_at: string;
};

export type Income = {
  user_id: number;
  amount: number;
};

export type Settlement = {
  amount: number;
  fromUserId: number | null;
  toUserId: number | null;
  perUserTotals: { user_id: number; total: number }[];
};

export type MonthSummary = {
  id: number;
  year_month: string;
  is_closed: boolean;
  closed_at: string | null;
  settlement_paid: boolean;
  settlement_paid_at: string | null;
  fixed_seeded_at: string | null;
};

export type MonthSnapshot = {
  month: MonthSummary;
  incomes: Income[];
  expenses: Expense[];
  settlement: Settlement;
};

export type FixedTemplate = {
  id: number;
  user_id: number;
  description: string;
  amount: number;
  note: string | null;
  is_active: number;
  display_order: number;
};
