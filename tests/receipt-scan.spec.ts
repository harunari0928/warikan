import { test, expect } from '@playwright/test';
import { resetDb, seedUsers } from './helpers.js';

test.describe('レシートから明細を取り込む', () => {
  test.beforeEach(async ({ request, page }) => {
    await resetDb(request);
    await seedUsers(request);
    await page.addInitScript(() => {
      window.localStorage.removeItem('warikan.currentUserId');
    });
  });

  test('レシートを撮影し、選んだ明細だけが支出に追加される', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: '妻' }).waitFor();

    await page.getByRole('button', { name: '支出を追加' }).click();
    await page.getByRole('button', { name: 'レシートを撮影' }).click();
    await expect(page.getByRole('dialog', { name: 'レシートから追加' })).toBeVisible();

    await page.getByLabel('レシート画像').setInputFiles('tests/fixtures/receipt-ok.png');

    // OCR結果の明細が一覧表示される
    await expect(page.getByRole('checkbox', { name: '牛乳' })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: '食パン' })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: '台所用洗剤' })).toBeVisible();

    // 個人負担の品目は外す
    await page.getByRole('checkbox', { name: '台所用洗剤' }).uncheck();
    await page.getByRole('button', { name: '2件を追加' }).click();

    // 選んだ明細だけが支出リストに入る
    await expect(page.getByRole('button', { name: /牛乳/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /食パン/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /台所用洗剤/ })).not.toBeVisible();
  });

  test('税率が読み取れないレシートはエラーが表示される', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: '妻' }).waitFor();

    await page.getByRole('button', { name: '支出を追加' }).click();
    await page.getByRole('button', { name: 'レシートを撮影' }).click();
    await expect(page.getByRole('dialog', { name: 'レシートから追加' })).toBeVisible();

    await page.getByLabel('レシート画像').setInputFiles('tests/fixtures/receipt-no-tax.png');

    await expect(page.getByText('税率が読み取れませんでした')).toBeVisible();
  });
});
