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

  // 税率を切り替えると、税抜に戻して新しい税率を掛け直した税込金額に再計算される。
  // 8%→10% と 10%→8% の両方向を確認する（品目・金額はテストデータで、仕様ではない）。
  const rateChangeCases = [
    { item: '牛乳', from: 8, to: 10, after: '¥220' },
    { item: '台所用洗剤', from: 10, to: 8, after: '¥324' },
  ];

  for (const { item, from, to, after } of rateChangeCases) {
    test(`税率を${from}%から${to}%に変えると、税込金額が再計算されて登録される`, async ({ page }) => {
      // Arrange
      await page.goto('/');
      await page.getByRole('tab', { name: '妻' }).waitFor();

      await page.getByRole('button', { name: '支出を追加' }).click();
      await page.getByRole('button', { name: 'レシートを撮影' }).click();
      await page.getByLabel('レシート画像').setInputFiles('tests/fixtures/receipt-ok.png');
      await page.getByRole('checkbox', { name: item }).waitFor();

      // Act — 対象明細の税率を切り替えてから全明細を追加する
      await page.getByRole('button', { name: `${item}の税率: ${from}%（タップで切り替え）` }).click();

      // Assert
      await test.step('ダイアログ上で税率が切り替わり、税込金額が再計算される', async () => {
        await expect(
          page.getByRole('button', { name: `${item}の税率: ${to}%（タップで切り替え）` }),
        ).toBeVisible();
        await expect(page.getByText(after)).toBeVisible();
      });

      await page.getByRole('button', { name: '3件を追加' }).click();
      await page.getByRole('dialog', { name: 'レシートから追加' }).waitFor({ state: 'hidden' });
      await page.reload();
      await page.getByRole('tab', { name: '妻' }).waitFor();

      await test.step('再計算後の金額で支出に登録されている', async () => {
        await expect(
          page.getByRole('button', { name: new RegExp(`${item}.*${after}`) }),
        ).toBeVisible();
      });
    });
  }

  test('税率が読み取れなかった明細は、税率を選んでから支出に追加できる', async ({ page }) => {
    // Arrange
    await page.goto('/');
    await page.getByRole('tab', { name: '妻' }).waitFor();

    await page.getByRole('button', { name: '支出を追加' }).click();
    await page.getByRole('button', { name: 'レシートを撮影' }).click();
    await page.getByLabel('レシート画像').setInputFiles('tests/fixtures/receipt-no-tax.png');
    await page.getByRole('checkbox', { name: '牛乳' }).waitFor();

    // Assert
    await test.step('税率未設定の明細があると注意書きが出て、まだ追加できない', async () => {
      await expect(
        page.getByText('税率が読み取れなかった明細があります。税率を選んでください。'),
      ).toBeVisible();
      await expect(page.getByRole('button', { name: '2件を追加' })).toBeDisabled();
    });

    // Act — それぞれの明細の税率を選ぶ
    await page.getByRole('button', { name: '牛乳の税率: 未設定（タップで選択）' }).click();
    await page.getByRole('button', { name: 'お茶の税率: 未設定（タップで選択）' }).click();

    await test.step('税率を選ぶと追加できるようになる', async () => {
      await expect(page.getByRole('button', { name: '2件を追加' })).toBeEnabled();
    });

    await page.getByRole('button', { name: '2件を追加' }).click();
    await page.getByRole('dialog', { name: 'レシートから追加' }).waitFor({ state: 'hidden' });

    await test.step('選んだ明細が支出リストに入る', async () => {
      await expect(page.getByRole('button', { name: /牛乳/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /お茶/ })).toBeVisible();
    });
  });
});
