import { test, expect } from '@playwright/test';
import { resetDb, seedUsers, TEST_MONTH } from './helpers.js';

const API = 'http://localhost:3121';

function nextMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split('-').map(Number);
  const d = new Date(Date.UTC(y, m, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

test.describe('未来月のブロック', () => {
  test('未来月のスナップショット取得は400で拒否される', async ({ request }) => {
    await resetDb(request);
    await seedUsers(request);

    const res = await request.get(`${API}/api/months/${nextMonth(TEST_MONTH)}`);
    expect(res.status()).toBe(400);
  });

  test('当月では「次の月」ボタンが非活性、前月へ戻ると活性になる', async ({ page, request }) => {
    await resetDb(request);
    await seedUsers(request);

    await page.goto('/');

    const next = page.getByRole('button', { name: '次の月' });
    const prev = page.getByRole('button', { name: '前の月' });

    // 初期表示は当月なので未来へは進めない
    await expect(next).toBeDisabled();
    await expect(prev).toBeEnabled();

    // 前月へ戻ると「次の月」が押せるようになる
    await prev.click();
    await expect(next).toBeEnabled();
  });
});

test.describe('精算済みチェックは締めるまで操作不可', () => {
  test('締め前はチェックボックスが非活性', async ({ page, request }) => {
    await resetDb(request);
    await seedUsers(request);

    await page.goto('/');

    const checkbox = page.getByRole('checkbox', { name: '精算済み' });
    await expect(checkbox).toBeDisabled();
    await expect(page.getByText('（月を締めると操作できます）')).toBeVisible();
  });

  test('締め前の精算済み更新APIは409で拒否される', async ({ request }) => {
    await resetDb(request);
    await seedUsers(request);
    await request.get(`${API}/api/months/${TEST_MONTH}`);

    const res = await request.put(`${API}/api/months/${TEST_MONTH}/settlement-paid`, {
      data: { paid: true },
    });
    expect(res.status()).toBe(409);
  });

  test('締めるとチェックボックスが活性になり操作できる', async ({ page, request }) => {
    await resetDb(request);
    await seedUsers(request);

    await page.goto('/');

    const checkbox = page.getByRole('checkbox', { name: '精算済み' });
    await expect(checkbox).toBeDisabled();

    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: '月を締める' }).click();
    await expect(page.getByText('締め済')).toBeVisible();

    await expect(checkbox).toBeEnabled();
    await checkbox.click();
    await expect(checkbox).toBeChecked();
  });
});
