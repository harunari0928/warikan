import { test, expect } from '@playwright/test';
import { resetDb, seedUsers, addExpense, setIncome, TEST_MONTH } from './helpers.js';

test.describe('月の締めとロック', () => {
  test('締め後はFABが非表示・行が薄表示・締めを解除ボタンが現れる', async ({ page, request }) => {
    await resetDb(request);
    const { wife } = await seedUsers(request);
    await addExpense(request, TEST_MONTH, wife, '家賃', 120000);

    await page.goto('/');

    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: '月を締める' }).click();

    await expect(page.getByText('締め済')).toBeVisible();
    await expect(page.getByRole('button', { name: '支出を追加' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: '締めを解除' })).toBeVisible();
    await expect(page.getByRole('button', { name: /家賃/ })).toBeDisabled();
  });

  test('精算済みチェックは締め後でも操作可能', async ({ page, request }) => {
    await resetDb(request);
    const { wife, husband } = await seedUsers(request);
    await setIncome(request, TEST_MONTH, wife, 300000);
    await setIncome(request, TEST_MONTH, husband, 400000);
    await addExpense(request, TEST_MONTH, wife, '家賃', 120000);

    await page.goto('/');
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: '月を締める' }).click();
    await expect(page.getByText('締め済')).toBeVisible();

    const checkbox = page.getByRole('checkbox', { name: '精算済み' });
    await expect(checkbox).not.toBeChecked();
    await checkbox.click();
    await expect(checkbox).toBeChecked();
    await expect(page.getByText(/精算済み \(/)).toBeVisible();
  });

  test('締めを解除すれば再度編集可能になる', async ({ page, request }) => {
    await resetDb(request);
    await seedUsers(request);

    await page.goto('/');
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: '月を締める' }).click();
    await expect(page.getByText('締め済')).toBeVisible();

    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: '締めを解除' }).click();

    await expect(page.getByRole('button', { name: '月を締める' })).toBeVisible();
    await expect(page.getByRole('button', { name: '支出を追加' })).toBeVisible();
  });
});
