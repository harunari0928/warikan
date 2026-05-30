import { useCallback, useEffect, useMemo, useState } from 'react';
import Header from './components/Header.js';
import SummaryCard from './components/SummaryCard.js';
import ExpenseList from './components/ExpenseList.js';
import ExpenseDialog from './components/ExpenseDialog.js';
import CloseMonthButton from './components/CloseMonthButton.js';
import FixedTemplateAdmin from './components/FixedTemplateAdmin.js';
import { useUsers } from './hooks/useUsers.js';
import { useCurrentUser } from './hooks/useCurrentUser.js';
import { useMonth } from './hooks/useMonth.js';
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

  const { users } = useUsers();
  const { currentUserId, selectUser } = useCurrentUser(users);
  const { snapshot, setSnapshot, loading, error, refetch } = useMonth(yearMonth);

  const userExpenses = useMemo<Expense[]>(() => {
    if (!snapshot || currentUserId === null) return [];
    return snapshot.expenses.filter((e) => e.user_id === currentUserId);
  }, [snapshot, currentUserId]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Header
        yearMonth={yearMonth}
        onMonthChange={setYearMonth}
        users={users}
        currentUserId={currentUserId}
        onUserChange={selectUser}
        onOpenSettings={() => {
          window.location.hash = '#/templates';
        }}
      />

      <main className="px-4 py-4 space-y-4 pb-32 max-w-2xl mx-auto">
        {loading && !snapshot ? (
          <div className="text-center text-slate-500 py-12 text-sm">読み込み中…</div>
        ) : error ? (
          <div className="rounded-xl bg-red-50 text-red-700 p-3 text-sm">エラー: {error}</div>
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
              <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm p-3">
                ユーザーが2人未満です。設定からユーザーを追加してください（妻と夫の2人で利用します）。
              </div>
            ) : null}
          </>
        ) : null}
      </main>

      {!isClosed && currentUserId !== null ? (
        <button
          type="button"
          onClick={() => {
            setEditingExpense(null);
            setDialogOpen(true);
          }}
          style={{ position: 'fixed', right: '1rem', bottom: '1.5rem', zIndex: 40 }}
          className="h-14 w-14 rounded-full bg-slate-900 text-white text-3xl leading-none shadow-lg hover:bg-slate-800"
          aria-label="支出を追加"
        >
          ＋
        </button>
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
    </div>
  );
}
