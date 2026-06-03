# E2E Tests

Playwright E2E tests.

## Setup

- `playwright.config.ts` は2つの webServer を起動: Express を `:3121`、Vite を `:5184`。
- 各テストは冒頭で `POST /api/test/reset` を呼んで DB をクリーンにする（`helpers.ts` の `resetDb`）。
- Test DB: `data/test_warikan.db`（本番とは別）。
- viewport は `412×915`（Pixel 7a 想定）。`devices['Pixel 7']` は使わない（タッチ/モバイル emulation が click を妨げるため）。

## settlement.spec.ts

割勘ロジックの検証。手取り・支出を入力し、精算結果（送金の向きと金額）が正しく表示されることを確認する。

## expense-crud.spec.ts

支出の追加・編集・削除、およびユーザ切替で表示される明細が変わることの確認。

## close-month.spec.ts

月の締めE2E。締めると支出・手取りが編集できなくなり、精算済みチェックが操作可能になる等。

## fixed-template-seed.spec.ts

固定費テンプレートの自動投入。月を初めて開くとアクティブなテンプレートが展開され、再表示しても二重にならない。

## future-month.spec.ts

未来月のブロック、および精算済みチェックの締め前ロック。

## fixed-template-admin.spec.ts

固定費テンプレート管理画面（設定 → `#/templates`）。テンプレートを削除すると一覧から消えることの確認。

## user-switch.spec.ts

ユーザ切替と、自分以外の手取りが編集できないことの確認。

## monthly-income.spec.ts

月を切り替えると、その月の手取りが表示されることの確認。

## APIエラー時のロールバックとトースト通知

入力操作中に API がエラーを返したとき、エラーがトーストで通知され、画面上の変更が操作前の状態へロールバックされることを検証する。**専用ファイルにまとめず、各操作の責務を持つスペックに混ぜて配置する**:

- 支出 追加/編集/削除 → `expense-crud.spec.ts`
- 手取り保存（→精算結果のロールバック） → `settlement.spec.ts`
- 月の締め/解除・精算済み → `close-month.spec.ts`
- 固定費テンプレ 追加/編集/削除 → `fixed-template-admin.spec.ts`

`helpers.ts` の `failApi(page, urlGlob, method)` で対象メソッドのリクエストだけを 500 に差し替え、`SAVE_ERROR_TOAST` でトースト文言を検証する。手取り入力欄は入力中ドラフトが残るため、ロールバックは精算結果の表示で確認する。

## Test conventions

**原則: 「このテストはユーザの何を守っているのか？」を常に問うこと。** テストはエンドユーザの仕様を表現するドキュメントであり、実装の正しさを確認するためのものではない。この問いなしにテストを書くと、自然とAPI/DBの値を直接確認する実装の鏡になってしまう。

- 1つのテスト内で複数の観点（表示確認・データ確認・状態変化など）を検証する場合は `test.step` で分割すること。
- E2EテストではAPIやDBを直接確認しない。UIに表示される値（input値、ボタン状態、テキスト等）をユーザ視点で検証すること。保存の確認はリロード後のUI状態で行う。
- テスト項目はエンドユーザ視点で記述する。実装詳細（tagName, CSS class, localStorage等）を直接検証せず「テキストが表示されている」「入力欄が編集できない」等のユーザが認識できる振る舞いで検証する。
- テストケース名・step名にはDBカラム名やコード内部の識別子（`is_closed`, `settlement_paid`, `user_id`等）を使わず、UI上の表示やドメイン用語（締め済み、精算済み、手取り等）を使うこと。
- `test.step` は検証項目（assertion）のみに使用する。操作手順（クリック・入力等のセットアップ）は `test.step` の外に記述する。
- 1つのテストに複数の異なる機能・状態を詰め込まない。状態ごとにテストを分割する。
- テスト記述やテスト名で「他の」等の曖昧な表現を避け、具体的な操作対象（ボタン名等）を明記する。
- 同じ検証を複数パターンで行う場合は `for...of` 等で全パターンを網羅する。
- テストファイル内では `test.describe` で機能グループごとにテストをまとめること。観点の異なるテストをフラットに並べない。
- AAAパターン（Arrange-Act-Assert）を守ること。`test.step` はAssert（検証）にのみ使用する。Arrange（前提条件のセットアップ）やAct（テスト対象の操作）は `test.step` の外に記述する。Arrange/Act/Assertの各セクションは空行で明確に分離する。
- `expect` はAssertセクションでのみ使用する。Arrange/Actで状態を待機する場合は `waitFor()` 等を使うこと（例: `await element.waitFor({ state: 'hidden' })` ）。
- Playwright推奨のロケータ（`getByRole`, `getByLabel`, `getByText`等）を優先する。`page.locator(CSSセレクタ)` は最終手段として使用する。
- テスト名・step名は仕様（ユーザにとっての振る舞い）を表現する。実装の動作ではなく、ユーザ視点の結果で書く。
- `test.step` は検証が1つだけのテストでは不要。複数の観点がある場合にのみ使う。
- セクション区切りに `// ---` コメントを使わず、`test.describe` でグループ化する。
- テストはそのテストが検証する機能の責務を持つファイルに配置する（例: 割勘ロジックは settlement.spec.ts、支出CRUDは expense-crud.spec.ts）。
- アプリのエンドユーザ仕様でないもの（seed importの冪等性、デプロイ運用、APIステータスコード等）はE2Eテストに含めない。
- 金額は円・整数で扱い、表示は `¥110,000` のようにUI上の表記でアサートする。
