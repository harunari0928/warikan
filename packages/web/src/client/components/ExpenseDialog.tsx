import { useEffect, useRef, useState } from 'react';
import type { Expense } from '../types.js';
import AmountInput from './AmountInput.js';
import {
  DEFAULT_FIELD_ORDER,
  useExpenseFieldOrder,
  type ExpenseFieldKey,
} from '../hooks/useExpenseFieldOrder.js';

export type ExpenseDialogValues = {
  description: string;
  amount: number;
  note: string;
};

type Props = {
  open: boolean;
  initial: Expense | null;
  userId: number | null;
  onClose: () => void;
  onSubmit: (values: ExpenseDialogValues) => Promise<void>;
};

/** この距離を超えて縦に動かしたら「説明」と「金額」を入れ替える。 */
const SWAP_THRESHOLD_PX = 36;

export default function ExpenseDialog({ open, initial, userId, onClose, onSubmit }: Props) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [order, setOrder] = useExpenseFieldOrder(userId);
  const [dragging, setDragging] = useState<ExpenseFieldKey | null>(null);
  const dragRef = useRef<{
    key: ExpenseFieldKey;
    startY: number;
    startIndex: number;
  } | null>(null);

  useEffect(() => {
    if (open) {
      setDescription(initial?.description ?? '');
      setAmount(initial?.amount ?? 0);
      setNote(initial?.note ?? '');
      setSubmitting(false);
    }
  }, [open, initial]);

  if (!open) return null;

  const canSubmit = description.trim() !== '' && amount > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit({ description: description.trim(), amount, note });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePointerDown = (key: ExpenseFieldKey) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { key, startY: e.clientY, startIndex: order.indexOf(key) };
    setDragging(key);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const state = dragRef.current;
    if (!state) return;
    const dy = e.clientY - state.startY;
    const other: ExpenseFieldKey = state.key === 'description' ? 'amount' : 'description';
    // ドラッグ開始位置からの向きだけで並びを決める。同方向に動かし続けても
    // 一度入れ替わったら戻らず、逆向きに戻したときだけ元へ戻る。
    let next: ExpenseFieldKey[];
    if (state.startIndex === 0) {
      next = dy > SWAP_THRESHOLD_PX ? [other, state.key] : [state.key, other];
    } else {
      next = dy < -SWAP_THRESHOLD_PX ? [state.key, other] : [other, state.key];
    }
    if (next[0] !== order[0]) setOrder(next);
  };

  const endDrag = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragRef.current = null;
    setDragging(null);
  };

  const isReordered = order[0] !== DEFAULT_FIELD_ORDER[0];

  const renderField = (key: ExpenseFieldKey) => {
    const label = key === 'description' ? '説明' : '金額';
    return (
      <div
        key={key}
        className={`rounded-xl transition-transform ${
          dragging === key
            ? 'relative z-10 shadow-lg ring-1 ring-slate-300 dark:ring-slate-600'
            : ''
        }`}
      >
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={`${label}の並び替え`}
            onPointerDown={handlePointerDown(key)}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className="h-9 w-7 -ml-1 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-grab active:cursor-grabbing touch-none select-none"
          >
            <svg width="12" height="16" viewBox="0 0 12 16" aria-hidden fill="currentColor">
              <circle cx="3" cy="3" r="1.4" />
              <circle cx="9" cy="3" r="1.4" />
              <circle cx="3" cy="8" r="1.4" />
              <circle cx="9" cy="8" r="1.4" />
              <circle cx="3" cy="13" r="1.4" />
              <circle cx="9" cy="13" r="1.4" />
            </svg>
          </button>
          <label className="block flex-1 min-w-0">
            <span className="text-xs text-slate-600 dark:text-slate-400">{label}</span>
            {key === 'description' ? (
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="例: 食費"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none dark:border-slate-700 dark:bg-slate-800 dark:focus:border-slate-400 dark:focus:ring-slate-400"
                autoFocus
              />
            ) : (
              <div className="mt-1">
                <AmountInput value={amount} onChange={setAmount} ariaLabel="金額" />
              </div>
            )}
          </label>
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={initial ? '支出を編集' : '支出を追加'}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white dark:bg-slate-900 dark:text-slate-100 rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-2 sm:hidden" aria-hidden>
          <div className="h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
        </div>
        <div className="px-5 pt-3 pb-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold">{initial ? '支出を編集' : '支出を追加'}</h3>
            <button
              type="button"
              onClick={onClose}
              className="h-10 w-10 -mr-2 rounded-lg hover:bg-slate-100 text-slate-500 dark:hover:bg-slate-800 dark:text-slate-400"
              aria-label="閉じる"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            {order.map((key) => renderField(key))}

            <label className="block">
              <span className="text-xs text-slate-600 dark:text-slate-400">備考 (任意)</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none dark:border-slate-700 dark:bg-slate-800 dark:focus:border-slate-400 dark:focus:ring-slate-400"
              />
            </label>
          </div>

          <p className="sr-only" aria-live="polite">
            {isReordered ? '金額が上、説明が下の並び順です' : '説明が上、金額が下の並び順です'}
          </p>

          <div className="mt-6 flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 px-4 rounded-xl text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="min-h-11 px-5 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white dark:disabled:bg-slate-700 dark:disabled:text-slate-500"
            >
              {initial ? '保存' : '追加'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
