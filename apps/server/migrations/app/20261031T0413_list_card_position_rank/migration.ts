#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/550418294928c7bf9fee20fd849862de9a4eb1f2b96fff5fa85891b31749625a/contract';
import startContract from '../../snapshots/550418294928c7bf9fee20fd849862de9a4eb1f2b96fff5fa85891b31749625a/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/e39f246bb6c493327c2e75c176c974352b8064dcc6311ca2b339fa4aa4ff46d5/contract';
import endContract from '../../snapshots/e39f246bb6c493327c2e75c176c974352b8064dcc6311ca2b339fa4aa4ff46d5/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, rawSql } from '@prisma/orm-postgres/migration';

// Same alphabet as src/shared/rank.ts.
const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';
// Two-char keys "i1".."zz": first char starts at the midpoint ("i") so there is
// room to insert above row 1; second char skips "0" (rank keys can't end in it).
const MAX_ROWS_PER_PARENT = 18 * 35;

// Rewrites the float-cast-to-text positions as rank keys, keeping each parent's
// existing order.
function backfillRank(table: 'Card' | 'List', parentColumn: string) {
  const t = `"public"."${table}"`;
  return rawSql({
    id: `backfillRank.${table}.position`,
    label: `Backfill rank keys into "position" on "${table}"`,
    operationClass: 'data',
    target: {
      id: 'postgres',
      details: { schema: 'public', objectType: 'column', name: 'position', table },
    },
    precheck: [
      {
        description: `ensure no "${parentColumn}" has more than ${MAX_ROWS_PER_PARENT} rows`,
        sql: `SELECT NOT EXISTS (SELECT 1 FROM ${t} GROUP BY "${parentColumn}" HAVING count(*) > ${MAX_ROWS_PER_PARENT}) AS "result"`,
      },
    ],
    execute: [
      {
        description: `rewrite "position" as rank keys ordered by the old numeric position`,
        sql:
          `UPDATE ${t} AS t SET "position" = ` +
          `substr('${DIGITS}', 19 + (r.i / 35)::int, 1) || substr('${DIGITS}', 2 + (r.i % 35)::int, 1) ` +
          `FROM (SELECT "id", row_number() OVER (PARTITION BY "${parentColumn}" ORDER BY "position"::float8, "id") - 1 AS i FROM ${t}) AS r ` +
          `WHERE t."id" = r."id"`,
      },
    ],
    postcheck: [
      {
        description: `verify every "position" is a rank key`,
        sql: `SELECT NOT EXISTS (SELECT 1 FROM ${t} WHERE "position" !~ '^[i-z][1-9a-z]$') AS "result"`,
      },
    ],
  });
}

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.alterColumnType({
        schema: 'public',
        table: 'Card',
        column: 'position',
        options: {
          qualifiedTargetType: 'text',
          formatTypeExpected: 'text',
          rawTargetTypeForLabel: 'text',
        },
      }),
      backfillRank('Card', 'listId'),
      this.alterColumnType({
        schema: 'public',
        table: 'List',
        column: 'position',
        options: {
          qualifiedTargetType: 'text',
          formatTypeExpected: 'text',
          rawTargetTypeForLabel: 'text',
        },
      }),
      backfillRank('List', 'boardId'),
      this.createIndex({
        schema: 'public',
        table: 'List',
        index: 'List_boardId_position_idx_5df470fd',
        columns: ['boardId', 'position'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
