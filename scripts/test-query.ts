import { getDB } from './src/lib/db';
import { chapters } from './src/db/schema';

async function run() {
  const db = getDB(process.env as any);
  const data = await db.select().from(chapters).all();
  console.log(JSON.stringify(data.slice(-5), null, 2));
}
run();
