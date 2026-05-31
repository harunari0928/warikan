import { useState } from 'react';
import type { MonthSnapshot, User } from '../types.js';
import { formatYen, formatYearMonthJa } from '../utils.js';
import AmountInput from './AmountInput.js';

type Props = {
  snapshot: MonthSnapshot;
  users: User[];
  onIncomeChange: (userId: number, amount: number) => Promise<void>;
  onPaidChange: (paid: boolean) => Promise<void>;
};

const USER_DOT_COLORS = ['bg-rose-500', 'bg-sky-500'];

export default function SummaryCard({ snapshot, users, onIncomeChange, onPaidChange }: Props) {
  const { month, incomes, settlement } = snapshot;
  const totalsByUser = new Map(settlement.perUserTotals.map((t) => [t.user_id, t.total]));
  const incomeByUser = new Map(incomes.map((i) => [i.user_id, i.amount]));

  const fromUser = users.find((u) => u.id === settlement.fromUserId);
  const toUser = users.find((u) => u.id === settlement.toUserId);
  const settled = settlement.amount === 0;

  const paidPanelClass = month.settlement_paid
    ? 'bg-emerald-50 border-emerald-200'
    : 'bg-slate-50 border-slate-200';

  return (
    <section
      className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-4"
      aria-label="月次サマリー"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">
          {formatYearMonthJa(month.year_month)}の精算
        </h2>
        {month.is_closed ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
            <span aria-hidden>🔒</span>
            締め済
          </span>
        ) : null}
      </div>

      <div className="space-y-2.5">
        {users.map((u, idx) => (
          <IncomeRow
            key={`${month.year_month}-${u.id}`}
            user={u}
            dotColor={USER_DOT_COLORS[idx % USER_DOT_COLORS.length]}
            value={incomeByUser.get(u.id) ?? 0}
            disabled={month.is_closed}
            onCommit={(n) => onIncomeChange(u.id, n)}
          />
        ))}
      </div>

      <div className="border-t border-slate-200 pt-3 space-y-1.5">
        {users.map((u, idx) => (
          <div key={u.id} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-slate-600">
              <span
                className={`h-2 w-2 rounded-full ${USER_DOT_COLORS[idx % USER_DOT_COLORS.length]}`}
                aria-hidden
              />
              {u.name}の支出合計
            </span>
            <span className="tabular-nums">¥{formatYen(totalsByUser.get(u.id) ?? 0)}</span>
          </div>
        ))}
      </div>

      <div className={`rounded-xl border p-3 space-y-2 ${paidPanelClass}`}>
        <div className="text-xs text-slate-500">精算結果</div>
        {settled ? (
          <div className="text-lg font-semibold text-slate-700">精算不要（同額）</div>
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="text-sm text-slate-600">
              {fromUser?.name ?? '?'} → {toUser?.name ?? '?'}
            </span>
            <span className="text-2xl font-semibold tabular-nums">
              ¥{formatYen(settlement.amount)}
            </span>
          </div>
        )}
        <label className="flex items-center gap-2 text-sm select-none cursor-pointer">
          <input
            type="checkbox"
            checked={month.settlement_paid}
            onChange={(e) => onPaidChange(e.target.checked)}
            className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          <span className={month.settlement_paid ? 'text-emerald-700 font-medium' : 'text-slate-700'}>
            精算済み
            {month.settlement_paid && month.settlement_paid_at
              ? ` (${month.settlement_paid_at.slice(5, 10).replace('-', '/')} 完了)`
              : ''}
          </span>
        </label>
      </div>
    </section>
  );
}

function IncomeRow({
  user,
  dotColor,
  value,
  disabled,
  onCommit,
}: {
  user: User;
  dotColor: string;
  value: number;
  disabled: boolean;
  onCommit: (n: number) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 text-sm text-slate-600 w-24 shrink-0">
        <span className={`h-2 w-2 rounded-full ${dotColor}`} aria-hidden />
        {user.name}の手取り
      </div>
      <AmountInput
        value={value === draft ? value : draft}
        disabled={disabled}
        onChange={setDraft}
        onCommit={(n) => {
          if (n !== value) onCommit(n);
        }}
        ariaLabel={`${user.name}の手取り`}
        className="flex-1"
      />
    </div>
  );
}
