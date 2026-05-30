import { test, expect } from '@playwright/test';
import { resetDb, seedUsers, TEST_MONTH } from './helpers.js';

test.describe('支出CRUD', () => {
  test.beforeEach(async ({ request, page }) => {
    await resetDb(request);
    await seedUsers(request);
    await page.addInitScript(() => {
      window.localStorage.removeItem('warikan.currentUserId');
    });
  });

  test('支出を追加し精算結果に反映される', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: '妻' }).waitFor();

    // 各自が自分の手取りだけを入力する
    await page.getByRole('textbox', { name: '妻の手取り' }).fill('300000');
    await page.getByRole('textbox', { name: '妻の手取り' }).blur();
    await page.getByRole('tab', { name: '夫' }).click();
    await page.getByRole('textbox', { name: '夫の手取り' }).fill('400000');
    await page.getByRole('textbox', { name: '夫の手取り' }).blur();
    await expect(page.getByRole('region', { name: '月次サマリー' }).getByText('¥50,000')).toBeVisible();

    // 妻として家賃の支出を追加する
    await page.getByRole('tab', { name: '妻' }).click();
    await page.getByRole('button', { name: '支出を追加' }).click();
    await expect(page.getByRole('dialog', { name: '支出を追加' })).toBeVisible();
    await page.getByRole('textbox', { name: '説明' }).fill('家賃');
    await page.getByRole('textbox', { name: '金額' }).fill('120000');
    await page.getByRole('button', { name: '追加', exact: true }).click();

    await expect(page.getByRole('button', { name: /家賃/ })).toBeVisible();
    await expect(page.getByText('夫 → 妻')).toBeVisible();
    await expect(page.getByRole('region', { name: '月次サマリー' }).getByText('¥110,000')).toBeVisible();
  });

  test('支出を編集できる', async ({ page }) => {
    await page.goto(`/`);
    await page.getByRole('button', { name: '支出を追加' }).click();
    await page.getByRole('textbox', { name: '説明' }).fill('食費');
    await page.getByRole('textbox', { name: '金額' }).fill('5000');
    await page.getByRole('button', { name: '追加', exact: true }).click();

    await page.getByRole('button', { name: /食費/ }).click();
    await page.getByRole('textbox', { name: '金額' }).fill('8000');
    await page.getByRole('button', { name: '保存', exact: true }).click();

    await expect(
      page.getByRole('region', { name: '支出リスト' }).getByRole('listitem').getByText('¥8,000'),
    ).toBeVisible();
  });

  test('ユーザ切替で表示される支出が変わる', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '支出を追加' }).click();
    await page.getByRole('textbox', { name: '説明' }).fill('妻の支出');
    await page.getByRole('textbox', { name: '金額' }).fill('10000');
    await page.getByRole('button', { name: '追加', exact: true }).click();

    await page.getByRole('tab', { name: '夫' }).click();
    await expect(page.getByText('今月の支出はまだありません')).toBeVisible();
    await expect(page.getByRole('button', { name: /妻の支出/ })).not.toBeVisible();
  });
});
