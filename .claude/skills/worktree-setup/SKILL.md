---
name: worktree-setup
description: Worktree作成後にDocker Compose用の.envポート設定・コンテナ起動・初期データ投入を行う
user-invocable: false
---

# Worktree Docker環境セットアップ

EnterWorktreeでworktreeを作成した直後に自動実行する。メインのDocker Composeとポートが競合しないよう`.env`を配置し、コンテナを起動する。

## Steps

1. worktreeルートに`.env`を作成（ポートだけworktree用に設定）:
   ```
   WEB_PORT=3220
   ```
2. `docker compose up -d --build web` でwebコンテナをビルド＆起動
3. `data/`ディレクトリのパーミッションを修正（Dockerがroot権限で作成するため、テスト実行時に書き込めるようにする）:
   ```bash
   docker run --rm -v "$(pwd)/data:/data" alpine chmod -R 777 /data
   ```
4. 初回のみ、ユーザ（妻/夫）と固定費テンプレを投入:
   ```bash
   ./scripts/seed.sh http://localhost:3220
   ```
5. 起動後、ユーザに開発URL `http://localhost:<WEB_PORT>` を案内する

## Notes

- メインリポジトリはデフォルトポート（WEB_PORT=3120）を使用
- worktreeのDocker Composeプロジェクト名はディレクトリ名で自動分離される
- `.env`は`.gitignore`済みなのでコミット不要
- ポート競合時は`ss -tlnp`で使用中のポートを確認し、空きポートを使う
