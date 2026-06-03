import { test, expect } from '@playwright/test';
import {
  resetDb,
  seedUsers,
  setIncome,
  addExpense,
  failApi,
  SAVE_ERROR_TOAST,
  TEST_MONTH,
} from './helpers.js';

test.describe('割勘の精算結果', () => {
  test('夫の手取りが多いと、夫が妻に払う額が表示される', async ({ page, request }) => {
    // Arrange: 妻30万 / 夫40万 を登録する
    await resetDb(request);
    const { wife, husband } = await seedUsers(request);
    await setIncome(request, TEST_MONTH, wife, 300000);
    await setIncome(request, TEST_MONTH, husband, 400000);

    // Act
    await page.goto('/');

    // Assert
    const summary = page.getByRole('region', { name: '月次サマリー' });
    await expect(summary.getByText('夫 → 妻')).toBeVisible();
    await expect(summary.getByText('¥50,000')).toBeVisible();
  });

  test('手取りが同額で支出がなければ精算不要と表示される', async ({ page, request }) => {
    // Arrange: 妻30万 / 夫30万 を登録する
    await resetDb(request);
    const { wife, husband } = await seedUsers(request);
    await setIncome(request, TEST_MONTH, wife, 300000);
    await setIncome(request, TEST_MONTH, husband, 300000);

    // Act
    await page.goto('/');

    // Assert
    await expect(
      page.getByRole('region', { name: '月次サマリー' }).getByText('精算不要（同額）'),
    ).toBeVisible();
  });

  test('夫の支出が多いと、妻が夫に払う額が表示される', async ({ page, request }) => {
    // Arrange: 手取りは同額、夫だけ10万の支出を登録する
    await resetDb(request);
    const { wife, husband } = await seedUsers(request);
    await setIncome(request, TEST_MONTH, wife, 300000);
    await setIncome(request, TEST_MONTH, husband, 300000);
    await addExpense(request, TEST_MONTH, husband, '家電', 100000);

    // Act
    await page.goto('/');

    // Assert
    const summary = page.getByRole('region', { name: '月次サマリー' });
    await expect(summary.getByText('妻 → 夫')).toBeVisible();
    await expect(summary.getByText('¥50,000')).toBeVisible();
  });

  test('手取りの保存が失敗するとエラーが通知され、精算結果が元に戻る', async ({ page, request }) => {
    // Arrange: 妻30万・夫30万（精算不要）で開き、手取りの保存を失敗させる
    await resetDb(request);
    const { wife, husband } = await seedUsers(request);
    await setIncome(request, TEST_MONTH, wife, 300000);
    await setIncome(request, TEST_MONTH, husband, 300000);
    await page.goto('/');
    await page.getByText('精算不要（同額）').waitFor();
    await failApi(page, '**/api/months/*/incomes/*', 'PUT');

    // Act: 妻の手取りを 50万 に変更しようとする
    const income = page.getByLabel('妻の手取り');
    await income.fill('500000');
    await income.blur();

    // Assert
    await test.step('エラーが通知される', async () => {
      await expect(page.getByText(SAVE_ERROR_TOAST)).toBeVisible();
    });

    await test.step('精算結果は「精算不要（同額）」に戻る', async () => {
      await expect(page.getByText('精算不要（同額）')).toBeVisible();
    });
  });
});
