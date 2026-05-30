import { useEffect, useState } from 'react';
import type { Expense } from '../types.js';
import AmountInput from './AmountInput.js';

export type ExpenseDialogValues = {
  description: string;
  amount: number;
  note: string;
};

type Props = {
  open: boolean;
  initial: Expense | null;
  onClose: () => void;
  onSubmit: (values: ExpenseDialogValues) => Promise<void>;
};

export default function ExpenseDialog({ open, initial, onClose, onSubmit }: Props) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={initial ? '支出を編集' : '支出を追加'}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-2 sm:hidden" aria-hidden>
          <div className="h-1 w-10 rounded-full bg-slate-300" />
        </div>
        <div className="px-5 pt-3 pb-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold">{initial ? '支出を編集' : '支出を追加'}</h3>
            <button
              type="button"
              onClick={onClose}
              className="h-10 w-10 -mr-2 rounded-lg hover:bg-slate-100 text-slate-500"
              aria-label="閉じる"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="text-xs text-slate-600">説明</span>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="例: 食費"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none"
                autoFocus
              />
            </label>

            <label className="block">
              <span className="text-xs text-slate-600">金額</span>
              <div className="mt-1">
                <AmountInput value={amount} onChange={setAmount} ariaLabel="金額" />
              </div>
            </label>

            <label className="block">
              <span className="text-xs text-slate-600">備考 (任意)</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none"
              />
            </label>
          </div>

          <div className="mt-6 flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 px-4 rounded-xl text-slate-700 hover:bg-slate-100"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="min-h-11 px-5 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              {initial ? '保存' : '追加'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
