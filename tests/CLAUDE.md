# E2E Tests

Playwright E2E tests（割勘ロジック、支出CRUD、月の締め、固定費自動投入、ユーザ切替、月ごとの手取り）。

## Setup

- `playwright.config.ts` が 2 つの webServer を起動: Express API を `:3121`、Vite を `:5184`。
- 各テストは `POST /api/test/reset` で DB をクリーンにしてから実行する。
- テスト用 DB は `data/test_warikan.db`（本番と分離）。
- viewport は `412×915`（Pixel 7a 想定）。`devices['Pixel 7']` は使わない（タッチ/モバイル emulation が click を妨げるため）。
- `helpers.ts` に共通セットアップ（`resetDb`, `seedUsers`, `ensureMonth`, `setIncome`, `addExpense`, `addFixedTemplate`）。

## settlement.spec.ts

割勘ロジックの検証（送金の方向・金額、精算不要）。UI 上の「妻→夫 / 夫→妻」「送金額」「精算不要」表示で確認する。

## expense-crud.spec.ts

支出の追加・編集・削除、ユーザ切替で表示される支出が変わること。

## close-month.spec.ts

月の締めとロック、締め後の表示（FAB 非表示・行の薄表示・締めを解除）、精算済みチェックの操作可否。

## future-month.spec.ts

未来月へ進めないこと、精算済みチェックは締めるまで操作不可なこと。

## fixed-template-seed.spec.ts

月を初めて開いたときの固定費テンプレ自動投入、再度開いても二重投入されないこと。

## fixed-template-admin.spec.ts

固定費テンプレート管理画面（設定 → `#/templates`）の操作。テンプレートを削除すると一覧から消えること。

## user-switch.spec.ts

妻/夫タブの切替、localStorage での永続化、自分の手取りだけ編集できること。

## monthly-income.spec.ts

月を切り替えると、その月の手取りが表示されること。

## Test conventions

**原則: 「このテストはユーザの何を守っているのか？」を常に問うこと。** テストはエンドユーザの仕様を表現するドキュメントであり、実装の正しさを確認するためのものではない。この問いなしにテストを書くと、自然とAPI/DBの値を直接確認する実装の鏡になってしまう。

- 1つのテスト内で複数の観点（表示確認・データ確認・状態変化など）を検証する場合は `test.step` で分割すること。
- E2EテストではAPIやDBを直接確認しない。UIに表示される値（input値、ボタン状態、テキスト等）をユーザ視点で検証すること。保存の確認はリロード後のUI状態で行う。
- テスト項目はエンドユーザ視点で記述する。実装詳細（tagName, CSS class等）を直接検証せず「テキストが表示されている」「入力欄が編集できない」等のユーザが認識できる振る舞いで検証する。
- テストケース名・step名にはDBカラム名やコード内部の識別子（`is_closed`, `settlement_paid`, `fixed_seeded_at`, `monthly_incomes`等）を使わず、UI上の表示やドメイン用語（締め済、精算済み、手取り、固定費等）を使うこと。
- `test.step` は検証項目（assertion）のみに使用する。操作手順（クリック・入力等のセットアップ）は `test.step` の外に記述する。
- 1つのテストに複数の異なる機能・状態を詰め込まない。状態ごとにテストを分割する。
- テスト記述やテスト名で「他の」等の曖昧な表現を避け、具体的な操作対象（ボタン名等）を明記する。
- 同じ検証を複数パターンで行う場合は `for...of` 等で全パターンを網羅する。
- テストファイル内では `test.describe` で機能グループごとにテストをまとめること。観点の異なるテストをフラットに並べない。
- AAAパターン（Arrange-Act-Assert）を守ること。`test.step` はAssert（検証）にのみ使用する。Arrange（前提条件のセットアップ）やAct（テスト対象の操作）は `test.step` の外に記述する。Arrange/Act/Assertの各セクションは空行で明確に分離する。
- `expect` はAssertセクションでのみ使用する。Arrange/Actで状態を待機する場合は `waitFor()` 等を使うこと（例: `await element.waitFor({ state: 'hidden' })` ）。
- Playwright推奨のロケータ（`getByRole`, `getByLabel`, `getByText`等）を優先する。`page.locator(CSSセレクタ)` は最終手段として使用する。
- テスト名・step名は仕様（ユーザにとっての振る舞い）を表現する。実装の動作（「409を返す」「成功する」「settlement_paidが立つ」等）ではなく、ユーザ視点の結果（「締め後は手取りを編集できない」「妻→夫の送金額が表示される」「精算不要と表示される」等）で書く。
- `test.step` は検証が1つだけのテストでは不要。複数の観点がある場合にのみ使う。
- セクション区切りに `// ---` コメントを使わず、`test.describe` でグループ化する。
- テストはそのテストが検証する機能の責務を持つファイルに配置する。例：割勘ロジックに関するテストは settlement.spec.ts に、支出のCRUD UIに関するテストは expense-crud.spec.ts に、月の締め・ロックに関するテストは close-month.spec.ts に置く。
- アプリのエンドユーザ仕様でないもの（seed importの冪等性、デプロイ運用、APIステータスコード単体等）はE2Eテストに含めない。
- 送金方向はコード内部の符号（送金額 `x` の正負）ではなくUI上の表示（「妻→夫」「夫→妻」「精算不要」）でテスト名・検証を書く。
