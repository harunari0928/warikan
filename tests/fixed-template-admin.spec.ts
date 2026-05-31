import { test, expect } from '@playwright/test';
import { resetDb, seedUsers, addFixedTemplate } from './helpers.js';

test.describe('固定費テンプレートの管理', () => {
  test('テンプレートを削除すると一覧から消える', async ({ page, request }) => {
    await resetDb(request);
    const { wife, husband } = await seedUsers(request);
    await addFixedTemplate(request, wife, '家賃', 59000);
    await addFixedTemplate(request, husband, '通信費', 4180);

    await page.goto('/#/templates');
    const rentRow = page.getByRole('listitem').filter({ hasText: '家賃' });
    await rentRow.getByRole('button', { name: '削除' }).waitFor();

    page.once('dialog', (d) => d.accept());
    await rentRow.getByRole('button', { name: '削除' }).click();

    await expect(page.getByText('家賃')).not.toBeVisible();
    await expect(page.getByText('通信費')).toBeVisible();
  });
});
