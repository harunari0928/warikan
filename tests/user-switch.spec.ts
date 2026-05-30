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

  test('選択ユーザがlocalStorageに保存される', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: '夫' }).click();

    const stored = await page.evaluate(() => localStorage.getItem('warikan.currentUserId'));
    expect(stored).not.toBeNull();

    await page.reload();
    await expect(page.getByRole('tab', { name: '夫' })).toHaveAttribute('aria-selected', 'true');
  });

  test('自分の手取りは編集でき、別ユーザの手取りは編集できない', async ({ page }) => {
    await page.goto('/');

    // 妻の表示では妻の手取りだけ編集でき、夫の手取りはロックされている
    await expect(page.getByLabel('妻の手取り')).toBeEnabled();
    await expect(page.getByLabel('夫の手取り')).toBeDisabled();

    // 夫に切り替えると逆になる
    await page.getByRole('tab', { name: '夫' }).click();
    await expect(page.getByLabel('夫の手取り')).toBeEnabled();
    await expect(page.getByLabel('妻の手取り')).toBeDisabled();
  });
});
