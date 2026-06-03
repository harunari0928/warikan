import type { APIRequestContext, Page } from '@playwright/test';

const API = 'http://localhost:3121';

/** 保存失敗時にトーストへ表示されるメッセージ（部分一致で検証する用）。 */
export const SAVE_ERROR_TOAST = '保存に失敗しました';

/**
 * 指定したメソッド・URLのリクエストだけをサーバエラー(500)に差し替える。
 * それ以外（画面表示に必要なGET等）はそのまま通す。
 */
export async function failApi(page: Page, urlGlob: string, method: string): Promise<void> {
  await page.route(urlGlob, (route) => {
    if (route.request().method() === method) {
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' });
    } else {
      route.continue();
    }
  });
}

export async function resetDb(request: APIRequestContext): Promise<void> {
  await request.post(`${API}/api/test/reset`);
}

export async function seedUsers(
  request: APIRequestContext,
): Promise<{ wife: number; husband: number }> {
  const r1 = await request.post(`${API}/api/users`, {
    data: { name: '妻', display_order: 0 },
  });
  const wife = (await r1.json()).id as number;
  const r2 = await request.post(`${API}/api/users`, {
    data: { name: '夫', display_order: 1 },
  });
  const husband = (await r2.json()).id as number;
  return { wife, husband };
}

export async function ensureMonth(request: APIRequestContext, yyyymm: string): Promise<void> {
  await request.get(`${API}/api/months/${yyyymm}`);
}

export async function setIncome(
  request: APIRequestContext,
  yyyymm: string,
  userId: number,
  amount: number,
): Promise<void> {
  await ensureMonth(request, yyyymm);
  await request.put(`${API}/api/months/${yyyymm}/incomes/${userId}`, {
    data: { amount },
  });
}

export async function closeMonth(request: APIRequestContext, yyyymm: string): Promise<void> {
  await ensureMonth(request, yyyymm);
  await request.post(`${API}/api/months/${yyyymm}/close`);
}

export async function addExpense(
  request: APIRequestContext,
  yyyymm: string,
  userId: number,
  description: string,
  amount: number,
): Promise<void> {
  await ensureMonth(request, yyyymm);
  await request.post(`${API}/api/months/${yyyymm}/expenses`, {
    data: { user_id: userId, description, amount },
  });
}

export async function addFixedTemplate(
  request: APIRequestContext,
  userId: number,
  description: string,
  amount: number,
): Promise<void> {
  await request.post(`${API}/api/fixed-expense-templates`, {
    data: { user_id: userId, description, amount },
  });
}

// アプリは起動時に「当月（JST）」を開くため、テスト対象の月も当月に揃える。
// 固定値にすると月が変わった瞬間に当月とズレてE2Eが落ちる。
function currentMonthJST(): string {
  const tokyo = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return `${tokyo.getFullYear()}-${String(tokyo.getMonth() + 1).padStart(2, '0')}`;
}

export const TEST_MONTH = currentMonthJST();
