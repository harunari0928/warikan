import { test, expect } from '@playwright/test';
import { resetDb, seedUsers, TEST_MONTH } from './helpers.js';

const API = 'http://localhost:3121';

test.describe('公開REST APIで支出を登録する', () => {
  test.beforeEach(async ({ request }) => {
    await resetDb(request);
  });

  test('月を事前に初期化せずに支出を登録できる', async ({ request }) => {
    const { wife } = await seedUsers(request);

    const response = await request.post(`${API}/api/public/expenses`, {
      data: {
        user_id: wife,
        description: '食費',
        amount: 3000,
        note: '週末の買い物',
      },
    });

    expect(response.status()).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      user_id: wife,
      description: '食費',
      amount: 3000,
      note: '週末の買い物',
      is_fixed: 0,
    });

    const expenses = await request.get(`${API}/api/months/${TEST_MONTH}/expenses`);
    await expect(expenses.json()).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ description: '食費', amount: 3000 })]),
    );
  });

  test('締め済みの月には登録できない', async ({ request }) => {
    const { wife } = await seedUsers(request);
    await request.get(`${API}/api/months/${TEST_MONTH}`);
    await request.post(`${API}/api/months/${TEST_MONTH}/close`);

    const response = await request.post(`${API}/api/public/expenses`, {
      data: { user_id: wife, description: '締め後の支出', amount: 500, year_month: TEST_MONTH },
    });

    expect(response.status()).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: 'month is closed' });
  });
});
