# Warikan — 夫婦の月次割勘精算 Web アプリ

Google スプレッドシートで運用していた割勘精算ワークフローをリプレイスしたもの。自宅サーバで Docker Compose で動かし、Tailscale 経由でアクセスする。

## Architecture

- `shared/` — 共有ユーティリティ（日付・割勘ロジック）。`@warikan/shared` として publish。
- `packages/web/` — React 19 + Vite フロントエンド + Express.js バックエンド、SQLite (better-sqlite3)。
- `tests/` — Playwright E2E（割勘ロジック、支出CRUD、月の締め、固定費自動投入、ユーザ切替、レシートOCR）。
- `scripts/` — 初期セットアップ（妻/夫ユーザと固定費テンプレ投入）。

## Domain model

- `users` — 妻と夫。`display_order` で並び順を制御（先頭がデフォルト表示ユーザ）。
- `months` — 月ごとの状態。`is_closed` で締めをロック、`settlement_paid` で送金完了フラグ、`fixed_seeded_at` で固定費自動投入済みかを管理。
- `monthly_incomes` — その月の妻/夫の手取り。
- `expenses` — その月の支出。`user_id` でどちらの表に入れるかを区別。`is_fixed=1` は固定費テンプレ由来。
- `fixed_expense_templates` — 家賃・通信費などの固定費テンプレートのマスタ。

## 割勘ロジック

両者が「同じ残額（手取り - 支出 - 送金）」になるように調整する。妻 A・夫 B、妻支出 P・夫支出 Q とすると、妻 → 夫 への送金額 `x` は:

```
x = (A + Q - B - P) / 2
```

- `x > 0`: 妻 → 夫 に `x` 円
- `x < 0`: 夫 → 妻 に `|x|` 円
- `x = 0`: 精算不要

実装は `shared/settlement.ts` の `calculateSettlement(a, b)`。

## 月の初期化と固定費自動投入

`GET /api/months/:yyyymm` が呼ばれた時点で、その月のレコードを `INSERT OR IGNORE` し、`fixed_seeded_at IS NULL` ならアクティブな `fixed_expense_templates` を `expenses` に展開する。全体は `db.transaction(...).immediate()` で同時実行を排他。

**既存月に対するテンプレ追加は遡及投入しない**（混乱回避）。テンプレを当月に反映したいときは固定費画面から手動で当月の expenses に追加する運用。

## レシートOCR

FAB「＋」→「レシートを撮影」でカメラ起動 → 画像を `POST /api/ocr/receipt` に送信し、OpenAI `gpt-4o-mini`（画像 + Structured Outputs）で明細を抽出する。

- リクエスト: `{ image: dataURL, filename?: string }`。クライアントは canvas で長辺1500pxへ縮小・JPEG化して送る（`resizeImageToDataUrl`）。
- 各品目の税率(0.08/0.10)を判定し**税込整数円**で返す。**税率が判定できなかった場合は `taxRate: null`（要確認）で返し**、明細自体が1件も取れないときだけ 422 `レシートから明細を読み取れませんでした` を返す。
- レスポンス: `{ store, items: [{ name, taxRate: number | null, amount }] }`。ユーザがチェックで取捨選択し、選んだ品目を既存の `POST /api/months/:yyyymm/expenses` に1件ずつ登録する（新規書き込みAPIは増やさない）。
- **確認ダイアログで税率を編集できる**（`ReceiptScanDialog.tsx`）。税率バッジはタップで 8% ⇔ 10% を切り替えるボタン。`taxRate: null` の明細は amber の「税率を選択」で表示し、選ぶまで追加ボタンは非活性。税率を変えると税込金額を再計算する（不変の `baseAmount`/`baseRate` から `round(baseAmount / (1+baseRate) * (1+newRate))`。要確認の明細は最初に選んだ税率を基準として採用し金額は変えない）。
- 実装は `packages/web/src/server/routes/ocr.ts`。OpenAI SDK は使わず標準 `fetch` で REST を叩く（依存追加・Docker build への影響なし）。
- **テスト/スタブ**: `NODE_ENV!=='production'` かつ `OPENAI_API_KEY` 未設定なら OpenAI を呼ばず決定論的フィクスチャを返す。`filename` に `no-tax` を含めば税率が判定できなかったケース（要確認）を再現。CI はキー不要。

## Development

```bash
# 初回
pnpm install
pnpm --filter shared build

# 開発サーバ起動（Docker Composeでも、ローカルでも）
docker compose up -d
# または
DB_PATH=data/dev.db PORT=3110 pnpm --filter web exec tsx src/server/index.ts &
API_PORT=3110 pnpm --filter web exec vite --port 5180

# 初期データ投入
./scripts/seed.sh http://localhost:3120
```

ローカルビルド:

```bash
pnpm --filter shared build   # 先にshared
pnpm --filter web build      # vite (client) + tsc (server)
```

## Testing

```bash
npx playwright test                              # 全テスト
npx playwright test tests/settlement.spec.ts     # 割勘ロジック単体
npx playwright test tests/close-month.spec.ts    # 月の締めE2E
```

- Playwright は Express API を `:3121`、Vite を `:5184` で起動。
- viewport は `412×915`（Pixel 7a 想定）。`devices['Pixel 7']` は使わない（タッチ/モバイル emulation が click を妨げるため）。
- 各テストは `POST /api/test/reset` で DB をクリーンにしてから実行。
- `data/test_warikan.db` を使用。

テスト作成時の方針・規約は [`tests/CLAUDE.md`](tests/CLAUDE.md) を参照（household-tasks と同じユーザ目線の規約を共有）。

## Deployment

```bash
docker compose up -d           # web + watchtower
./scripts/seed.sh              # 初回のみ: ユーザ・固定費テンプレを投入
```

- ポート: `WEB_PORT`（デフォルト 3120）。`127.0.0.1` と `100.121.247.20`（Tailscale Local IP）にバインド。
- Watchtower で `warikan` スコープのコンテナを5分ごとにポーリング更新。
- DB は `./data/warikan.db`（コンテナの `/data`）。

## Environment variables

- `DB_PATH` (必須): SQLite ファイルパス。デフォルト `./data/warikan.db`。
- `PORT` (必須): Express ポート。デフォルト 3100。
- `TZ`: タイムゾーン（`Asia/Tokyo` を強く推奨）。
- `OPENAI_API_KEY`: レシートOCR用。本番では必須。未設定かつ非本番ならOCRはスタブ動作。
- `TEST_TODAY`: テスト時に「今日」を上書き（YYYY-MM-DD）。
- `TEST_NOW`: テスト時に ISO 時刻を上書き。
- `NODE_ENV=production` のとき `POST /api/test/reset` は無効化。

## Key conventions

- 金額は全て**整数（円）**で保持・APIやり取り。
- 日付は JST。`shared/date.ts` の `getTodayJST()` / `getCurrentMonthJST()` を使う。
- 月の文字列は `YYYY-MM` 形式。`isValidYearMonth()` で検証。
- 締め済み (`is_closed=1`) の月は支出と手取りの変更を 409 で拒否。`settlement_paid` のみ締め後でも変更可（送金は締めの後に行うため）。
- ユーザ切替は localStorage `warikan.currentUserId` で永続化（household-tasks と同じパターン）。
- Express の `app` / `router` には明示的な型注釈をつける（pnpm のモジュール解決で TS2742 を避けるため）。
- `package.json` の `pnpm.onlyBuiltDependencies` に `better-sqlite3` と `esbuild` を含める（ないと Docker build で native module ロードに失敗する）。
- FAB は inline style で `position: fixed` を指定（Tailwind の `fixed` クラスは設定によっては JIT が拾いきれないため）。
