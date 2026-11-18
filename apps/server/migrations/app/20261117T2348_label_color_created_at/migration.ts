#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/de639faf921b9159e7364ec1c2e70199e61c2021bd9726bd2894fe9fde40bd16/contract';
import startContract from '../../snapshots/de639faf921b9159e7364ec1c2e70199e61c2021bd9726bd2894fe9fde40bd16/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/fa4475000be70e98aebb2f83c64637ec0ff33bd890f5c784e8a133723cb32f57/contract';
import endContract from '../../snapshots/fa4475000be70e98aebb2f83c64637ec0ff33bd890f5c784e8a133723cb32f57/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, placeholder } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'Label',
        column: col('createdAt', 'timestamptz', {
          notNull: true,
          default: fn('now()'),
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
      this.setNotNull({ schema: 'public', table: 'Label', column: 'color' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
