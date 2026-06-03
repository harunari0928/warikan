import { test, expect } from '@playwright/test';
import { resetDb, seedUsers, addExpense, failApi, SAVE_ERROR_TOAST, TEST_MONTH } from './helpers.js';

test.describe('支出CRUD', () => {
  test.beforeEach(async ({ request, page }) => {
    await resetDb(request);
    await seedUsers(request);
    await page.addInitScript(() => {
      window.localStorage.removeItem('warikan.currentUserId');
    });
  });

  test('支出を追加すると精算結果に反映される', async ({ page }) => {
    // Arrange: 各自が自分の手取りを入力する（妻30万 / 夫40万）
    await page.goto('/');
    await page.getByRole('tab', { name: '妻' }).waitFor();
    await page.getByRole('textbox', { name: '妻の手取り' }).fill('300000');
    await page.getByRole('textbox', { name: '妻の手取り' }).blur();
    await page.getByRole('tab', { name: '夫' }).click();
    await page.getByRole('textbox', { name: '夫の手取り' }).fill('400000');
    await page.getByRole('textbox', { name: '夫の手取り' }).blur();
    await page.getByRole('tab', { name: '妻' }).click();

    // Act: 妻として家賃12万の支出を追加する
    await page.getByRole('button', { name: '支出を追加' }).click();
    await page.getByRole('textbox', { name: '説明' }).fill('家賃');
    await page.getByRole('textbox', { name: '金額' }).fill('120000');
    await page.getByRole('button', { name: '追加', exact: true }).click();

    // Assert
    await test.step('追加した支出が一覧に表示される', async () => {
      await expect(page.getByRole('button', { name: /家賃/ })).toBeVisible();
    });
    await test.step('夫から妻への送金額に反映される', async () => {
      await expect(page.getByText('夫 → 妻')).toBeVisible();
      await expect(
        page.getByRole('region', { name: '月次サマリー' }).getByText('¥110,000'),
      ).toBeVisible();
    });
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

  test('支出を削除すると一覧から消える', async ({ page }) => {
    // Arrange: 食費の支出を1件追加する
    await page.goto('/');
    await page.getByRole('button', { name: '支出を追加' }).click();
    await page.getByRole('textbox', { name: '説明' }).fill('食費');
    await page.getByRole('textbox', { name: '金額' }).fill('3000');
    await page.getByRole('button', { name: '追加', exact: true }).click();
    await page.getByRole('button', { name: /食費/ }).waitFor();

    // Act: 削除する
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: '削除' }).click();

    // Assert
    await expect(page.getByText('今月の支出はまだありません')).toBeVisible();
  });

  test('タブを切り替えるとそのユーザの明細が表示される', async ({ page }) => {
    await page.goto('/');

    // 妻の明細を追加
    await page.getByRole('button', { name: '支出を追加' }).click();
    await page.getByRole('textbox', { name: '説明' }).fill('妻の支出');
    await page.getByRole('textbox', { name: '金額' }).fill('10000');
    await page.getByRole('button', { name: '追加', exact: true }).click();
    await expect(page.getByRole('button', { name: /妻の支出/ })).toBeVisible();

    // 夫に切り替えて夫の明細を追加
    await page.getByRole('tab', { name: '夫' }).click();
    await expect(page.getByRole('button', { name: /妻の支出/ })).not.toBeVisible();
    await page.getByRole('button', { name: '支出を追加' }).click();
    await page.getByRole('textbox', { name: '説明' }).fill('夫の支出');
    await page.getByRole('textbox', { name: '金額' }).fill('20000');
    await page.getByRole('button', { name: '追加', exact: true }).click();
    await expect(page.getByRole('button', { name: /夫の支出/ })).toBeVisible();

    // 妻に戻すと妻の明細だけが表示される
    await page.getByRole('tab', { name: '妻' }).click();
    await expect(page.getByRole('button', { name: /妻の支出/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /夫の支出/ })).not.toBeVisible();
  });
});

test.describe('支出操作中にAPIエラーが起きたとき', () => {
  test('追加が失敗するとエラーが通知され、明細に追加されない', async ({ page, request }) => {
    // Arrange: 妻の支出が1件ある状態で開き、追加リクエストを失敗させる
    await resetDb(request);
    const { wife } = await seedUsers(request);
    await addExpense(request, TEST_MONTH, wife, '家賃', 120000);
    await page.goto('/');
    await page.getByRole('button', { name: '支出を追加' }).waitFor();
    await failApi(page, '**/api/months/*/expenses', 'POST');

    // Act: 「外食 3000円」を追加しようとする
    await page.getByRole('button', { name: '支出を追加' }).click();
    await page.getByRole('textbox', { name: '説明' }).fill('外食');
    await page.getByRole('textbox', { name: '金額' }).fill('3000');
    await page.getByRole('button', { name: '追加', exact: true }).click();

    // Assert
    await test.step('エラーが通知される', async () => {
      await expect(page.getByText(SAVE_ERROR_TOAST)).toBeVisible();
    });

    await test.step('追加しようとした明細は残らない', async () => {
      await expect(page.getByText('外食')).toHaveCount(0);
    });
  });

  test('編集が失敗するとエラーが通知され、元の金額のまま戻る', async ({ page, request }) => {
    // Arrange: 家賃12万の支出を開き、編集リクエストを失敗させる
    await resetDb(request);
    const { wife } = await seedUsers(request);
    await addExpense(request, TEST_MONTH, wife, '家賃', 120000);
    await page.goto('/');
    const row = page.getByRole('button', { name: /家賃/ });
    await row.waitFor();
    await failApi(page, '**/api/months/*/expenses/*', 'PATCH');

    // Act: 家賃の金額を 99999 に変更しようとする
    await row.click();
    await page.getByRole('textbox', { name: '金額' }).fill('99999');
    await page.getByRole('button', { name: '保存', exact: true }).click();

    // Assert
    await test.step('エラーが通知される', async () => {
      await expect(page.getByText(SAVE_ERROR_TOAST)).toBeVisible();
    });

    await test.step('金額は元の ¥120,000 のまま戻る', async () => {
      await expect(page.getByText('¥99,999')).toHaveCount(0);
      await expect(page.getByRole('button', { name: /¥120,000/ })).toBeVisible();
    });
  });

  test('削除が失敗するとエラーが通知され、明細が残る', async ({ page, request }) => {
    // Arrange: 家賃12万の支出を開き、削除リクエストを失敗させる
    await resetDb(request);
    const { wife } = await seedUsers(request);
    await addExpense(request, TEST_MONTH, wife, '家賃', 120000);
    await page.goto('/');
    await page.getByRole('button', { name: '削除' }).waitFor();
    await failApi(page, '**/api/months/*/expenses/*', 'DELETE');

    // Act: 家賃を削除しようとする
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: '削除' }).click();

    // Assert
    await test.step('エラーが通知される', async () => {
      await expect(page.getByText(SAVE_ERROR_TOAST)).toBeVisible();
    });

    await test.step('家賃の明細は残る', async () => {
      await expect(page.getByRole('button', { name: /家賃/ })).toBeVisible();
    });
  });
});
