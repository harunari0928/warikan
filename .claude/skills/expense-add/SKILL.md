---
name: expense-add
description: 割勘の支出をコマンドで追加する。妻/夫のどちらの支出か・品目名・金額を指定する。対象の月とメモは任意。
user-invokable: true
argument-hint: -w wife|husband -t TITLE -p YEN [-m YYYY-MM] [-n NOTE] e.g. "-w husband -t ガス代 -p 3000"
allowed-tools: Bash
---

# 割勘の支出を追加

Web API 経由でその月の支出を1件追加する。月のレコード作成と固定費テンプレの自動投入も画面と同じ経路で行われる。

```bash
WEB_URL=http://localhost:3120 node packages/cli/dist/index.js add \
  -w <who> -t <title> -p <yen> [-m <yyyy-mm>] [-n <note>]
```

## 必須オプション

| オプション | 説明 | 有効値 |
|-----------|------|--------|
| `-w, --who` | どちらの支出か | `wife`, `husband`, `妻`, `夫` |
| `-t, --title` | 品目名 | 1文字以上 |
| `-p, --price` | 金額（円・整数） | 0以上の数値 |

## 任意オプション

| オプション | 説明 | デフォルト |
|-----------|------|-----------|
| `-m, --month <yyyy-mm>` | 対象の月 | 当月（JST） |
| `-n, --note <text>` | メモ | なし |

## 使用例

```bash
# 夫のガス代3000円を当月に追加
node packages/cli/dist/index.js add -w husband -t "ガス代" -p 3000

# 妻の買い物をメモ付きで追加
node packages/cli/dist/index.js add -w wife -t "スーパー" -p 4280 -n "週末まとめ買い"

# 先月分を追加
node packages/cli/dist/index.js add -w husband -t "電気代" -p 8000 -m 2026-06
```

## 注意

- 締め済みの月には追加できない（エラーになる）。追加するには画面から締めを解除する。
- 未来の月は指定できない。
- `WEB_URL` は接続先。デフォルトは `http://localhost:3120`（本番と同じポート）。
