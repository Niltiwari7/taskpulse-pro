import 'dotenv/config';
import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from './contract';
import contractJson from './contract.json' with { type: 'json' };
import type { SqlMiddleware } from '@prisma/orm-postgres/family-runtime';

export const queryStats = {count: 0};

const queryLogger: SqlMiddleware = {
  name: 'query-logger',
  async afterExecute(plan, result) {
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
