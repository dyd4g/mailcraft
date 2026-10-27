import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import * as campaignSchema from './campaign-schema';
import * as authSchema from './auth-schema';

const fullSchema = { ...schema, ...campaignSchema, ...authSchema };
type Connection = { pool: Pool; db: ReturnType<typeof create> };
function create(pool: Pool) { return drizzle(pool, { schema: fullSchema }); }
export type Db = ReturnType<typeof create>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

// One pool per server process; kept on globalThis so development reloads do not open extra connections.
const holder = globalThis as typeof globalThis & { __mailcraftDb?: Connection };

export function getDb(): Db {
  if (!holder.__mailcraftDb) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set. Point it at the PostgreSQL database, for example postgres://user:password@host:5432/mailcraft");
    }
    const pool = new Pool({ connectionString, max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000 });
    // A dropped idle connection must not crash the process; the pool replaces it.
    pool.on("error", (error) => console.error("PostgreSQL pool error", error.message));
    holder.__mailcraftDb = { pool, db: create(pool) };
  }
  return holder.__mailcraftDb.db;
}

/** First row of a query result, or undefined. Used as `.then(first)` on select builders. */
export const first = <T,>(rows: T[]): T | undefined => rows[0];
