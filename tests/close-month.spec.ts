import { test, expect } from '@playwright/test';
import {
  resetDb,
  seedUsers,
  addExpense,
  setIncome,
  closeMonth,
  failApi,
  SAVE_ERROR_TOAST,
  TEST_MONTH,
} from './helpers.js';

test.describe('月の締めとロック', () => {
  test('月を締めると支出の追加・編集ができなくなる', async ({ page, request }) => {
    // Arrange: 妻に家賃の支出を用意する
    await resetDb(request);
    const { wife } = await seedUsers(request);
    await addExpense(request, TEST_MONTH, wife, '家賃', 120000);

    // Act: 月を締める
    await page.goto('/');
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: '月を締める' }).click();

    // Assert
    await test.step('締め済として表示される', async () => {
      await expect(page.getByText('締め済')).toBeVisible();
    });

    await test.step('支出を追加ボタンが消える', async () => {
      await expect(page.getByRole('button', { name: '支出を追加' })).not.toBeVisible();
    });

    await test.step('締めを解除ボタンが現れる', async () => {
      await expect(page.getByRole('button', { name: '締めを解除' })).toBeVisible();
    });

    await test.step('既存の支出が非活性になる', async () => {
      await expect(page.getByRole('button', { name: /家賃/ })).toBeDisabled();
    });
  });

  test('精算済みチェックは締め後でも操作できる', async ({ page, request }) => {
    // Arrange: 手取りと支出を用意する
    await resetDb(request);
    const { wife, husband } = await seedUsers(request);
    await setIncome(request, TEST_MONTH, wife, 300000);
    await setIncome(request, TEST_MONTH, husband, 400000);
    await addExpense(request, TEST_MONTH, wife, '家賃', 120000);

    // Act: 月を締める
    await page.goto('/');
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: '月を締める' }).click();
    await page.getByText('締め済').waitFor();

    // Assert
    const checkbox = page.getByRole('checkbox', { name: '精算済み' });
    await test.step('締めた直後は未チェック', async () => {
      await expect(checkbox).not.toBeChecked();
    });

    // Act: 精算済みにチェックを入れる
    await checkbox.click();

    // Assert
    await test.step('チェックすると精算済みと表示する', async () => {
      await expect(checkbox).toBeChecked();
      await expect(page.getByText(/精算済み \(/)).toBeVisible();
    });
  });

  test('締めを解除すれば再度編集できるようになる', async ({ page, request }) => {
    // Arrange
    await resetDb(request);
    await seedUsers(request);

    // Act: 月を締めてから解除する
    await page.goto('/');
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: '月を締める' }).click();
    await page.getByText('締め済').waitFor();
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: '締めを解除' }).click();

    // Assert
    await test.step('月を締めるボタンが戻る', async () => {
      await expect(page.getByRole('button', { name: '月を締める' })).toBeVisible();
    });

    await test.step('支出を追加できるようになる', async () => {
      await expect(page.getByRole('button', { name: '支出を追加' })).toBeVisible();
    });
  });
});

test.describe('精算済みは送金される側だけが操作できる', () => {
  // 妻40万・夫30万・支出なし → 妻が夫に5万送金。夫が「送金される側」になる。
  test.beforeEach(async ({ request }) => {
    await resetDb(request);
    const { wife, husband } = await seedUsers(request);
    await setIncome(request, TEST_MONTH, wife, 400000);
    await setIncome(request, TEST_MONTH, husband, 300000);
  });

  test('送金される側（夫）は精算済みにできる', async ({ page }) => {
    // Arrange: 月を締める
    await page.goto('/');
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: '月を締める' }).click();
    await page.getByText('締め済').waitFor();

    // Act: 送金される側の夫に切り替えて精算済みにチェックする
    await page.getByRole('tab', { name: '夫' }).click();
    const checkbox = page.getByRole('checkbox', { name: '精算済み' });
    await checkbox.click();

    // Assert
    await test.step('精算済みとして表示される', async () => {
      await expect(checkbox).toBeChecked();
      await expect(page.getByText(/精算済み \(/)).toBeVisible();
    });
  });

  test('送金する側（妻）は精算済みにできない', async ({ page }) => {
    // Arrange: 月を締める（初期表示は送金する側の妻）
    await page.goto('/');
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: '月を締める' }).click();
    await page.getByText('締め済').waitFor();

    // Assert
    await test.step('精算済みのチェックを操作できない', async () => {
      await expect(page.getByRole('checkbox', { name: '精算済み' })).toBeDisabled();
    });

    await test.step('夫が操作できる旨が案内される', async () => {
      await expect(page.getByText('（夫さんが操作できます）')).toBeVisible();
    });
  });
});

test.describe('精算不要の月は締めると自動で精算済みになる', () => {
  test('手取り同額で精算不要の月を締めると自動で精算済みになる', async ({ page, request }) => {
    // Arrange: 手取り同額・支出なし → 精算不要
    await resetDb(request);
    const { wife, husband } = await seedUsers(request);
    await setIncome(request, TEST_MONTH, wife, 300000);
    await setIncome(request, TEST_MONTH, husband, 300000);

    await page.goto('/');
    await page.getByText('精算不要（同額）').waitFor();

    // Act: 月を締める
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: '月を締める' }).click();
    await page.getByText('締め済').waitFor();

    // Assert
    await test.step('操作しなくても精算済みとして表示される', async () => {
      await expect(page.getByRole('checkbox', { name: '精算済み' })).toBeChecked();
      await expect(page.getByText(/精算済み \(/)).toBeVisible();
    });
  });
});

test.describe('月の締め・精算済み操作中にAPIエラーが起きたとき', () => {
  test('締める操作が失敗するとエラーが通知され、締められていない状態に戻る', async ({ page, request }) => {
    // Arrange: 未締めの月を開き、締めリクエストを失敗させる
    await resetDb(request);
    await seedUsers(request);
    await page.goto('/');
    await page.getByRole('button', { name: '月を締める' }).waitFor();
    await failApi(page, '**/api/months/*/close', 'POST');

    // Act: 月を締めようとする
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: '月を締める' }).click();

    // Assert
    await test.step('エラーが通知される', async () => {
      await expect(page.getByText(SAVE_ERROR_TOAST)).toBeVisible();
    });

    await test.step('締め済にならず、月を締めるボタンのまま戻る', async () => {
      await expect(page.getByText('締め済')).toHaveCount(0);
      await expect(page.getByRole('button', { name: '月を締める' })).toBeVisible();
    });
  });

  test('解除が失敗するとエラーが通知され、締め済みのまま戻る', async ({ page, request }) => {
    // Arrange: 締め済みの月を開き、解除リクエストを失敗させる
    await resetDb(request);
    await seedUsers(request);
    await closeMonth(request, TEST_MONTH);
    await page.goto('/');
    await page.getByRole('button', { name: '締めを解除' }).waitFor();
    await failApi(page, '**/api/months/*/open', 'POST');

    // Act: 締めを解除しようとする
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: '締めを解除' }).click();

    // Assert
    await test.step('エラーが通知される', async () => {
      await expect(page.getByText(SAVE_ERROR_TOAST)).toBeVisible();
    });

    await test.step('締め済のまま、締めを解除ボタンが残る', async () => {
      await expect(page.getByText('締め済')).toBeVisible();
      await expect(page.getByRole('button', { name: '締めを解除' })).toBeVisible();
    });
  });

  test('精算済みの記録が失敗するとエラーが通知され、チェックが外れた状態に戻る', async ({ page, request }) => {
    // Arrange: 妻40万・夫30万（夫が送金される側）の締め済みの月で、精算済みの保存を失敗させる
    await resetDb(request);
    const { wife, husband } = await seedUsers(request);
    await setIncome(request, TEST_MONTH, wife, 400000);
    await setIncome(request, TEST_MONTH, husband, 300000);
    await closeMonth(request, TEST_MONTH);
    await page.goto('/');
    await page.getByText('締め済').waitFor();
    await failApi(page, '**/api/months/*/settlement-paid', 'PUT');

    // Act: 送金される側の夫に切り替えて精算済みにチェックしようとする
    await page.getByRole('tab', { name: '夫' }).click();
    const checkbox = page.getByRole('checkbox', { name: '精算済み' });
    await checkbox.click();

    // Assert
    await test.step('エラーが通知される', async () => {
      await expect(page.getByText(SAVE_ERROR_TOAST)).toBeVisible();
    });

    await test.step('精算済みのチェックは外れたまま戻る', async () => {
      await expect(checkbox).not.toBeChecked();
    });
  });
});
