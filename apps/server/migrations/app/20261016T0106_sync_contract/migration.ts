#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/45a12f64929c908c8fb0104192d371699b8d86e1d9feb960031d7cc149b49bd9/contract';
import startContract from '../../snapshots/45a12f64929c908c8fb0104192d371699b8d86e1d9feb960031d7cc149b49bd9/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/6f9058512882853b4a7643e4ae9a3080acb0becb25e4da0b2615b963a92d9093/contract';
import endContract from '../../snapshots/6f9058512882853b4a7643e4ae9a3080acb0becb25e4da0b2615b963a92d9093/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  col,
  fn,
  primaryKey,
} from '@prisma/orm-postgres/migration';
import postgres from '@prisma/orm-postgres/runtime';

const { sql: db, contract } = postgres<End>({ contractJson: endContract });

// Users created before auth existed have no password. Give them an argon2 hash
// of a random, discarded secret: verify() returns false (401) rather than
// throwing on a malformed hash, and the account stays locked until a reset.
const LOCKED_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,p=4,t=3$4SrmJYSEYxD2ecqzQAvxbw$wrJCUHGQ1P6k/j5M4vnf2n6Udeb+gFcz9RMfXF8IVsg';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'Session',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('tokenHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'User',
        column: col('passwordHash', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.dataTransform(contract, 'backfill-User-passwordHash', {
        check: () =>
          db.public.User.select('id')
            .where((f, fns) => fns.eq(f.passwordHash, null))
            .limit(1),
        run: () =>
          db.public.User.update({ passwordHash: LOCKED_PASSWORD_HASH }).where(
            (f, fns) => fns.eq(f.passwordHash, null)
          ),
      }),
      this.setNotNull({ schema: 'public', table: 'User', column: 'passwordHash' }),
      this.addUnique({
        schema: 'public',
        table: 'Session',
        constraint: 'Session_tokenHash_key',
        columns: ['tokenHash'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Session',
        index: 'Session_expiresAt_idx_6b6b8c10',
        columns: ['expiresAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Session',
        index: 'Session_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Session',
        foreignKey: {
          name: 'Session_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
