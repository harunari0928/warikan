import { test, expect } from '@playwright/test';
import { resetDb, seedUsers, TEST_MONTH } from './helpers.js';

const API = 'http://localhost:3121';

const PEOPLE = [
  { name: '妻', otherName: '夫', userKey: 'wife' as const },
  { name: '夫', otherName: '妻', userKey: 'husband' as const },
];

test.describe('公開REST APIで支出を登録する', () => {
  test.beforeEach(async ({ request, page }) => {
    await resetDb(request);
    await page.addInitScript(() => {
      window.localStorage.removeItem('warikan.currentUserId');
    });
  });

  for (const { name, otherName, userKey } of PEOPLE) {
    test(`「${name}」を指定すると、${name}の明細に支出が表示される`, async ({ request, page }) => {
      // Arrange
      const users = await seedUsers(request);
      const description = `${name}の食費`;

      // Act
      await request.post(`${API}/api/public/expenses`, {
        data: {
          user_id: users[userKey],
          description,
          amount: 3000,
          note: '週末の買い物',
        },
      });

      // Assert
      await page.goto('/');
      await page.getByRole('tab', { name }).click();
      await test.step(`${name}の明細に品目・メモ・金額が表示される`, async () => {
        await expect(
          page.getByRole('button', { name: new RegExp(`${description}.*週末の買い物.*¥3,000`) }),
        ).toBeVisible();
      });
      await page.getByRole('tab', { name: otherName }).click();
      await page.getByText('今月の支出はまだありません').waitFor();
      await test.step(`${otherName}の明細には表示されない`, async () => {
        await expect(page.getByRole('button', { name: new RegExp(description) })).toBeHidden();
      });
    });

    test(`締め済みの月に${name}の支出を追加しようとしても明細に表示されない`, async ({ request, page }) => {
      // Arrange
      const users = await seedUsers(request);
      const description = `締め後の${name}の支出`;
      await request.get(`${API}/api/months/${TEST_MONTH}`);
      await request.post(`${API}/api/months/${TEST_MONTH}/close`);

      // Act
      await request.post(`${API}/api/public/expenses`, {
        data: { user_id: users[userKey], description, amount: 500, year_month: TEST_MONTH },
      });

      // Assert
      await page.goto('/');
      await page.getByRole('tab', { name }).click();
      await page.getByText('今月の支出はまだありません').waitFor();
      await expect(page.getByRole('button', { name: new RegExp(description) })).toBeHidden();
    });
  }
});
