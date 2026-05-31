import { test, expect } from '@playwright/test';
import { resetDb, seedUsers, setIncome } from './helpers.js';

// 当月（JST）を YYYY-MM で返す
function currentMonth(): string {
  const tokyo = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  return `${tokyo.getFullYear()}-${String(tokyo.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonth(yyyymm: string, delta: number): string {
  const [y, m] = yyyymm.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

test.describe('月ごとの手取り', () => {
  test('月を切り替えるとその月の手取りが表示される', async ({ page, request }) => {
    await resetDb(request);
    const { wife } = await seedUsers(request);
    const thisMonth = currentMonth();
    const lastMonth = shiftMonth(thisMonth, -1);
    await setIncome(request, thisMonth, wife, 300000);
    await setIncome(request, lastMonth, wife, 100000);

    await page.goto('/');

    await test.step('当月は当月の手取りが表示される', async () => {
      await expect(page.getByLabel('妻の手取り')).toHaveValue('300000');
    });

    await page.getByRole('button', { name: '前の月' }).click();

    await test.step('前月に切り替えると前月の手取りが表示される', async () => {
      await expect(page.getByLabel('妻の手取り')).toHaveValue('100000');
    });

    await page.getByRole('button', { name: '次の月' }).click();

    await test.step('当月に戻すと当月の手取りが表示される', async () => {
      await expect(page.getByLabel('妻の手取り')).toHaveValue('300000');
    });
  });
});
