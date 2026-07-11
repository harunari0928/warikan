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
    await expect(page.getByRole('button', { name: /牛乳/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /食パン/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /台所用洗剤/ })).not.toBeVisible();
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

  // 税率ボタンを押すと、読み取った金額に消費税が加算されて登録される。
  // 8%・10% の両方を、税率ボタンを押す回数（未選択→8%→10%）で網羅する。
  const taxCases = [
    { pct: 8, after: '¥216', taps: ['税なし'] },
    { pct: 10, after: '¥220', taps: ['税なし', '8%'] },
  ];

  for (const { pct, after, taps } of taxCases) {
    test(`税率${pct}%を選ぶと、読み取った金額に消費税が加算されて登録される`, async ({ page }) => {
      // Arrange
      await page.goto('/');
      await page.getByRole('tab', { name: '妻' }).waitFor();

      await page.getByRole('button', { name: '支出を追加' }).click();
      await page.getByRole('button', { name: 'レシートを撮影' }).click();
      await page.getByLabel('レシート画像').setInputFiles('tests/fixtures/receipt-ok.png');
      await page.getByRole('checkbox', { name: '牛乳' }).waitFor();

      // Act — 牛乳の税率ボタンを目的の税率まで押す
      for (const label of taps) {
        await page.getByRole('button', { name: `牛乳の税率: ${label}（タップで変更）` }).click();
      }

      // Assert
      await test.step('ダイアログ上で選んだ税率になり、税込金額が計算される', async () => {
        await expect(
          page.getByRole('button', { name: `牛乳の税率: ${pct}%（タップで変更）` }),
        ).toBeVisible();
        await expect(page.getByText(after)).toBeVisible();
      });

      await page.getByRole('button', { name: '3件を追加' }).click();
      await page.getByRole('dialog', { name: 'レシートから追加' }).waitFor({ state: 'hidden' });
      await page.reload();
      await page.getByRole('tab', { name: '妻' }).waitFor();

      await test.step('計算後の税込金額で支出に登録されている', async () => {
        await expect(
          page.getByRole('button', { name: new RegExp(`牛乳.*${after}`) }),
        ).toBeVisible();
      });
    });
  }
});
