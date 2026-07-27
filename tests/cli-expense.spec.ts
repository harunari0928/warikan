import { test, expect } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';
import { resetDb, seedUsers, setIncome, closeMonth, TEST_MONTH } from './helpers.js';

const execAsync = promisify(exec);

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

  test('追加した支出が指定したユーザの明細に表示される', async ({ page }) => {
    // Act
    const result = await runCli('add -w husband -t "ガス代" -p 3000');

    // Assert
    await test.step('追加した内容がコマンドの結果に表示される', async () => {
      expect(result.stdout).toContain('夫');
      expect(result.stdout).toContain('ガス代');
      expect(result.stdout).toContain('¥3,000');
    });

    await page.goto('/');
    await page.getByRole('tab', { name: '夫' }).click();

    await test.step('指定したユーザの明細に金額付きで表示される', async () => {
      await expect(page.getByRole('button', { name: /ガス代.*¥3,000/ })).toBeVisible();
    });

    await page.getByRole('tab', { name: '妻' }).click();

    await test.step('指定していないユーザの明細には表示されない', async () => {
      await expect(page.getByRole('button', { name: /ガス代/ })).toBeHidden();
    });
  });

  test.describe('ユーザの指定方法', () => {
    for (const { option, expected } of [
      { option: 'wife', expected: '妻' },
      { option: 'husband', expected: '夫' },
      { option: '妻', expected: '妻' },
      { option: '夫', expected: '夫' },
    ]) {
      test(`「${option}」を指定するとそのユーザの支出として追加される`, async ({ page }) => {
        // Act
        const result = await runCli(`add -w ${option} -t "日用品" -p 1200`);

        // Assert
        await test.step('指定したユーザ名がコマンドの結果に表示される', async () => {
          expect(result.stdout).toContain(expected);
        });

        await page.goto('/');
        await page.getByRole('tab', { name: expected }).click();

        await test.step('そのユーザの明細に表示される', async () => {
          await expect(page.getByRole('button', { name: /日用品/ })).toBeVisible();
        });
      });
    }
  });

  test('メモを付けて追加すると明細にメモが表示される', async ({ page }) => {
    // Act
    await runCli('add -w wife -t "スーパー" -p 4280 -n "週末まとめ買い"');

    // Assert
    await page.goto('/');
    await expect(page.getByRole('button', { name: /週末まとめ買い/ })).toBeVisible();
  });

  test('追加した支出が精算結果に反映される', async ({ page, request }) => {
    // Arrange: 妻30万 / 夫40万 の手取りを登録する
    await setIncome(request, TEST_MONTH, users.wife, 300000);
    await setIncome(request, TEST_MONTH, users.husband, 400000);

    // Act
    await runCli('add -w wife -t "家賃" -p 120000');

    // Assert
    await page.goto('/');

    await test.step('送金の向きが精算結果に表示される', async () => {
      await expect(page.getByText('夫 → 妻')).toBeVisible();
    });
    await test.step('送金額が精算結果に表示される', async () => {
      await expect(
        page.getByRole('region', { name: '月次サマリー' }).getByText('¥110,000'),
      ).toBeVisible();
    });
  });

  test('対象の月を指定して追加すると、その月の明細に入る', async ({ page }) => {
    // Act
    await runCli(`add -w husband -t "先月の電気代" -p 8000 -m ${shiftMonth(TEST_MONTH, -1)}`);

    // Arrange: 夫の明細を当月で開く
    await page.goto('/');
    await page.getByRole('tab', { name: '夫' }).click();

    // Assert
    await test.step('当月の明細には表示されない', async () => {
      await expect(page.getByRole('button', { name: /先月の電気代/ })).toBeHidden();
    });

    // Act
    await page.getByRole('button', { name: '前の月' }).click();

    // Assert
    await test.step('前の月に切り替えると明細に表示される', async () => {
      await expect(page.getByRole('button', { name: /先月の電気代/ })).toBeVisible();
    });
  });

  test('締め済みの月には追加できない', async ({ request, page }) => {
    // Arrange
    await closeMonth(request, TEST_MONTH);

    // Act
    const result = await runCli('add -w wife -t "締め後の支出" -p 500');

    // Assert
    await test.step('締め済みであることが伝わるエラーが表示される', async () => {
      expect(result.stderr).toContain('締め済み');
    });

    await page.goto('/');

    await test.step('明細には追加されない', async () => {
      await expect(page.getByRole('button', { name: /締め後の支出/ })).toBeHidden();
    });
  });

  test('登録されていないユーザを指定すると登録済みユーザを示すエラーになる', async () => {
    // Act
    const result = await runCli('add -w child -t "おやつ" -p 300');

    // Assert
    await test.step('指定したユーザが見つからないことが伝わる', async () => {
      expect(result.stderr).toContain('見つかりません');
    });
    await test.step('登録されているユーザ名が示される', async () => {
      expect(result.stderr).toContain('妻');
      expect(result.stderr).toContain('夫');
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

  test('追加した支出と合計金額が一覧に表示される', async () => {
    // Arrange
    await runCli('add -w husband -t "ガス代" -p 3000');
    await runCli('add -w wife -t "スーパー" -p 4280');

    // Act
    const result = await runCli('list');

    // Assert
    await test.step('両者の支出が表示される', async () => {
      expect(result.stdout).toContain('ガス代');
      expect(result.stdout).toContain('スーパー');
    });
    await test.step('合計金額が表示される', async () => {
      expect(result.stdout).toContain('¥7,280');
    });
  });

  test('ユーザを指定するとそのユーザの支出だけ表示される', async () => {
    // Arrange
    await runCli('add -w husband -t "ガス代" -p 3000');
    await runCli('add -w wife -t "スーパー" -p 4280');

    // Act
    const result = await runCli('list -w husband');

    // Assert
    await test.step('指定したユーザの支出が表示される', async () => {
      expect(result.stdout).toContain('ガス代');
    });
    await test.step('指定していないユーザの支出は表示されない', async () => {
      expect(result.stdout).not.toContain('スーパー');
    });
  });

  test('支出がない月は支出がないことが伝わる', async () => {
    // Act
    const result = await runCli('list');

    // Assert
    expect(result.stdout).toContain('支出はありません');
  });
});
