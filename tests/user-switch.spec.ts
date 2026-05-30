import { test, expect } from '@playwright/test';
import { resetDb, seedUsers } from './helpers.js';

test.describe('ユーザ切替', () => {
  test.beforeEach(async ({ request }) => {
    await resetDb(request);
    await seedUsers(request);
  });

  test('初期表示は妻、夫タブをクリックすると夫に切り替わる', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('tab', { name: '妻', selected: true })).toBeVisible();

    await page.getByRole('tab', { name: '夫' }).click();
    await expect(page.getByRole('tab', { name: '夫', selected: true })).toBeVisible();
  });

  test('画面を更新しても選択したユーザが残っている', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: '夫' }).click();
    await expect(page.getByRole('tab', { name: '夫', selected: true })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('tab', { name: '夫', selected: true })).toBeVisible();
  });
});
