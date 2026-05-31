import { test, expect } from '@playwright/test';
import { resetDb, seedUsers } from './helpers.js';

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
    await page.goto('/');
    await page.getByRole('button', { name: '支出を追加' }).click();
    await page.getByRole('textbox', { name: '説明' }).fill('食費');
    await page.getByRole('textbox', { name: '金額' }).fill('3000');
    await page.getByRole('button', { name: '追加', exact: true }).click();
    await page.getByRole('button', { name: /食費/ }).waitFor();

    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: '削除' }).click();

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
