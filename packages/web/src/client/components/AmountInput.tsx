import { formatYen } from '../utils.js';

type Props = {
  value: number;
  onChange: (n: number) => void;
  onCommit?: (n: number) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
  ariaLabel?: string;
};

export default function AmountInput({
  value,
  onChange,
  onCommit,
  disabled,
  placeholder,
  className,
  id,
  ariaLabel,
}: Props) {
  return (
    <div
      className={`flex items-center rounded-xl border border-slate-300 bg-white focus-within:border-slate-900 focus-within:ring-1 focus-within:ring-slate-900 ${
        disabled ? 'opacity-60' : ''
      } ${className ?? ''}`}
    >
      <span className="pl-3 text-slate-500 tabular-nums">¥</span>
      <input
        id={id}
        aria-label={ariaLabel}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        disabled={disabled}
        placeholder={placeholder}
        value={value > 0 ? String(value) : ''}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^0-9]/g, '');
          onChange(digits === '' ? 0 : Number(digits));
        }}
        onBlur={(e) => {
          const digits = e.target.value.replace(/[^0-9]/g, '');
          onCommit?.(digits === '' ? 0 : Number(digits));
        }}
        className="flex-1 bg-transparent px-2 py-2.5 text-base tabular-nums outline-none disabled:cursor-not-allowed"
      />
      {value > 0 ? (
        <span className="pr-3 text-xs text-slate-400 tabular-nums" aria-hidden>
          {formatYen(value)}
        </span>
      ) : null}
    </div>
  );
}
