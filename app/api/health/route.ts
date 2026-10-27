import { sql } from 'drizzle-orm';
import { getDb } from '@/db';

// Public, minimal health check for the hosting platform: confirms the server is up and can reach the database.
export async function GET() {
  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
