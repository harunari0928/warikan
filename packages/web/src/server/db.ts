import Database from 'better-sqlite3';

const DB_PATH = process.env.DB_PATH || './data/warikan.db';

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!dbInstance) {
    dbInstance = new Database(DB_PATH);
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');
    dbInstance.pragma('busy_timeout = 5000');
    runMigrations(dbInstance);
  }
  return dbInstance;
}

type Migration = {
  version: number;
  up: (db: Database.Database) => void;
};

const migrations: Migration[] = [
  {
    version: 1,
    up: (db) => {
      db.exec(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          display_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE months (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          year_month TEXT NOT NULL UNIQUE,
          is_closed INTEGER NOT NULL DEFAULT 0,
          closed_at TEXT,
          settlement_paid INTEGER NOT NULL DEFAULT 0,
          settlement_paid_at TEXT,
          fixed_seeded_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE monthly_incomes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          month_id INTEGER NOT NULL REFERENCES months(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id),
          amount INTEGER NOT NULL DEFAULT 0,
          UNIQUE(month_id, user_id)
        );

        CREATE TABLE expenses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          month_id INTEGER NOT NULL REFERENCES months(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id),
          description TEXT NOT NULL,
          amount INTEGER NOT NULL,
          note TEXT,
          is_fixed INTEGER NOT NULL DEFAULT 0,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        );
        CREATE INDEX idx_expenses_month_user ON expenses(month_id, user_id);

        CREATE TABLE fixed_expense_templates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id),
          description TEXT NOT NULL,
          amount INTEGER NOT NULL,
          note TEXT,
          is_active INTEGER NOT NULL DEFAULT 1,
          display_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);
    },
  },
];

export function runMigrations(db: Database.Database): void {
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)');

  const row = db.prepare('SELECT MAX(version) as v FROM schema_version').get() as { v: number | null };
  const currentVersion = row?.v ?? 0;

  const applyMigration = db.transaction((migration: Migration) => {
    migration.up(db);
    db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(migration.version);
  });

  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      applyMigration(migration);
    }
  }
}
