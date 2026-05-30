import { test, expect } from '@playwright/test';
import { resetDb, seedUsers, addFixedTemplate, TEST_MONTH } from './helpers.js';

test.describe('固定費テンプレートの自動投入', () => {
  test('月を初めて開くとアクティブなテンプレートが自動投入される', async ({ page, request }) => {
    await resetDb(request);
    const { wife, husband } = await seedUsers(request);
    await addFixedTemplate(request, wife, '家賃', 59000);
    await addFixedTemplate(request, husband, '通信費', 4180);

    await page.goto('/');
    const wifeRow = page.getByRole('region', { name: '支出リスト' }).getByRole('listitem');
    await expect(wifeRow.getByRole('button', { name: /家賃/ })).toBeVisible();
    await expect(wifeRow.getByText('¥59,000')).toBeVisible();

    await page.getByRole('tab', { name: '夫' }).click();
    const husbandRow = page.getByRole('region', { name: '支出リスト' }).getByRole('listitem');
    await expect(husbandRow.getByRole('button', { name: /通信費/ })).toBeVisible();
    await expect(husbandRow.getByText('¥4,180')).toBeVisible();
  });

  test('同じ月を再度開いても二重投入されない', async ({ request }) => {
    await resetDb(request);
    const { wife } = await seedUsers(request);
    await addFixedTemplate(request, wife, '家賃', 59000);

    // First open creates instances
    await request.get(`http://localhost:3121/api/months/${TEST_MONTH}`);
    // Concurrent reopen
    await Promise.all([
      request.get(`http://localhost:3121/api/months/${TEST_MONTH}`),
      request.get(`http://localhost:3121/api/months/${TEST_MONTH}`),
      request.get(`http://localhost:3121/api/months/${TEST_MONTH}`),
    ]);

    const res = await request.get(`http://localhost:3121/api/months/${TEST_MONTH}/expenses`);
    const expenses = (await res.json()) as { description: string }[];
    expect(expenses.filter((e) => e.description === '家賃')).toHaveLength(1);
  });
});
