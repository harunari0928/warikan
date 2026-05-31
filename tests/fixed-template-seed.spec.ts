import { test, expect } from '@playwright/test';
import { resetDb, seedUsers, addFixedTemplate } from './helpers.js';

test.describe('固定費テンプレートの自動投入', () => {
  test('月を初めて開くと固定費テンプレが表示される', async ({ page, request }) => {
    await resetDb(request);
    const { wife, husband } = await seedUsers(request);
    await addFixedTemplate(request, wife, '家賃', 59000);
    await addFixedTemplate(request, husband, '通信費', 4180);

    await page.goto('/');

    await test.step('妻の表には妻の固定費が入る', async () => {
      const wifeRow = page.getByRole('region', { name: '支出リスト' }).getByRole('listitem');
      await expect(wifeRow.getByRole('button', { name: /家賃/ })).toBeVisible();
      await expect(wifeRow.getByText('¥59,000')).toBeVisible();
    });

    await page.getByRole('tab', { name: '夫' }).click();

    await test.step('夫の表には夫の固定費が入る', async () => {
      const husbandRow = page.getByRole('region', { name: '支出リスト' }).getByRole('listitem');
      await expect(husbandRow.getByRole('button', { name: /通信費/ })).toBeVisible();
      await expect(husbandRow.getByText('¥4,180')).toBeVisible();
    });
  });

  test('月を再度開いても固定費が二重に表示されない', async ({ page, request }) => {
    await resetDb(request);
    const { wife } = await seedUsers(request);
    await addFixedTemplate(request, wife, '家賃', 59000);

    await page.goto('/');
    await page.getByRole('region', { name: '支出リスト' }).getByRole('button', { name: /家賃/ }).waitFor();
    await page.reload();

    await expect(
      page
        .getByRole('region', { name: '支出リスト' })
        .getByRole('listitem')
        .filter({ hasText: '家賃' }),
    ).toHaveCount(1);
  });
});
