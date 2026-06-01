import { useCallback, useEffect, useMemo, useState } from 'react';
import Header from './components/Header.js';
import SummaryCard from './components/SummaryCard.js';
import ExpenseList from './components/ExpenseList.js';
import ExpenseDialog from './components/ExpenseDialog.js';
import ReceiptScanDialog from './components/ReceiptScanDialog.js';
import CloseMonthButton from './components/CloseMonthButton.js';
import FixedTemplateAdmin from './components/FixedTemplateAdmin.js';
import { useUsers } from './hooks/useUsers.js';
import { useCurrentUser } from './hooks/useCurrentUser.js';
import { useMonth } from './hooks/useMonth.js';
import { useTheme } from './hooks/useTheme.js';
import { getCurrentMonthLocal } from './utils.js';
import type { Expense, MonthSnapshot } from './types.js';

type Page = 'home' | 'templates';

function getPage(): Page {
  return window.location.hash === '#/templates' ? 'templates' : 'home';
}

export default function App() {
  const [page, setPage] = useState<Page>(getPage);
  const [yearMonth, setYearMonth] = useState<string>(getCurrentMonthLocal());

  useEffect(() => {
    const handler = () => setPage(getPage());
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

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

  const updateSnapshot = useCallback((updater: (prev: MonthSnapshot) => MonthSnapshot) => {
    setSnapshot((prev) => (prev ? updater(prev) : prev));
  }, [setSnapshot]);

  const handleIncomeChange = async (userId: number, amount: number) => {
    const res = await fetch(`/api/months/${yearMonth}/incomes/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount }),
    });
    if (res.ok) setSnapshot(await res.json());
  };

  const handlePaidChange = async (paid: boolean) => {
    const res = await fetch(`/api/months/${yearMonth}/settlement-paid`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paid }),
    });
    if (res.ok) setSnapshot(await res.json());
  };

  const handleClose = async () => {
    const res = await fetch(`/api/months/${yearMonth}/close`, { method: 'POST' });
    if (res.ok) setSnapshot(await res.json());
  };

  const handleOpen = async () => {
    const res = await fetch(`/api/months/${yearMonth}/open`, { method: 'POST' });
    if (res.ok) setSnapshot(await res.json());
  };

  const handleSubmitExpense = async (values: {
    description: string;
    amount: number;
    note: string;
  }) => {
    if (currentUserId === null) return;
    if (editingExpense) {
      const res = await fetch(`/api/months/${yearMonth}/expenses/${editingExpense.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, note: values.note || null }),
      });
      if (!res.ok) return;
    } else {
      const res = await fetch(`/api/months/${yearMonth}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUserId,
          description: values.description,
          amount: values.amount,
          note: values.note || null,
        }),
      });
      if (!res.ok) return;
    }
    await refetch();
    setDialogOpen(false);
    setEditingExpense(null);
  };

  const handleDeleteExpense = async (expense: Expense) => {
    if (!window.confirm(`「${expense.description}」を削除しますか？`)) return;
    const res = await fetch(`/api/months/${yearMonth}/expenses/${expense.id}`, {
      method: 'DELETE',
    });
    if (res.ok) await refetch();
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
