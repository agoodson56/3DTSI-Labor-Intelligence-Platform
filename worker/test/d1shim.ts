// In-process D1Database emulation over Node's built-in node:sqlite, used by
// the integration tests so the full API can be exercised without workerd
// (which has no Windows ARM64 build).

// @ts-ignore - node:sqlite has no bundled types in this tsconfig
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

class ShimStatement {
  constructor(
    private db: any,
    private sql: string,
    private args: unknown[] = [],
  ) {}

  bind(...args: unknown[]) {
    return new ShimStatement(this.db, this.sql, args);
  }

  private prepared() {
    return this.db.prepare(this.sql);
  }

  async first<T = unknown>(): Promise<T | null> {
    return (this.prepared().get(...(this.args as any[])) ?? null) as T | null;
  }

  async all<T = unknown>(): Promise<{ results: T[]; success: boolean; meta: any }> {
    return { results: this.prepared().all(...(this.args as any[])) as T[], success: true, meta: {} };
  }

  async run(): Promise<{ success: boolean; meta: { last_row_id: number; changes: number } }> {
    const r = this.prepared().run(...(this.args as any[]));
    return { success: true, meta: { last_row_id: Number(r.lastInsertRowid), changes: Number(r.changes) } };
  }
}

export function createTestDb(path = ':memory:'): any {
  const db = new DatabaseSync(path);
  db.exec(`CREATE TABLE IF NOT EXISTS _applied_migrations (name TEXT PRIMARY KEY)`);
  const applied = new Set(
    (db.prepare(`SELECT name FROM _applied_migrations`).all() as any[]).map((r) => r.name),
  );
  const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
  for (const file of readdirSync(migrationsDir).sort()) {
    if (!file.endsWith('.sql') || applied.has(file)) continue;
    db.exec(readFileSync(join(migrationsDir, file), 'utf-8'));
    db.prepare(`INSERT INTO _applied_migrations (name) VALUES (?)`).run(file);
  }

  return {
    prepare: (sql: string) => new ShimStatement(db, sql),
    batch: async (statements: ShimStatement[]) => {
      const out = [];
      for (const s of statements) out.push(await s.run());
      return out;
    },
    exec: async (sql: string) => db.exec(sql),
    _raw: db,
  };
}
