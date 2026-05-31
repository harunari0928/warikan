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

  for (const { self, partner } of [
    { self: '妻', partner: '夫' },
    { self: '夫', partner: '妻' },
  ]) {
    test(`${self}を選ぶと自分の手取りだけ編集でき、${partner}の手取りは編集できない`, async ({
      page,
    }) => {
      // Arrange
      await page.goto('/');

      // Act
      await page.getByRole('tab', { name: self }).click();

      // Assert
      await test.step('自分の手取りは編集できる', async () => {
        await expect(page.getByLabel(`${self}の手取り`)).toBeEnabled();
      });
      await test.step('相手の手取りは編集できない', async () => {
        await expect(page.getByLabel(`${partner}の手取り`)).toBeDisabled();
      });
    });
  }
});
