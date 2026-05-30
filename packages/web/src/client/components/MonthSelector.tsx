import { shiftMonth, formatYearMonthJa } from '../utils.js';

type Props = {
  value: string;
  onChange: (yyyymm: string) => void;
};

export default function MonthSelector({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(shiftMonth(value, -1))}
        className="h-10 w-10 flex items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 active:bg-slate-200"
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
        className="h-10 w-10 flex items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 active:bg-slate-200"
        aria-label="次の月"
      >
        ▶
      </button>
    </div>
  );
}
