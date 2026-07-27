const WEB_URL = process.env.WEB_URL || 'http://localhost:3120';

/** サーバ内部のエラー文言を、CLI利用者に意味の通る日本語へ置き換える。 */
const ERROR_MESSAGES: Record<string, string> = {
  'month is closed': '締め済みの月のため変更できません',
  'future month is not allowed': '未来の月は登録できません',
};

export async function apiFetch<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${WEB_URL}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new Error(`${WEB_URL} に接続できませんでした。WEB_URL の設定とサーバの起動を確認してください`);
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    const raw = data.error || `HTTP ${res.status}`;
    throw new Error(ERROR_MESSAGES[raw] || raw);
  }
  return data;
}

export type User = { id: number; name: string; display_order: number };

export type Expense = {
  id: number;
  user_id: number;
  description: string;
  amount: number;
  note: string | null;
  is_fixed: number;
};

/** `-w` に指定できる英語エイリアスと、users テーブル上の表示名の対応。 */
const USER_ALIASES: Record<string, string> = {
  wife: '妻',
  w: '妻',
  husband: '夫',
  h: '夫',
};

export async function resolveUser(who: string): Promise<User> {
  const users = await apiFetch<User[]>('GET', '/api/users');
  const wanted = USER_ALIASES[who.toLowerCase()] ?? who;
  const user = users.find((u) => u.name === wanted);
  if (!user) {
    const names = users.map((u) => u.name).join(', ');
    throw new Error(`ユーザ「${who}」が見つかりません。登録されているユーザ: ${names || '(なし)'}`);
  }
  return user;
}

export function formatYen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`;
}
