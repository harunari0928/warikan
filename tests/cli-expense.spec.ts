import { test, expect } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';
import { resetDb, seedUsers, setIncome, closeMonth, TEST_MONTH } from './helpers.js';

const execAsync = promisify(exec);

const EMPTY_EXPENSES = '今月の支出はまだありません';

function shiftMonth(yyyymm: string, delta: number): string {
  const [y, m] = yyyymm.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function runCli(args: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const { stdout, stderr } = await execAsync(`npx tsx packages/cli/src/index.ts ${args}`, {
      cwd: process.cwd(),
      env: { ...process.env, WEB_URL: 'http://localhost:3121' },
      encoding: 'utf-8',
      timeout: 30000,
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; code?: number };
    return { stdout: e.stdout ?? '', stderr: e.stderr ?? '', exitCode: e.code ?? 1 };
  }
}

test.describe('コマンドで支出を追加する', () => {
  let users: { wife: number; husband: number };

  test.beforeEach(async ({ request, page }) => {
    await resetDb(request);
    users = await seedUsers(request);
    await page.addInitScript(() => {
      window.localStorage.removeItem('warikan.currentUserId');
    });
  });

  test('追加した品目と金額がコマンドの結果に表示される', async () => {
    // Act
    const result = await runCli('add -w husband -t "ガス代" -p 3000');

    // Assert
    expect(result.stdout).toMatch(/夫: ガス代 ¥3,000/);
  });

  test.describe('支出を追加するユーザの指定', () => {
    for (const { option, expected } of [
      { option: 'wife', expected: '妻' },
      { option: 'husband', expected: '夫' },
      { option: '妻', expected: '妻' },
      { option: '夫', expected: '夫' },
    ]) {
      test(`「${option}」を指定するとそのユーザの明細に表示される`, async ({ page }) => {
        // Act
        await runCli(`add -w ${option} -t "日用品" -p 1200`);
        await page.goto('/');
        await page.getByRole('tab', { name: expected }).click();

        // Assert
        await expect(page.getByRole('button', { name: /日用品/ })).toBeVisible();
      });
    }

    test('指定していないユーザの明細には表示されない', async ({ page }) => {
      // Act
      await runCli('add -w husband -t "ガス代" -p 3000');
      await page.goto('/');
      await page.getByRole('tab', { name: '妻' }).click();
      await page.getByText(EMPTY_EXPENSES).waitFor();

      // Assert
      await expect(page.getByRole('button', { name: /ガス代/ })).toBeHidden();
    });
  });

  test('追加した金額が明細に表示される', async ({ page }) => {
    // Act
    await runCli('add -w husband -t "ガス代" -p 3000');
    await page.goto('/');
    await page.getByRole('tab', { name: '夫' }).click();

    // Assert
    await expect(page.getByRole('button', { name: /ガス代.*¥3,000/ })).toBeVisible();
  });

  test('メモを付けて追加すると明細にメモが表示される', async ({ page }) => {
    // Act
    await runCli('add -w wife -t "スーパー" -p 4280 -n "週末まとめ買い"');
    await page.goto('/');

    // Assert
    await expect(page.getByRole('button', { name: /週末まとめ買い/ })).toBeVisible();
  });

  test.describe('追加した支出の精算への反映', () => {
    test('送金の向きが精算結果に表示される', async ({ page, request }) => {
      // Arrange: 妻30万 / 夫40万 の手取りを登録する
      await setIncome(request, TEST_MONTH, users.wife, 300000);
      await setIncome(request, TEST_MONTH, users.husband, 400000);

      // Act
      await runCli('add -w wife -t "家賃" -p 120000');
      await page.goto('/');

      // Assert
      await expect(page.getByText('夫 → 妻')).toBeVisible();
    });

    test('送金額が精算結果に表示される', async ({ page, request }) => {
      // Arrange: 妻30万 / 夫40万 の手取りを登録する
      await setIncome(request, TEST_MONTH, users.wife, 300000);
      await setIncome(request, TEST_MONTH, users.husband, 400000);

      // Act
      await runCli('add -w wife -t "家賃" -p 120000');
      await page.goto('/');

      // Assert
      await expect(
        page.getByRole('region', { name: '月次サマリー' }).getByText('¥110,000'),
      ).toBeVisible();
    });
  });

  test.describe('対象の月の指定', () => {
    test('指定した月の明細に表示される', async ({ page }) => {
      // Act
      await runCli(`add -w husband -t "電気代" -p 8000 -m ${shiftMonth(TEST_MONTH, -1)}`);
      await page.goto('/');
      await page.getByRole('tab', { name: '夫' }).click();
      await page.getByRole('button', { name: '前の月' }).click();

      // Assert
      await expect(page.getByRole('button', { name: /電気代/ })).toBeVisible();
    });

    test('指定した月以外の明細には表示されない', async ({ page }) => {
      // Act
      await runCli(`add -w husband -t "電気代" -p 8000 -m ${shiftMonth(TEST_MONTH, -1)}`);
      await page.goto('/');
      await page.getByRole('tab', { name: '夫' }).click();
      await page.getByText(EMPTY_EXPENSES).waitFor();

      // Assert
      await expect(page.getByRole('button', { name: /電気代/ })).toBeHidden();
    });
  });

  test.describe('締め済みの月への追加', () => {
    test('締め済みであることが伝わるエラーになる', async ({ request }) => {
      // Arrange
      await closeMonth(request, TEST_MONTH);

      // Act
      const result = await runCli('add -w wife -t "食費" -p 500');

      // Assert
      expect(result.stderr).toContain('締め済み');
    });

    test('明細には追加されない', async ({ request, page }) => {
      // Arrange
      await closeMonth(request, TEST_MONTH);

      // Act
      await runCli('add -w wife -t "食費" -p 500');
      await page.goto('/');
      await page.getByText(EMPTY_EXPENSES).waitFor();

      // Assert
      await expect(page.getByRole('button', { name: /食費/ })).toBeHidden();
    });
  });

  test.describe('登録されていないユーザの指定', () => {
    test('指定したユーザが見つからないことが伝わる', async () => {
      // Act
      const result = await runCli('add -w child -t "おやつ" -p 300');

      // Assert
      expect(result.stderr).toContain('見つかりません');
    });

    test('登録されているユーザ名が示される', async () => {
      // Act
      const result = await runCli('add -w child -t "おやつ" -p 300');

      // Assert
      expect(result.stderr).toMatch(/登録されているユーザ: .*妻.*夫/);
    });
  });

  test.describe('入力値の誤り', () => {
    for (const { args, reason, message } of [
      { args: 'add -w wife -t "テスト" -p abc', reason: '金額が数値でないとき', message: '金額' },
      { args: 'add -w wife -t "テスト" -p -100', reason: '金額が負の数のとき', message: '金額' },
      { args: 'add -w wife -t "テスト" -p 100 -m 2026-13', reason: '月の形式が YYYY-MM でないとき', message: '月の形式' },
    ]) {
      test(`${reason}はエラーになる`, async () => {
        // Act
        const result = await runCli(args);

        // Assert
        expect(result.stderr).toContain(message);
      });
    }
  });
});

test.describe('コマンドで支出を一覧する', () => {
  test.beforeEach(async ({ request }) => {
    await resetDb(request);
    await seedUsers(request);
  });

  test.describe('一覧の内容', () => {
    test('妻と夫の両方の支出が並ぶ', async () => {
      // Arrange
      await runCli('add -w husband -t "ガス代" -p 3000');
      await runCli('add -w wife -t "スーパー" -p 4280');

      // Act
      const result = await runCli('list');

      // Assert
      expect(result.stdout).toContain('ガス代');
      expect(result.stdout).toContain('スーパー');
    });

    test('合計金額が表示される', async () => {
      // Arrange
      await runCli('add -w husband -t "ガス代" -p 3000');
      await runCli('add -w wife -t "スーパー" -p 4280');

      // Act
      const result = await runCli('list');

      // Assert
      expect(result.stdout).toContain('合計: ¥7,280');
    });

    test('支出がない月は支出がないことが伝わる', async () => {
      // Act
      const result = await runCli('list');

      // Assert
      expect(result.stdout).toContain('支出はありません');
    });
  });

  test.describe('ユーザで絞り込む', () => {
    test.beforeEach(async () => {
      await runCli('add -w husband -t "ガス代" -p 3000');
      await runCli('add -w wife -t "スーパー" -p 4280');
    });

    test('指定したユーザの支出が表示される', async () => {
      // Act
      const result = await runCli('list -w husband');

      // Assert
      expect(result.stdout).toContain('ガス代');
    });

    test('指定していないユーザの支出は表示されない', async () => {
      // Act
      const result = await runCli('list -w husband');

      // Assert
      expect(result.stdout).not.toContain('スーパー');
    });
  });
});
