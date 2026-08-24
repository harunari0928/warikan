import { test, expect } from '@playwright/test';
import { resetDb, seedUsers, TEST_MONTH } from './helpers.js';

const API = 'http://localhost:3121';

test.describe('公開REST APIで支出を登録する', () => {
  test.beforeEach(async ({ request, page }) => {
    await resetDb(request);
    await page.addInitScript(() => {
      window.localStorage.removeItem('warikan.currentUserId');
    });
  });

  test('登録した支出が妻の明細に表示される', async ({ request, page }) => {
    // Arrange
    const { wife } = await seedUsers(request);

    // Act
    await request.post(`${API}/api/public/expenses`, {
      data: {
        user_id: wife,
        description: '食費',
        amount: 3000,
        note: '週末の買い物',
      },
    });

    // Assert
    await page.goto('/');
    await page.getByRole('tab', { name: '妻' }).click();
    await expect(page.getByRole('button', { name: /食費.*週末の買い物.*¥3,000/ })).toBeVisible();
  });

  test('締め済みの月では登録した支出が明細に表示されない', async ({ request, page }) => {
    // Arrange
    const { wife } = await seedUsers(request);
    await request.get(`${API}/api/months/${TEST_MONTH}`);
    await request.post(`${API}/api/months/${TEST_MONTH}/close`);

    // Act
    await request.post(`${API}/api/public/expenses`, {
      data: { user_id: wife, description: '締め後の支出', amount: 500, year_month: TEST_MONTH },
    });

    // Assert
    await page.goto('/');
    await page.getByText('今月の支出はまだありません').waitFor();
    await expect(page.getByRole('button', { name: /締め後の支出/ })).toBeHidden();
  });
});
