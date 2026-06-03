import { useEffect, useRef, useState } from 'react';
import { formatYen, resizeImageToDataUrl } from '../utils.js';

// taxRate is null when OCR could not determine it (要確認). amount は税込整数円。
type ScannedItem = { name: string; taxRate: number | null; amount: number };

// レビュー用に保持する明細。baseAmount/baseRate は不変の基準値で、
// 税率を切り替えるたびに「税抜に戻して新税率を掛け直す」ことで再計算する（丸め誤差の累積を防ぐ）。
type ReviewItem = {
  name: string;
  baseAmount: number;
  baseRate: number | null;
  rate: number | null;
};

const REDUCED = 0.08; // 軽減税率
const STANDARD = 0.1; // 標準税率

// 現在の税率に基づく税込金額。未設定(要確認)のあいだは読み取った金額をそのまま使う。
function displayAmount(item: ReviewItem): number {
  if (item.rate === null || item.baseRate === null) return item.baseAmount;
  return Math.round((item.baseAmount / (1 + item.baseRate)) * (1 + item.rate));
}

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
  const [items, setItems] = useState<ReviewItem[]>([]);
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
      setItems(
        data.items.map((it) => ({
          name: it.name,
          baseAmount: it.amount,
          baseRate: it.taxRate,
          rate: it.taxRate,
        })),
      );
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

  // 税率バッジのタップ: 未設定なら軽減税率を採用（その税率を基準として確定し金額は変えない）、
  // 以降は 8% ⇔ 10% を切り替える。
  const cycleRate = (i: number) => {
    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== i) return item;
        if (item.rate === null) return { ...item, rate: REDUCED, baseRate: REDUCED };
        const next = item.rate === REDUCED ? STANDARD : REDUCED;
        return { ...item, rate: next };
      }),
    );
  };

  const selectedCount = selected.filter(Boolean).length;
  const allSelected = items.length > 0 && selectedCount === items.length;
  const toggleAll = () => {
    setSelected(items.map(() => !allSelected));
  };
  const selectedTotal = items.reduce(
    (sum, item, i) => (selected[i] ? sum + displayAmount(item) : sum),
    0,
  );
  const hasUnresolved = items.some((it) => it.rate === null);
  const hasUnresolvedSelected = items.some((it, i) => selected[i] && it.rate === null);

  const handleAdd = async () => {
    if (userId === null || selectedCount === 0 || submitting || hasUnresolvedSelected) return;
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
            amount: displayAmount(item),
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

              {hasUnresolved ? (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 px-3 py-2 text-xs leading-5">
                  <span className="shrink-0" aria-hidden>⚠️</span>
                  <span>税率が読み取れなかった明細があります。税率を選んでください。</span>
                </div>
              ) : null}

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
                    <li
                      key={i}
                      className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                        checked ? 'bg-white' : 'bg-slate-50/60'
                      }`}
                    >
                      <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(i)}
                          aria-label={item.name}
                          className="h-5 w-5 shrink-0 accent-slate-900"
                        />
                        <span className={`text-sm truncate ${checked ? 'text-slate-900' : 'text-slate-400'}`}>
                          {item.name}
                        </span>
                      </label>
                      <TaxRateButton item={item} checked={checked} onCycle={() => cycleRate(i)} />
                      <span
                        className={`text-sm tabular-nums shrink-0 w-16 text-right ${
                          checked ? 'text-slate-900' : 'text-slate-400'
                        }`}
                      >
                        ¥{formatYen(displayAmount(item))}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <div className="flex items-center justify-between px-1 pt-1">
                <span className="text-xs text-slate-500">選択中の合計</span>
                <span className="text-base font-semibold tabular-nums text-slate-900" aria-live="polite">
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
                  disabled={selectedCount === 0 || submitting || userId === null || hasUnresolvedSelected}
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

// 税率バッジ。タップで 8% ⇔ 10% を切り替える。未設定(要確認)は amber で目立たせる。
function TaxRateButton({
  item,
  checked,
  onCycle,
}: {
  item: ReviewItem;
  checked: boolean;
  onCycle: () => void;
}) {
  const base =
    'inline-flex items-center gap-0.5 shrink-0 min-h-11 px-2 -my-2 rounded-md border text-[11px] font-semibold tabular-nums transition-colors active:scale-[0.97]';

  if (item.rate === null) {
    return (
      <button
        type="button"
        onClick={onCycle}
        aria-label={`${item.name}の税率: 未設定（タップで選択）`}
        className={`${base} ${
          checked
            ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
            : 'border-amber-200 bg-amber-50/60 text-amber-600 hover:bg-amber-100'
        }`}
      >
        <span aria-hidden>⚠</span>
        税率を選択
      </button>
    );
  }

  const pct = Math.round(item.rate * 100);
  const reduced = item.rate === REDUCED;
  const tone = !checked
    ? 'border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100'
    : reduced
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
      : 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200';

  return (
    <button
      type="button"
      onClick={onCycle}
      aria-label={`${item.name}の税率: ${pct}%（タップで切り替え）`}
      className={`${base} ${tone}`}
    >
      {pct}%
      <span className="text-[9px] opacity-50" aria-hidden>
        ⇄
      </span>
    </button>
  );
}
