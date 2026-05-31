import { test, expect } from '@playwright/test';
import { resetDb, seedUsers, addExpense, setIncome, TEST_MONTH } from './helpers.js';

test.describe('月の締めとロック', () => {
  test('月を締めると支出の追加・編集ができなくなる', async ({ page, request }) => {
    await resetDb(request);
    const { wife } = await seedUsers(request);
    await addExpense(request, TEST_MONTH, wife, '家賃', 120000);

    await page.goto('/');
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: '月を締める' }).click();

    await test.step('締め済として表示される', async () => {
      await expect(page.getByText('締め済')).toBeVisible();
    });

    await test.step('支出を追加ボタンが消える', async () => {
      await expect(page.getByRole('button', { name: '支出を追加' })).not.toBeVisible();
    });

    await test.step('締めを解除ボタンが現れる', async () => {
      await expect(page.getByRole('button', { name: '締めを解除' })).toBeVisible();
    });

    await test.step('支出追加ボタンが非表示になる', async () => {
      await expect(page.getByRole('button', { name: /家賃/ })).toBeDisabled();
    });
  });

  test('精算済みチェックは締め後でも操作できる', async ({ page, request }) => {
    await resetDb(request);
    const { wife, husband } = await seedUsers(request);
    await setIncome(request, TEST_MONTH, wife, 300000);
    await setIncome(request, TEST_MONTH, husband, 400000);
    await addExpense(request, TEST_MONTH, wife, '家賃', 120000);

    await page.goto('/');
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: '月を締める' }).click();
    await page.getByText('締め済').waitFor();

    const checkbox = page.getByRole('checkbox', { name: '精算済み' });
    await test.step('締めた直後は未チェック', async () => {
      await expect(checkbox).not.toBeChecked();
    });

    await checkbox.click();

    await test.step('チェックすると精算済みと表示する', async () => {
      await expect(checkbox).toBeChecked();
      await expect(page.getByText(/精算済み \(/)).toBeVisible();
    });
  });

  test('締めを解除すれば再度編集できるようになる', async ({ page, request }) => {
    await resetDb(request);
    await seedUsers(request);

    await page.goto('/');
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: '月を締める' }).click();
    await page.getByText('締め済').waitFor();

    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: '締めを解除' }).click();

    await test.step('月を締めるボタンが戻る', async () => {
      await expect(page.getByRole('button', { name: '月を締める' })).toBeVisible();
    });

    await test.step('支出を追加できるようになる', async () => {
      await expect(page.getByRole('button', { name: '支出を追加' })).toBeVisible();
    });
  });
});
