import type { APIRequestContext } from '@playwright/test';

const API = 'http://localhost:3121';

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

export const TEST_MONTH = '2026-05';
