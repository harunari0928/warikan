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
    // Arrange
    await page.goto('/');
    await page.getByRole('tab', { name: '妻' }).waitFor();

    await page.getByRole('button', { name: '支出を追加' }).click();
    await page.getByRole('button', { name: 'レシートを撮影' }).click();
    await expect(page.getByRole('dialog', { name: 'レシートから追加' })).toBeVisible();
    await page.getByLabel('レシート画像').setInputFiles('tests/fixtures/receipt-ok.png');
    await page.getByRole('checkbox', { name: '牛乳' }).waitFor();

    // Act — 個人負担の品目を外して追加する
    await page.getByRole('checkbox', { name: '台所用洗剤' }).uncheck();
    await page.getByRole('button', { name: '2件を追加' }).click();

    // Assert — 選んだ明細だけが支出リストに入る
    await expect(page.getByRole('button', { name: /牛乳.*¥/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /食パン.*¥/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /台所用洗剤.*¥/ })).not.toBeVisible();
  });

  test('税率を選ばなければ、読み取った金額のまま支出に登録される', async ({ page }) => {
    // Arrange
    await page.goto('/');
    await page.getByRole('tab', { name: '妻' }).waitFor();

    await page.getByRole('button', { name: '支出を追加' }).click();
    await page.getByRole('button', { name: 'レシートを撮影' }).click();
    await page.getByLabel('レシート画像').setInputFiles('tests/fixtures/receipt-ok.png');
    await page.getByRole('checkbox', { name: '牛乳' }).waitFor();

    // Act — 税率を選ばずにそのまま追加する
    await page.getByRole('button', { name: '3件を追加' }).click();
    await page.getByRole('dialog', { name: 'レシートから追加' }).waitFor({ state: 'hidden' });
    await page.reload();
    await page.getByRole('tab', { name: '妻' }).waitFor();

    // Assert — 読み取った金額がそのまま登録されている
    await expect(page.getByRole('button', { name: /牛乳.*¥200/ })).toBeVisible();
  });

  // 税率は なし / 8% / 10% を直接選択する。
  // 各税率を選んだときの牛乳(読み取り金額200円)の表示金額を、状態ごとに個別に検証する。
  // selectLabel が null のケースは何も押さない（初期状態=読み取り金額のまま）。
  const rateDisplayCases = [
    { rate: '税なし', shown: '¥200', selectLabel: null as string | null },
    { rate: '8%', shown: '¥216', selectLabel: '牛乳を8%にする' },
    { rate: '10%', shown: '¥220', selectLabel: '牛乳を10%にする' },
  ];

  for (const { rate, shown, selectLabel } of rateDisplayCases) {
    test(`牛乳の税率を${rate}にすると、金額が${shown}と表示される`, async ({ page }) => {
      // Arrange
      await page.goto('/');
      await page.getByRole('tab', { name: '妻' }).waitFor();

      await page.getByRole('button', { name: '支出を追加' }).click();
      await page.getByRole('button', { name: 'レシートを撮影' }).click();
      await page.getByLabel('レシート画像').setInputFiles('tests/fixtures/receipt-ok.png');
      await page.getByRole('checkbox', { name: '牛乳' }).waitFor();

      // Act — 牛乳の税率を直接選ぶ
      if (selectLabel) {
        await page.getByRole('button', { name: selectLabel }).click();
      }

      // Assert — 選んだ税率に応じた金額が表示される
      await expect(page.getByText(shown)).toBeVisible();
    });
  }

  test('税率を選ぶと、計算後の税込金額で支出に登録される', async ({ page }) => {
    // Arrange
    await page.goto('/');
    await page.getByRole('tab', { name: '妻' }).waitFor();

    await page.getByRole('button', { name: '支出を追加' }).click();
    await page.getByRole('button', { name: 'レシートを撮影' }).click();
    await page.getByLabel('レシート画像').setInputFiles('tests/fixtures/receipt-ok.png');
    await page.getByRole('checkbox', { name: '牛乳' }).waitFor();

    // Act — 牛乳に8%を選んで追加する
    await page.getByRole('button', { name: '牛乳を8%にする' }).click();
    await page.getByRole('button', { name: '3件を追加' }).click();
    await page.getByRole('dialog', { name: 'レシートから追加' }).waitFor({ state: 'hidden' });
    await page.reload();
    await page.getByRole('tab', { name: '妻' }).waitFor();

    // Assert — 8%で計算した税込金額で登録されている
    await expect(page.getByRole('button', { name: /牛乳.*¥216/ })).toBeVisible();
  });
});
