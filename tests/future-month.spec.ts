import { test, expect } from '@playwright/test';
import { resetDb, seedUsers, setIncome, TEST_MONTH } from './helpers.js';

test.describe('未来月のブロック', () => {
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

  test('締めるとチェックボックスが活性になり操作できる', async ({ page, request }) => {
    // 妻30万・夫40万 → 夫が妻に送金。送金される側の妻（初期表示）が操作できる。
    await resetDb(request);
    const { wife, husband } = await seedUsers(request);
    await setIncome(request, TEST_MONTH, wife, 300000);
    await setIncome(request, TEST_MONTH, husband, 400000);

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
