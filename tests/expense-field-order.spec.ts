import { test, expect, type Page } from '@playwright/test';
import { resetDb, seedUsers } from './helpers.js';

/** 明細入力ダイアログを開く（手入力）。 */
async function openExpenseDialog(page: Page): Promise<void> {
  await page.getByRole('button', { name: '支出を追加' }).click();
  await page.getByRole('button', { name: '手入力で追加' }).click();
  await page.getByRole('dialog', { name: '支出を追加' }).waitFor();
}

/** ダイアログ内の「説明」ラベルが「金額」ラベルより上にあるか。 */
async function descriptionIsAboveAmount(page: Page): Promise<boolean> {
  const dialog = page.getByRole('dialog', { name: '支出を追加' });
  const desc = await dialog.getByText('説明', { exact: true }).boundingBox();
  const amount = await dialog.getByText('金額', { exact: true }).boundingBox();
  if (!desc || !amount) throw new Error('フィールドが見つかりません');
  return desc.y < amount.y;
}

/** 指定した並び替えハンドルを縦方向にドラッグして位置を入れ替える。 */
async function dragFieldDown(page: Page, handleName: string): Promise<void> {
  const handle = page.getByRole('button', { name: handleName });
  const box = await handle.boundingBox();
  if (!box) throw new Error('ハンドルが見つかりません');
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx, cy + 20);
  await page.mouse.move(cx, cy + 90);
  await page.mouse.up();
}

test.describe('明細入力の並び順', () => {
  test.beforeEach(async ({ request, page }) => {
    await resetDb(request);
    await seedUsers(request);
    await page.addInitScript(() => {
      window.localStorage.removeItem('warikan.currentUserId');
    });
  });

  test('初期状態は説明が上、金額が下に表示される', async ({ page }) => {
    await page.goto('/');
    await openExpenseDialog(page);

    expect(await descriptionIsAboveAmount(page)).toBe(true);
  });

  test('ドラッグで説明と金額の位置を入れ替えられる', async ({ page }) => {
    await page.goto('/');
    await openExpenseDialog(page);

    await dragFieldDown(page, '説明の並び替え');

    expect(await descriptionIsAboveAmount(page)).toBe(false);
  });

  test('入れ替えた並び順はページを開き直しても保たれる', async ({ page }) => {
    // Arrange: 説明と金額の位置を入れ替える
    await page.goto('/');
    await openExpenseDialog(page);
    await dragFieldDown(page, '説明の並び替え');
    await page.getByRole('button', { name: '閉じる' }).click();

    // Act: ページを再読み込みしてダイアログを開き直す
    await page.reload();
    await openExpenseDialog(page);

    // Assert
    expect(await descriptionIsAboveAmount(page)).toBe(false);
  });

  test('並び順はユーザごとに保存される', async ({ page }) => {
    // Arrange: 妻の入力欄で金額を上に入れ替える
    await page.goto('/');
    await page.getByRole('tab', { name: '妻' }).waitFor();
    await openExpenseDialog(page);
    await dragFieldDown(page, '説明の並び替え');
    await page.getByRole('button', { name: '閉じる' }).click();

    // Act: 夫に切り替えて入力欄を開く
    await page.getByRole('tab', { name: '夫' }).click();
    await openExpenseDialog(page);

    // Assert
    await test.step('夫の入力欄は初期の並び（説明が上）のまま', async () => {
      expect(await descriptionIsAboveAmount(page)).toBe(true);
    });

    await page.getByRole('button', { name: '閉じる' }).click();
    await page.getByRole('tab', { name: '妻' }).click();
    await openExpenseDialog(page);

    await test.step('妻の入力欄は入れ替えた並び（金額が上）が保たれる', async () => {
      expect(await descriptionIsAboveAmount(page)).toBe(false);
    });
  });
});
