import { test, expect } from '@playwright/test';
import { resetDb, seedUsers } from './helpers.js';

test.describe('ユーザ切替', () => {
  test.beforeEach(async ({ request }) => {
    await resetDb(request);
    await seedUsers(request);
  });

  test('初期表示は妻、夫タブをクリックすると夫に切り替わる', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('tab', { name: '妻' })).toHaveAttribute('aria-selected', 'true');

    await page.getByRole('tab', { name: '夫' }).click();

    await expect(page.getByRole('tab', { name: '夫' })).toHaveAttribute('aria-selected', 'true');
  });

  test('リロードしても選択したユーザが保持される', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: '夫' }).click();
    await expect(page.getByRole('tab', { name: '夫' })).toHaveAttribute('aria-selected', 'true');

    await page.reload();

    await expect(page.getByRole('tab', { name: '夫' })).toHaveAttribute('aria-selected', 'true');
  });
});
