import type Database from 'better-sqlite3';
import { isValidYearMonth, getNowISO, calculateSettlement, getCurrentMonthJST } from '@warikan/shared';

export type MonthRow = {
  id: number;
  year_month: string;
  is_closed: number;
  closed_at: string | null;
  settlement_paid: number;
  settlement_paid_at: string | null;
  fixed_seeded_at: string | null;
};

export type ExpenseRow = {
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

export type IncomeRow = {
  id: number;
  month_id: number;
  user_id: number;
  amount: number;
};

export type MonthSnapshot = {
  month: {
    id: number;
    year_month: string;
    is_closed: boolean;
    closed_at: string | null;
    settlement_paid: boolean;
    settlement_paid_at: string | null;
    fixed_seeded_at: string | null;
  };
  incomes: { user_id: number; amount: number }[];
  expenses: ExpenseRow[];
  settlement: {
    amount: number;
    fromUserId: number | null;
    toUserId: number | null;
    perUserTotals: { user_id: number; total: number }[];
  };
};

export function getOrCreateMonth(db: Database.Database, yearMonth: string): MonthRow {
  if (!isValidYearMonth(yearMonth)) {
    throw Object.assign(new Error('invalid year_month'), { httpStatus: 400 });
  }

  // 未来月（まだ到来していない月）はレコードを作成・取得させない
  if (yearMonth > getCurrentMonthJST()) {
    throw Object.assign(new Error('future month is not allowed'), { httpStatus: 400 });
  }

  const initialize = db.transaction((ym: string) => {
    db.prepare('INSERT OR IGNORE INTO months (year_month) VALUES (?)').run(ym);
    const month = db
      .prepare('SELECT * FROM months WHERE year_month = ?')
      .get(ym) as MonthRow;

    if (month.fixed_seeded_at === null) {
      seedFixedExpenses(db, month.id);
      db.prepare('UPDATE months SET fixed_seeded_at = ? WHERE id = ?').run(getNowISO(), month.id);
    }

    const users = db.prepare('SELECT id FROM users').all() as { id: number }[];
    const upsertIncome = db.prepare(
      'INSERT OR IGNORE INTO monthly_incomes (month_id, user_id, amount) VALUES (?, ?, 0)',
    );
    for (const u of users) upsertIncome.run(month.id, u.id);

    return db.prepare('SELECT * FROM months WHERE id = ?').get(month.id) as MonthRow;
  });

  return initialize.immediate(yearMonth);
}

function seedFixedExpenses(db: Database.Database, monthId: number): void {
  const templates = db
    .prepare(
      `SELECT id, user_id, description, amount, note, display_order
       FROM fixed_expense_templates
       WHERE is_active = 1
       ORDER BY user_id ASC, display_order ASC, id ASC`,
    )
    .all() as {
    id: number;
    user_id: number;
    description: string;
    amount: number;
    note: string | null;
    display_order: number;
  }[];

  if (templates.length === 0) return;

  const insertExpense = db.prepare(
    `INSERT INTO expenses (month_id, user_id, description, amount, note, is_fixed, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
  );
  const now = getNowISO();
  templates.forEach((t, idx) => {
    insertExpense.run(monthId, t.user_id, t.description, t.amount, t.note, idx, now);
  });
}

export function loadMonthSnapshot(db: Database.Database, yearMonth: string): MonthSnapshot {
  const month = getOrCreateMonth(db, yearMonth);

  const incomes = db
    .prepare('SELECT user_id, amount FROM monthly_incomes WHERE month_id = ?')
    .all(month.id) as { user_id: number; amount: number }[];

  const expenses = db
    .prepare(
      `SELECT * FROM expenses WHERE month_id = ?
       ORDER BY user_id ASC, sort_order ASC, id ASC`,
    )
    .all(month.id) as ExpenseRow[];

  const users = db
    .prepare('SELECT id FROM users ORDER BY display_order ASC, id ASC')
    .all() as { id: number }[];

  const totals = new Map<number, number>();
  for (const u of users) totals.set(u.id, 0);
  for (const e of expenses) {
    totals.set(e.user_id, (totals.get(e.user_id) ?? 0) + e.amount);
  }

  const incomeMap = new Map(incomes.map((i) => [i.user_id, i.amount]));

  let settlement = { amount: 0, fromUserId: null as number | null, toUserId: null as number | null };
  if (users.length === 2) {
    const [a, b] = users;
    settlement = calculateSettlement(
      { userId: a.id, income: incomeMap.get(a.id) ?? 0, expense: totals.get(a.id) ?? 0 },
      { userId: b.id, income: incomeMap.get(b.id) ?? 0, expense: totals.get(b.id) ?? 0 },
    );
  }

  return {
    month: {
      id: month.id,
      year_month: month.year_month,
      is_closed: month.is_closed === 1,
      closed_at: month.closed_at,
      settlement_paid: month.settlement_paid === 1,
      settlement_paid_at: month.settlement_paid_at,
      fixed_seeded_at: month.fixed_seeded_at,
    },
    incomes: users.map((u) => ({ user_id: u.id, amount: incomeMap.get(u.id) ?? 0 })),
    expenses,
    settlement: {
      ...settlement,
      perUserTotals: users.map((u) => ({ user_id: u.id, total: totals.get(u.id) ?? 0 })),
    },
  };
}

export function ensureMonthOpen(month: MonthRow): void {
  if (month.is_closed === 1) {
    throw Object.assign(new Error('month is closed'), { httpStatus: 409 });
  }
}

export function getMonthRowOr404(db: Database.Database, yearMonth: string): MonthRow {
  const row = db
    .prepare('SELECT * FROM months WHERE year_month = ?')
    .get(yearMonth) as MonthRow | undefined;
  if (!row) {
    throw Object.assign(new Error('month not found'), { httpStatus: 404 });
  }
  return row;
}
