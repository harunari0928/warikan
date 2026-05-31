import { test, expect } from '@playwright/test';
import { resetDb, seedUsers } from './helpers.js';

test.describe('割勘の精算結果', () => {
  test.beforeEach(async ({ request }) => {
    await resetDb(request);
    await seedUsers(request);
  });

  test('夫の手取りが多いと、夫が妻に払う額が表示される', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: '妻' }).waitFor();

    await page.getByRole('textbox', { name: '妻の手取り' }).fill('300000');
    await page.getByRole('textbox', { name: '夫の手取り' }).fill('400000');
    await page.getByRole('textbox', { name: '夫の手取り' }).blur();

    const summary = page.getByRole('region', { name: '月次サマリー' });
    await expect(summary.getByText('夫 → 妻')).toBeVisible();
    await expect(summary.getByText('¥50,000')).toBeVisible();
  });

  test('手取りが同額で支出がなければ精算不要と表示される', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: '妻' }).waitFor();

    await page.getByRole('textbox', { name: '妻の手取り' }).fill('300000');
    await page.getByRole('textbox', { name: '夫の手取り' }).fill('300000');
    await page.getByRole('textbox', { name: '夫の手取り' }).blur();

    await expect(
      page.getByRole('region', { name: '月次サマリー' }).getByText('精算不要（同額）'),
    ).toBeVisible();
  });

  test('夫の支出が多いと、妻が夫に払う額が表示される', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: '妻' }).waitFor();

    await page.getByRole('textbox', { name: '妻の手取り' }).fill('300000');
    await page.getByRole('textbox', { name: '夫の手取り' }).fill('300000');
    await page.getByRole('textbox', { name: '夫の手取り' }).blur();
    await page.getByRole('tab', { name: '夫' }).click();
    await page.getByRole('button', { name: '支出を追加' }).click();
    await page.getByRole('textbox', { name: '説明' }).fill('家電');
    await page.getByRole('textbox', { name: '金額' }).fill('100000');
    await page.getByRole('button', { name: '追加', exact: true }).click();

    const summary = page.getByRole('region', { name: '月次サマリー' });
    await expect(summary.getByText('妻 → 夫')).toBeVisible();
    await expect(summary.getByText('¥50,000')).toBeVisible();
  });
});
