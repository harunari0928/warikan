import { test, expect } from '@playwright/test';
import { resetDb, seedUsers, addFixedTemplate } from './helpers.js';

test.describe('固定費テンプレートの自動投入', () => {
  test('月を初めて開くとアクティブなテンプレートが自動投入される', async ({ page, request }) => {
    await resetDb(request);
    const { wife, husband } = await seedUsers(request);
    await addFixedTemplate(request, wife, '家賃', 59000);
    await addFixedTemplate(request, husband, '通信費', 4180);

    await page.goto('/');
    const wifeRow = page.getByRole('region', { name: '支出リスト' }).getByRole('listitem');
    await expect(wifeRow.getByRole('button', { name: /家賃/ })).toBeVisible();
    await expect(wifeRow.getByText('¥59,000')).toBeVisible();

    await page.getByRole('tab', { name: '夫' }).click();
    const husbandRow = page.getByRole('region', { name: '支出リスト' }).getByRole('listitem');
    await expect(husbandRow.getByRole('button', { name: /通信費/ })).toBeVisible();
    await expect(husbandRow.getByText('¥4,180')).toBeVisible();
  });

  test('画面を更新しても固定費が二重に表示されない', async ({ page, request }) => {
    await resetDb(request);
    const { wife } = await seedUsers(request);
    await addFixedTemplate(request, wife, '家賃', 59000);

    await page.goto('/');
    const list = page.getByRole('region', { name: '支出リスト' });
    await expect(list.getByRole('button', { name: /家賃/ })).toHaveCount(1);

    await page.reload();
    await expect(list.getByRole('button', { name: /家賃/ })).toHaveCount(1);
  });
});
