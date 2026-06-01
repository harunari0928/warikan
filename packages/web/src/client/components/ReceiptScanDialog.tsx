import { useEffect, useRef, useState } from 'react';
import { formatYen, resizeImageToDataUrl } from '../utils.js';

type ScannedItem = { name: string; taxRate: number; amount: number };

type Phase = 'capture' | 'loading' | 'review' | 'error';

type Props = {
  open: boolean;
  yearMonth: string;
  userId: number | null;
  onClose: () => void;
  onAdded: () => void | Promise<void>;
};

export default function ReceiptScanDialog({ open, yearMonth, userId, onClose, onAdded }: Props) {
  const [phase, setPhase] = useState<Phase>('capture');
  const [items, setItems] = useState<ScannedItem[]>([]);
  const [store, setStore] = useState<string | null>(null);
  const [selected, setSelected] = useState<boolean[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPhase('capture');
      setItems([]);
      setStore(null);
      setSelected([]);
      setErrorMsg('');
      setSubmitting(false);
    }
  }, [open]);

  if (!open) return null;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhase('loading');
    try {
      const image = await resizeImageToDataUrl(file);
      const res = await fetch('/api/ocr/receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, filename: file.name }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErrorMsg(body.error ?? 'レシートを読み取れませんでした');
        setPhase('error');
        return;
      }
      const data = (await res.json()) as { store: string | null; items: ScannedItem[] };
      setStore(data.store);
      setItems(data.items);
      setSelected(data.items.map(() => true));
      setPhase('review');
    } catch {
      setErrorMsg('レシートを読み取れませんでした');
      setPhase('error');
    }
  };

  const toggle = (i: number) => {
    setSelected((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  };

  const selectedCount = selected.filter(Boolean).length;
  const allSelected = items.length > 0 && selectedCount === items.length;
  const toggleAll = () => {
    setSelected(items.map(() => !allSelected));
  };
  const selectedTotal = items.reduce((sum, item, i) => (selected[i] ? sum + item.amount : sum), 0);

  const handleAdd = async () => {
    if (userId === null || selectedCount === 0 || submitting) return;
    setSubmitting(true);
    try {
      const chosen = items.filter((_, i) => selected[i]);
      for (const item of chosen) {
        await fetch(`/api/months/${yearMonth}/expenses`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            description: item.name,
            amount: item.amount,
            note: store ?? null,
          }),
        });
      }
      await onAdded();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="レシートから追加"
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
            <h3 className="text-base font-semibold">レシートから追加</h3>
            <button
              type="button"
              onClick={onClose}
              className="h-10 w-10 -mr-2 rounded-lg hover:bg-slate-100 text-slate-500"
              aria-label="閉じる"
            >
              ✕
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            aria-label="レシート画像"
            className="hidden"
            onChange={handleFile}
          />

          {phase === 'capture' ? (
            <div className="py-4 flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 text-3xl" aria-hidden>
                🧾
              </div>
              <p className="mt-4 text-sm text-slate-600 leading-relaxed max-w-[16rem]">
                レシートを撮影すると、品目と金額を自動で読み取って一覧にします。
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-5 w-full min-h-11 px-5 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 active:bg-slate-950"
              >
                レシートを撮影
              </button>
              <p className="mt-2 text-xs text-slate-400">読み取った明細はあとから選べます</p>
            </div>
          ) : null}

          {phase === 'loading' ? (
            <div className="py-10 text-center text-sm text-slate-500" role="status">
              レシートを読み取っています…
            </div>
          ) : null}

          {phase === 'error' ? (
            <div className="py-4 space-y-4">
              <div className="flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50 text-red-700 p-3 text-sm">
                <span className="shrink-0 leading-5" aria-hidden>⚠️</span>
                <span className="leading-5">{errorMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full min-h-11 px-5 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 active:bg-slate-950"
              >
                もう一度撮影
              </button>
            </div>
          ) : null}

          {phase === 'review' ? (
            <div className="space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs text-slate-600">割り勘に入れる明細を選んでください</p>
                {store ? (
                  <span className="shrink-0 text-xs text-slate-500 bg-slate-100 rounded-full px-2 py-0.5 truncate max-w-[10rem]">
                    {store}
                  </span>
                ) : null}
              </div>

              <div className="flex items-center justify-between px-1">
                <span className="text-xs text-slate-500 tabular-nums">
                  {items.length}件中 {selectedCount}件を選択中
                </span>
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-xs font-medium text-slate-700 underline-offset-2 hover:underline"
                >
                  {allSelected ? 'すべて解除' : 'すべて選択'}
                </button>
              </div>

              <ul className="rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                {items.map((item, i) => {
                  const checked = selected[i] ?? false;
                  return (
                    <li key={i}>
                      <label
                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                          checked ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/60 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(i)}
                          aria-label={item.name}
                          className="h-5 w-5 shrink-0 accent-slate-900"
                        />
                        <span className="flex-1 min-w-0 flex items-center gap-2">
                          <span className={`text-sm truncate ${checked ? 'text-slate-900' : 'text-slate-400'}`}>
                            {item.name}
                          </span>
                          <span className="shrink-0 text-[10px] font-medium text-slate-500 bg-slate-100 rounded px-1.5 py-0.5 tabular-nums">
                            {Math.round(item.taxRate * 100)}%
                          </span>
                        </span>
                        <span
                          className={`text-sm tabular-nums shrink-0 ${checked ? 'text-slate-900' : 'text-slate-400'}`}
                        >
                          ¥{formatYen(item.amount)}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>

              <div className="flex items-center justify-between px-1 pt-1">
                <span className="text-xs text-slate-500">選択中の合計</span>
                <span className="text-base font-semibold tabular-nums text-slate-900">
                  ¥{formatYen(selectedTotal)}
                </span>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-11 px-4 rounded-xl text-slate-700 hover:bg-slate-100"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={selectedCount === 0 || submitting || userId === null}
                  className="flex-1 min-h-11 px-5 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 active:bg-slate-950 disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  {selectedCount}件を追加
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
