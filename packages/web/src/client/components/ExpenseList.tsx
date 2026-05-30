import type { Expense } from '../types.js';
import { formatYen } from '../utils.js';

type Props = {
  expenses: Expense[];
  closed: boolean;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
};

export default function ExpenseList({ expenses, closed, onEdit, onDelete }: Props) {
  if (expenses.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-slate-500 dark:text-slate-400 text-sm">
        今月の支出はまだありません
      </div>
    );
  }

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <section className="space-y-2" aria-label="支出リスト">
      <div className="flex items-baseline justify-between px-1">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">支出 ({expenses.length}件)</h3>
        <span className="text-sm tabular-nums text-slate-600 dark:text-slate-300">¥{formatYen(total)}</span>
      </div>
      <ul className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
        {expenses.map((e) => (
          <li key={e.id} className="flex items-center gap-2 pr-2">
            <button
              type="button"
              onClick={() => !closed && onEdit(e)}
              disabled={closed}
              className={`flex-1 min-w-0 flex items-center gap-3 px-4 py-3 text-left ${
                closed ? 'cursor-default' : 'hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-slate-800 dark:active:bg-slate-700'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium truncate ${closed ? 'text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-slate-100'}`}>
                  {e.description}
                  {e.is_fixed === 1 ? (
                    <span className="ml-2 text-[10px] text-slate-500 bg-slate-100 dark:text-slate-400 dark:bg-slate-800 rounded px-1.5 py-0.5 align-middle">
                      固定
                    </span>
                  ) : null}
                </div>
                {e.note ? (
                  <div className={`text-xs truncate ${closed ? 'text-slate-300 dark:text-slate-600' : 'text-slate-500 dark:text-slate-400'}`}>{e.note}</div>
                ) : null}
              </div>
              <div className={`text-sm tabular-nums shrink-0 ${closed ? 'text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-slate-100'}`}>
                ¥{formatYen(e.amount)}
              </div>
            </button>
            {!closed ? (
              <button
                type="button"
                onClick={() => onDelete(e)}
                className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                aria-label="削除"
              >
                🗑
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
