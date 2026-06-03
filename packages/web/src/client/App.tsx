import { useEffect, useMemo, useState } from 'react';
import { calculateSettlement } from '@warikan/shared';
import Header from './components/Header.js';
import SummaryCard from './components/SummaryCard.js';
import ExpenseList from './components/ExpenseList.js';
import ExpenseDialog from './components/ExpenseDialog.js';
import ReceiptScanDialog from './components/ReceiptScanDialog.js';
import CloseMonthButton from './components/CloseMonthButton.js';
import FixedTemplateAdmin from './components/FixedTemplateAdmin.js';
import { useToast } from './components/Toast.js';
import { useUsers } from './hooks/useUsers.js';
import { useCurrentUser } from './hooks/useCurrentUser.js';
import { useMonth } from './hooks/useMonth.js';
import { useTheme } from './hooks/useTheme.js';
import { getCurrentMonthLocal } from './utils.js';
import type { Expense, MonthSnapshot } from './types.js';

type Page = 'home' | 'templates';

const SAVE_ERROR_MSG = '保存に失敗しました。通信環境を確認してください';
const JSON_HEADERS = { 'Content-Type': 'application/json' };

function getPage(): Page {
  return window.location.hash === '#/templates' ? 'templates' : 'home';
}

/** 手取り・支出合計から精算結果をクライアント側で再計算する（楽観的更新で即座に反映するため）。 */
function recomputeSettlement(
  incomes: MonthSnapshot['incomes'],
  perUserTotals: MonthSnapshot['settlement']['perUserTotals'],
): MonthSnapshot['settlement'] {
  if (incomes.length !== 2) {
    return { amount: 0, fromUserId: null, toUserId: null, perUserTotals };
  }
  const totalOf = (userId: number) => perUserTotals.find((t) => t.user_id === userId)?.total ?? 0;
  const [a, b] = incomes;
  const result = calculateSettlement(
    { userId: a.user_id, income: a.amount, expense: totalOf(a.user_id) },
    { userId: b.user_id, income: b.amount, expense: totalOf(b.user_id) },
  );
  return { ...result, perUserTotals };
}

/** 支出一覧を差し替え、各人の支出合計と精算結果を再計算した snapshot を返す。 */
function withExpenses(prev: MonthSnapshot, expenses: Expense[]): MonthSnapshot {
  const perUserTotals = prev.settlement.perUserTotals.map((t) => ({
    user_id: t.user_id,
    total: expenses
      .filter((e) => e.user_id === t.user_id)
      .reduce((sum, e) => sum + e.amount, 0),
  }));
  return { ...prev, expenses, settlement: recomputeSettlement(prev.incomes, perUserTotals) };
}

export default function App() {
  const [page, setPage] = useState<Page>(getPage);
  const [yearMonth, setYearMonth] = useState<string>(getCurrentMonthLocal());

  useEffect(() => {
    const handler = () => setPage(getPage());
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  const toast = useToast();
  const { theme, toggleTheme } = useTheme();
  const { users } = useUsers();
  const { currentUserId, selectUser } = useCurrentUser(users);
  const { snapshot, setSnapshot, loading, error, refetch } = useMonth(yearMonth);

  const userExpenses = useMemo<Expense[]>(() => {
    if (!snapshot || currentUserId === null) return [];
    return snapshot.expenses.filter((e) => e.user_id === currentUserId);
  }, [snapshot, currentUserId]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  // 楽観的に snapshot を更新 → API 呼び出し。失敗したら直前の状態へロールバックしトーストで通知する。
  // snapshot を返すエンドポイント（手取り・精算済み・締め/解除）用。
  const runSnapshotMutation = async (
    optimistic: (prev: MonthSnapshot) => MonthSnapshot,
    request: () => Promise<Response>,
  ) => {
    const prev = snapshot;
    if (prev) setSnapshot(optimistic(prev));
    try {
      const res = await request();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSnapshot(await res.json());
    } catch {
      setSnapshot(prev);
      toast.error(SAVE_ERROR_MSG);
    }
  };

  // 支出系エンドポイントは個別の行を返すため、成功後は refetch で真の状態に同期する。
  const runExpenseMutation = async (
    nextExpenses: (prev: MonthSnapshot) => Expense[],
    request: () => Promise<Response>,
  ) => {
    const prev = snapshot;
    if (prev) setSnapshot(withExpenses(prev, nextExpenses(prev)));
    try {
      const res = await request();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await refetch();
    } catch {
      setSnapshot(prev);
      toast.error(SAVE_ERROR_MSG);
    }
  };

  const handleIncomeChange = async (userId: number, amount: number) => {
    await runSnapshotMutation(
      (prev) => {
        const incomes = prev.incomes.map((i) => (i.user_id === userId ? { ...i, amount } : i));
        return { ...prev, incomes, settlement: recomputeSettlement(incomes, prev.settlement.perUserTotals) };
      },
      () =>
        fetch(`/api/months/${yearMonth}/incomes/${userId}`, {
          method: 'PUT',
          headers: JSON_HEADERS,
          body: JSON.stringify({ amount }),
        }),
    );
  };

  const handlePaidChange = async (paid: boolean) => {
    await runSnapshotMutation(
      (prev) => ({ ...prev, month: { ...prev.month, settlement_paid: paid } }),
      () =>
        fetch(`/api/months/${yearMonth}/settlement-paid`, {
          method: 'PUT',
          headers: JSON_HEADERS,
          body: JSON.stringify({ paid }),
        }),
    );
  };

  const handleClose = async () => {
    await runSnapshotMutation(
      (prev) => ({ ...prev, month: { ...prev.month, is_closed: true } }),
      () => fetch(`/api/months/${yearMonth}/close`, { method: 'POST' }),
    );
  };

  const handleOpen = async () => {
    await runSnapshotMutation(
      (prev) => ({ ...prev, month: { ...prev.month, is_closed: false } }),
      () => fetch(`/api/months/${yearMonth}/open`, { method: 'POST' }),
    );
  };

  const handleSubmitExpense = async (values: {
    description: string;
    amount: number;
    note: string;
  }) => {
    if (currentUserId === null || !snapshot) return;
    const note = values.note || null;
    const target = editingExpense;

    // 楽観的反映と同時にダイアログを閉じ、ユーザーを待たせない。失敗時はロールバックされる。
    setDialogOpen(false);
    setEditingExpense(null);

    if (target) {
      await runExpenseMutation(
        (prev) =>
          prev.expenses.map((e) =>
            e.id === target.id ? { ...e, description: values.description, amount: values.amount, note } : e,
          ),
        () =>
          fetch(`/api/months/${yearMonth}/expenses/${target.id}`, {
            method: 'PATCH',
            headers: JSON_HEADERS,
            body: JSON.stringify({ description: values.description, amount: values.amount, note }),
          }),
      );
    } else {
      const optimisticExpense: Expense = {
        id: -Date.now(),
        month_id: snapshot.month.id,
        user_id: currentUserId,
        description: values.description,
        amount: values.amount,
        note,
        is_fixed: 0,
        sort_order: Number.MAX_SAFE_INTEGER,
        created_at: '',
      };
      await runExpenseMutation(
        (prev) => [...prev.expenses, optimisticExpense],
        () =>
          fetch(`/api/months/${yearMonth}/expenses`, {
            method: 'POST',
            headers: JSON_HEADERS,
            body: JSON.stringify({
              user_id: currentUserId,
              description: values.description,
              amount: values.amount,
              note,
            }),
          }),
      );
    }
  };

  const handleDeleteExpense = async (expense: Expense) => {
    if (!window.confirm(`「${expense.description}」を削除しますか？`)) return;
    await runExpenseMutation(
      (prev) => prev.expenses.filter((e) => e.id !== expense.id),
      () => fetch(`/api/months/${yearMonth}/expenses/${expense.id}`, { method: 'DELETE' }),
    );
  };

  const isClosed = snapshot?.month.is_closed ?? false;

  if (page === 'templates') {
    return (
      <FixedTemplateAdmin
        users={users}
        onBack={() => {
          window.location.hash = '';
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Header
        yearMonth={yearMonth}
        onMonthChange={setYearMonth}
        users={users}
        currentUserId={currentUserId}
        onUserChange={selectUser}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenSettings={() => {
          window.location.hash = '#/templates';
        }}
      />

      <main className="px-4 py-4 space-y-4 pb-32 max-w-2xl mx-auto">
        {loading && !snapshot ? (
          <div className="text-center text-slate-500 dark:text-slate-400 py-12 text-sm">読み込み中…</div>
        ) : error ? (
          <div className="rounded-xl bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 p-3 text-sm">エラー: {error}</div>
        ) : snapshot ? (
          <>
            <SummaryCard
              snapshot={snapshot}
              users={users}
              currentUserId={currentUserId}
              onIncomeChange={handleIncomeChange}
              onPaidChange={handlePaidChange}
            />
            <ExpenseList
              expenses={userExpenses}
              closed={isClosed}
              onEdit={(e) => {
                setEditingExpense(e);
                setDialogOpen(true);
              }}
              onDelete={handleDeleteExpense}
            />
            <div className="flex justify-center pt-2">
              <CloseMonthButton
                yearMonth={yearMonth}
                closed={isClosed}
                onClose={handleClose}
                onOpen={handleOpen}
              />
            </div>
            {users.length < 2 ? (
              <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950 dark:border-amber-900 dark:text-amber-200 text-sm p-3">
                ユーザーが2人未満です。設定からユーザーを追加してください（妻と夫の2人で利用します）。
              </div>
            ) : null}
          </>
        ) : null}
      </main>

      {!isClosed && currentUserId !== null ? (
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          style={{ position: 'fixed', right: '1rem', bottom: '1.5rem', zIndex: 40 }}
          className="h-14 w-14 rounded-full bg-slate-900 text-white text-3xl leading-none shadow-lg hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          aria-label="支出を追加"
        >
          ＋
        </button>
      ) : null}

      {menuOpen ? (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="追加方法を選択"
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-2 sm:hidden" aria-hidden>
              <div className="h-1 w-10 rounded-full bg-slate-300" />
            </div>
            <div className="px-5 pt-3 pb-3">
              <h3 className="text-base font-semibold mb-3">支出を追加</h3>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setEditingExpense(null);
                    setDialogOpen(true);
                  }}
                  className="w-full flex items-center gap-3 min-h-14 px-4 rounded-xl border border-slate-200 text-left hover:bg-slate-50 active:bg-slate-100"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-lg" aria-hidden>
                    ✏️
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-slate-900">手入力で追加</span>
                    <span className="block text-xs text-slate-500">説明と金額を入力する</span>
                  </span>
                  <span className="shrink-0 text-slate-300" aria-hidden>›</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setScanOpen(true);
                  }}
                  className="w-full flex items-center gap-3 min-h-14 px-4 rounded-xl border border-slate-200 text-left hover:bg-slate-50 active:bg-slate-100"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-lg" aria-hidden>
                    🧾
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-slate-900">レシートを撮影</span>
                    <span className="block text-xs text-slate-500">明細を自動で読み取る</span>
                  </span>
                  <span className="shrink-0 text-slate-300" aria-hidden>›</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ExpenseDialog
        open={dialogOpen}
        initial={editingExpense}
        onClose={() => {
          setDialogOpen(false);
          setEditingExpense(null);
        }}
        onSubmit={handleSubmitExpense}
      />

      <ReceiptScanDialog
        open={scanOpen}
        yearMonth={yearMonth}
        userId={currentUserId}
        onClose={() => setScanOpen(false)}
        onAdded={refetch}
      />
    </div>
  );
}
