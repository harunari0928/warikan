#!/usr/bin/env node
import { Command } from 'commander';
import { getCurrentMonthJST, isValidYearMonth } from '@warikan/shared';
import { apiFetch, formatYen, resolveUser, type Expense, type User } from './api.js';

function fail(message: string): never {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function parseMonth(month: string | undefined): string {
  const ym = month ?? getCurrentMonthJST();
  if (!isValidYearMonth(ym)) fail(`月の形式が正しくありません: ${ym}（YYYY-MM で指定してください）`);
  return ym;
}

function parsePrice(value: string): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    fail(`金額は0以上の数値で指定してください: ${value}`);
  }
  return Math.round(amount);
}

/** その月のレコードと固定費の自動投入を Web 側と同じ経路で済ませる。 */
async function ensureMonth(ym: string): Promise<void> {
  await apiFetch('GET', `/api/months/${ym}`);
}

const program = new Command();

program.name('wk').description('Warikan CLI').version('1.0.0');

program
  .command('add')
  .description('割勘の支出を追加する')
  .requiredOption('-w, --who <who>', 'どちらの支出か (wife|husband|妻|夫)')
  .requiredOption('-t, --title <title>', '品目名')
  .requiredOption('-p, --price <yen>', '金額（円）')
  .option('-m, --month <yyyy-mm>', '対象の月（デフォルト: 当月）')
  .option('-n, --note <text>', 'メモ')
  .action(async (opts: { who: string; title: string; price: string; month?: string; note?: string }) => {
    const ym = parseMonth(opts.month);
    const amount = parsePrice(opts.price);
    const title = opts.title.trim();
    if (!title) fail('品目名を指定してください');

    try {
      const user = await resolveUser(opts.who);
      await ensureMonth(ym);
      const expense = await apiFetch<Expense>('POST', `/api/months/${ym}/expenses`, {
        user_id: user.id,
        description: title,
        amount,
        note: opts.note ?? null,
      });
      console.log(`${ym} ${user.name}: ${expense.description} ${formatYen(expense.amount)} を追加しました。`);
    } catch (e: unknown) {
      fail((e as Error).message);
    }
  });

program
  .command('list')
  .description('割勘の支出を一覧する')
  .option('-w, --who <who>', '指定したユーザの支出だけ表示する (wife|husband|妻|夫)')
  .option('-m, --month <yyyy-mm>', '対象の月（デフォルト: 当月）')
  .action(async (opts: { who?: string; month?: string }) => {
    const ym = parseMonth(opts.month);

    try {
      const users = await apiFetch<User[]>('GET', '/api/users');
      const filter = opts.who ? await resolveUser(opts.who) : null;
      await ensureMonth(ym);
      const expenses = await apiFetch<Expense[]>('GET', `/api/months/${ym}/expenses`);
      const shown = filter ? expenses.filter((e) => e.user_id === filter.id) : expenses;

      if (shown.length === 0) {
        console.log(`${ym} の支出はありません。`);
        return;
      }

      const nameOf = (userId: number) => users.find((u) => u.id === userId)?.name ?? '?';
      console.log(`${ym} の支出\n`);
      let total = 0;
      for (const e of shown) {
        const fixed = e.is_fixed ? ' [固定費]' : '';
        console.log(`${String(e.id).padStart(4)}  ${nameOf(e.user_id)}  ${e.description}  ${formatYen(e.amount)}${fixed}`);
        total += e.amount;
      }
      console.log(`\n合計: ${formatYen(total)}`);
    } catch (e: unknown) {
      fail((e as Error).message);
    }
  });

program.parse();
