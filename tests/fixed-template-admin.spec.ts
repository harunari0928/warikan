import { test, expect } from '@playwright/test';
import { resetDb, seedUsers, addFixedTemplate, failApi, SAVE_ERROR_TOAST } from './helpers.js';

test.describe('固定費テンプレートの管理', () => {
  test('テンプレートを削除すると一覧から消える', async ({ page, request }) => {
    // Arrange: 妻に家賃・夫に通信費のテンプレを用意し、管理画面を開く
    await resetDb(request);
    const { wife, husband } = await seedUsers(request);
    await addFixedTemplate(request, wife, '家賃', 59000);
    await addFixedTemplate(request, husband, '通信費', 4180);
    await page.goto('/#/templates');
    const rentRow = page.getByRole('listitem').filter({ hasText: '家賃' });
    await rentRow.getByRole('button', { name: '削除' }).waitFor();

    // Act: 家賃テンプレを削除する
    page.once('dialog', (d) => d.accept());
    await rentRow.getByRole('button', { name: '削除' }).click();

    // Assert: 家賃は消え、通信費は残る
    await expect(page.getByText('家賃')).not.toBeVisible();
    await expect(page.getByText('通信費')).toBeVisible();
  });
});

test.describe('固定費テンプレートの操作中にAPIエラーが起きたとき', () => {
  test('追加が失敗するとエラーが通知され、一覧に追加されない', async ({ page, request }) => {
    // Arrange: 管理画面を開き、追加リクエストを失敗させる
    await resetDb(request);
    await seedUsers(request);
    await page.goto('/#/templates');
    await page.getByRole('button', { name: 'テンプレートを追加' }).waitFor();
    await failApi(page, '**/api/fixed-expense-templates', 'POST');

    // Act: 「保険 5000円」を追加しようとする
    await page.getByRole('button', { name: 'テンプレートを追加' }).click();
    await page.getByLabel('説明').fill('保険');
    await page.getByLabel('金額').fill('5000');
    await page.getByRole('button', { name: '追加', exact: true }).click();

    // Assert
    await test.step('エラーが通知される', async () => {
      await expect(page.getByText(SAVE_ERROR_TOAST)).toBeVisible();
    });

    await test.step('追加しようとしたテンプレートは残らない', async () => {
      await expect(page.getByText('保険')).toHaveCount(0);
    });
  });

  test('編集が失敗するとエラーが通知され、元の金額のまま戻る', async ({ page, request }) => {
    // Arrange: 家賃テンプレを管理画面で開き、編集リクエストを失敗させる
    await resetDb(request);
    const { wife } = await seedUsers(request);
    await addFixedTemplate(request, wife, '家賃', 59000);
    await page.goto('/#/templates');
    const row = page.getByRole('listitem').filter({ hasText: '家賃' });
    await row.getByRole('button', { name: '編集' }).waitFor();
    await failApi(page, '**/api/fixed-expense-templates/*', 'PATCH');

    // Act: 家賃の金額を 88888 に変更しようとする
    await row.getByRole('button', { name: '編集' }).click();
    await page.getByLabel('金額').fill('88888');
    await page.getByRole('button', { name: '保存', exact: true }).click();

    // Assert
    await test.step('エラーが通知される', async () => {
      await expect(page.getByText(SAVE_ERROR_TOAST)).toBeVisible();
    });

    await test.step('金額は元の ¥59,000 のまま戻る', async () => {
      await expect(page.getByText('¥88,888')).toHaveCount(0);
      await expect(page.getByText('¥59,000')).toBeVisible();
    });
  });

  test('削除が失敗するとエラーが通知され、一覧に残る', async ({ page, request }) => {
    // Arrange: 家賃テンプレを管理画面で開き、削除リクエストを失敗させる
    await resetDb(request);
    const { wife } = await seedUsers(request);
    await addFixedTemplate(request, wife, '家賃', 59000);
    await page.goto('/#/templates');
    const row = page.getByRole('listitem').filter({ hasText: '家賃' });
    await row.getByRole('button', { name: '削除' }).waitFor();
    await failApi(page, '**/api/fixed-expense-templates/*', 'DELETE');

    // Act: 家賃テンプレを削除しようとする
    page.once('dialog', (d) => d.accept());
    await row.getByRole('button', { name: '削除' }).click();

    // Assert
    await test.step('エラーが通知される', async () => {
      await expect(page.getByText(SAVE_ERROR_TOAST)).toBeVisible();
    });

    await test.step('家賃テンプレは一覧に残る', async () => {
      await expect(page.getByText('家賃')).toBeVisible();
    });
  });
});
