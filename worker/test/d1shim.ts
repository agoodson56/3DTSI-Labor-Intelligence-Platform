// In-process D1Database emulation over Node's built-in node:sqlite, used by
// the integration tests so the full API can be exercised without workerd
// (which has no Windows ARM64 build).

// @ts-ignore - node:sqlite has no bundled types in this tsconfig
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

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

export function createTestDb(): any {
  const db = new DatabaseSync(':memory:');
  const migrationsDir = join(__dirname, '..', 'migrations');
  for (const file of readdirSync(migrationsDir).sort()) {
    if (file.endsWith('.sql')) db.exec(readFileSync(join(migrationsDir, file), 'utf-8'));
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
