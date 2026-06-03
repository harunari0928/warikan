import { useEffect, useState } from 'react';
import type { FixedTemplate, User } from '../types.js';
import { formatYen } from '../utils.js';
import AmountInput from './AmountInput.js';
import { useToast } from './Toast.js';

type Props = {
  users: User[];
  onBack: () => void;
};

const SAVE_ERROR_MSG = '保存に失敗しました。通信環境を確認してください';
const JSON_HEADERS = { 'Content-Type': 'application/json' };

export default function FixedTemplateAdmin({ users, onBack }: Props) {
  const [templates, setTemplates] = useState<FixedTemplate[]>([]);
  const [editing, setEditing] = useState<FixedTemplate | null>(null);
  const [showForm, setShowForm] = useState(false);
  const toast = useToast();

  const fetchTemplates = async () => {
    const res = await fetch('/api/fixed-expense-templates');
    if (res.ok) setTemplates(await res.json());
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  // 楽観的に一覧を更新 → API。失敗したら直前の一覧へロールバックしトーストで通知する。
  const runTemplateMutation = async (optimistic: FixedTemplate[], request: () => Promise<Response>) => {
    const prev = templates;
    setTemplates(optimistic);
    try {
      const res = await request();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchTemplates();
    } catch {
      setTemplates(prev);
      toast.error(SAVE_ERROR_MSG);
    }
  };

  const handleSubmit = async (values: TemplateFormValues) => {
    const target = editing;

    // 楽観的反映と同時にフォームを閉じ、ユーザーを待たせない。失敗時はロールバックされる。
    setShowForm(false);
    setEditing(null);

    if (target) {
      await runTemplateMutation(
        templates.map((t) =>
          t.id === target.id ? { ...t, ...values, is_active: values.is_active ? 1 : 0 } : t,
        ),
        () =>
          fetch(`/api/fixed-expense-templates/${target.id}`, {
            method: 'PATCH',
            headers: JSON_HEADERS,
            body: JSON.stringify(values),
          }),
      );
    } else {
      const optimistic: FixedTemplate = {
        id: -Date.now(),
        user_id: values.user_id,
        description: values.description,
        amount: values.amount,
        note: values.note,
        is_active: values.is_active ? 1 : 0,
        display_order: Number.MAX_SAFE_INTEGER,
      };
      await runTemplateMutation(
        [...templates, optimistic],
        () =>
          fetch('/api/fixed-expense-templates', {
            method: 'POST',
            headers: JSON_HEADERS,
            body: JSON.stringify(values),
          }),
      );
    }
  };

  const handleDelete = async (t: FixedTemplate) => {
    if (!window.confirm(`「${t.description}」を削除しますか？`)) return;
    await runTemplateMutation(
      templates.filter((x) => x.id !== t.id),
      () => fetch(`/api/fixed-expense-templates/${t.id}`, { method: 'DELETE' }),
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 px-4 py-4 space-y-4 pb-safe">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="h-10 w-10 -ml-2 rounded-lg hover:bg-slate-100 text-slate-700 dark:hover:bg-slate-800 dark:text-slate-200"
          aria-label="戻る"
        >
          ←
        </button>
        <h1 className="text-xl font-semibold tracking-tight">固定費テンプレート</h1>
      </div>

      {templates.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
          テンプレートはまだありません
        </div>
      ) : (
        <ul className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
          {templates.map((t) => {
            const user = users.find((u) => u.id === t.user_id);
            return (
              <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                    {t.description}
                    {t.is_active === 0 && (
                      <span className="ml-2 text-[10px] text-slate-500 bg-slate-100 dark:text-slate-400 dark:bg-slate-800 rounded px-1.5 py-0.5">
                        無効
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{user?.name ?? '?'}</div>
                </div>
                <div className="text-sm tabular-nums">¥{formatYen(t.amount)}</div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(t);
                      setShowForm(true);
                    }}
                    className="h-9 w-9 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                    aria-label="編集"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(t)}
                    className="h-9 w-9 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                    aria-label="削除"
                  >
                    🗑
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        onClick={() => {
          setEditing(null);
          setShowForm(true);
        }}
        className="w-full min-h-11 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
      >
        ＋ テンプレートを追加
      </button>

      {showForm && (
        <TemplateForm
          users={users}
          initial={editing}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}

type TemplateFormValues = {
  user_id: number;
  description: string;
  amount: number;
  note: string | null;
  is_active: boolean;
};

function TemplateForm({
  users,
  initial,
  onClose,
  onSubmit,
}: {
  users: User[];
  initial: FixedTemplate | null;
  onClose: () => void;
  onSubmit: (values: TemplateFormValues) => Promise<void>;
}) {
  const [userId, setUserId] = useState<number>(initial?.user_id ?? users[0]?.id ?? 0);
  const [description, setDescription] = useState(initial?.description ?? '');
  const [amount, setAmount] = useState(initial?.amount ?? 0);
  const [note, setNote] = useState(initial?.note ?? '');
  const [isActive, setIsActive] = useState(initial?.is_active !== 0);
  const [submitting, setSubmitting] = useState(false);
  const canSubmit = description.trim() !== '' && amount > 0 && userId > 0 && !submitting;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-white dark:bg-slate-900 dark:text-slate-100 rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-4 pb-5 space-y-4">
          <h3 className="text-base font-semibold">{initial ? 'テンプレートを編集' : 'テンプレートを追加'}</h3>

          <label className="block">
            <span className="text-xs text-slate-600 dark:text-slate-400">ユーザー</span>
            <select
              value={userId}
              onChange={(e) => setUserId(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs text-slate-600 dark:text-slate-400">説明</span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:focus:border-slate-400 dark:focus:ring-slate-400"
            />
          </label>

          <label className="block">
            <span className="text-xs text-slate-600">金額</span>
            <div className="mt-1">
              <AmountInput value={amount} onChange={setAmount} ariaLabel="金額" />
            </div>
          </label>

          <label className="block">
            <span className="text-xs text-slate-600 dark:text-slate-400">備考 (任意)</span>
            <input
              type="text"
              value={note ?? ''}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:focus:border-slate-400 dark:focus:ring-slate-400"
            />
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-5 w-5 rounded border-slate-300 dark:border-slate-600"
            />
            <span className="text-sm">有効（次月以降の表に自動投入）</span>
          </label>

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="min-h-11 px-4 rounded-xl text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
              キャンセル
            </button>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={async () => {
                setSubmitting(true);
                try {
                  await onSubmit({
                    user_id: userId,
                    description: description.trim(),
                    amount,
                    note: note.trim() || null,
                    is_active: isActive,
                  });
                } finally {
                  setSubmitting(false);
                }
              }}
              className="min-h-11 px-5 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 disabled:bg-slate-300 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white dark:disabled:bg-slate-700 dark:disabled:text-slate-500"
            >
              {initial ? '保存' : '追加'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
