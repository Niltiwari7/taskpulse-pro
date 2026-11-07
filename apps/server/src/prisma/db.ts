import 'dotenv/config';
import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from './contract';
import contractJson from './contract.json' with { type: 'json' };
import type { SqlMiddleware } from '@prisma/orm-postgres/family-runtime';

export const queryStats = {count: 0};

// Counts every statement (reads and writes); tests use it to catch N+1 queries.
// afterQuery is the hook this runtime calls per statement — afterExecute never fires.
const queryLogger: SqlMiddleware = {
  name: 'query-logger',
  async afterQuery(plan, result) {
    queryStats.count++;

    if(process.env.LOG_SQL){
      console.log(`[sql ${result.latencyMs}ms]`, plan.sql)
    }
  }
}
export const db = postgres<Contract>({
  contractJson,
  url: process.env['DATABASE_URL']!,
  middleware: [queryLogger],
});

// The transaction handle passed to db.transaction callbacks.
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
