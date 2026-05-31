import { shiftMonth, formatYearMonthJa, getCurrentMonthLocal } from '../utils.js';

type Props = {
  value: string;
  onChange: (yyyymm: string) => void;
};

export default function MonthSelector({ value, onChange }: Props) {
  // 当月より先の月（まだ到来していない月）には進めない
  const atCurrentMonth = value >= getCurrentMonthLocal();

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(shiftMonth(value, -1))}
        className="h-10 w-10 flex items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 active:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-800 dark:active:bg-slate-700"
        aria-label="前の月"
      >
        ◀
      </button>
      <div className="text-base font-semibold tabular-nums px-1 min-w-[5.5rem] text-center">
        {formatYearMonthJa(value)}
      </div>
      <button
        type="button"
        onClick={() => onChange(shiftMonth(value, 1))}
        disabled={atCurrentMonth}
        className="h-10 w-10 flex items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 active:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-800 dark:active:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
        aria-label="次の月"
      >
        ▶
      </button>
    </div>
  );
}
