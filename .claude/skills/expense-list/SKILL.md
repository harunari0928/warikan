---
name: expense-list
description: 割勘の支出をコマンドで一覧する。ユーザと月でフィルタ可能。支出の追加後の確認にも使う。
user-invokable: true
argument-hint: [-w wife|husband] [-m YYYY-MM] e.g. "-w husband", "-m 2026-06"
allowed-tools: Bash
---

# 割勘の支出を一覧

Web API 経由でその月の支出と合計金額を表示する。

```bash
WEB_URL=http://localhost:3120 node packages/cli/dist/index.js list [-w <who>] [-m <yyyy-mm>]
```

## オプション

| オプション | 説明 | デフォルト |
|-----------|------|-----------|
| `-w, --who <who>` | 指定したユーザの支出だけ表示（`wife`, `husband`, `妻`, `夫`） | 両者 |
| `-m, --month <yyyy-mm>` | 対象の月 | 当月（JST） |

固定費テンプレ由来の支出には `[固定費]` が付く。

## 使用例

```bash
# 当月の全支出
node packages/cli/dist/index.js list

# 夫の当月分だけ
node packages/cli/dist/index.js list -w husband

# 先月分
node packages/cli/dist/index.js list -m 2026-06
```
