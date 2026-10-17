import * as SQLite from 'expo-sqlite';

const MIGRATIONS = [
  `CREATE TABLE transactions (id TEXT PRIMARY KEY NOT NULL, occurred_at INTEGER NOT NULL, data TEXT NOT NULL);
   CREATE INDEX transactions_occurred_at ON transactions (occurred_at);
   CREATE TABLE meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);`,
];

let db: Promise<SQLite.SQLiteDatabase> | null = null;

async function migrate(conn: SQLite.SQLiteDatabase) {
  const row = await conn.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  for (let v = row?.user_version ?? 0; v < MIGRATIONS.length; v++) {
    await conn.withExclusiveTransactionAsync(async (txn) => {
      await txn.execAsync(MIGRATIONS[v]);
      await txn.execAsync(`PRAGMA user_version = ${v + 1}`);
    });
  }
  return conn;
}

export function getDb() {
  db ??= SQLite.openDatabaseAsync('expense-tracker.db').then(migrate);
  return db;
}
