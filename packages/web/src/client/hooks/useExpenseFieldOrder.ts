import { useCallback, useEffect, useState } from 'react';

export type ExpenseFieldKey = 'description' | 'amount';

/** 明細入力ダイアログの「説明」「金額」の並び順。先頭が上に表示される。 */
export const DEFAULT_FIELD_ORDER: ExpenseFieldKey[] = ['description', 'amount'];

function storageKey(userId: number | null): string {
  return `warikan.expenseFieldOrder.${userId ?? 'default'}`;
}

function parse(raw: string | null): ExpenseFieldKey[] | null {
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw);
    if (
      Array.isArray(arr) &&
      arr.length === 2 &&
      arr.includes('description') &&
      arr.includes('amount')
    ) {
      return arr as ExpenseFieldKey[];
    }
  } catch {
    // 破損した値は無視してデフォルトへフォールバック
  }
  return null;
}

/**
 * 明細入力ダイアログのフィールド並び順をユーザごとに localStorage で永続化する。
 * `warikan.currentUserId` と同じく、ユーザ切替のたびにそのユーザの設定を読み直す。
 */
export function useExpenseFieldOrder(userId: number | null) {
  const [order, setOrderState] = useState<ExpenseFieldKey[]>(
    () => parse(localStorage.getItem(storageKey(userId))) ?? DEFAULT_FIELD_ORDER,
  );

  useEffect(() => {
    setOrderState(parse(localStorage.getItem(storageKey(userId))) ?? DEFAULT_FIELD_ORDER);
  }, [userId]);

  const setOrder = useCallback(
    (next: ExpenseFieldKey[]) => {
      setOrderState(next);
      localStorage.setItem(storageKey(userId), JSON.stringify(next));
    },
    [userId],
  );

  return [order, setOrder] as const;
}
