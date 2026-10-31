#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/2e32e02144c68021e4513fe3a6c5cd02ff8f0c800e50b1425317673cd36b71ec/contract';
import endContract from '../../snapshots/2e32e02144c68021e4513fe3a6c5cd02ff8f0c800e50b1425317673cd36b71ec/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/e39f246bb6c493327c2e75c176c974352b8064dcc6311ca2b339fa4aa4ff46d5/contract';
import startContract from '../../snapshots/e39f246bb6c493327c2e75c176c974352b8064dcc6311ca2b339fa4aa4ff46d5/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropIndex({
        schema: 'public',
        table: 'List',
        index: 'List_boardId_position_idx_5df470fd',
      }),
      this.addUnique({
        schema: 'public',
        table: 'List',
        constraint: 'List_boardId_position_key',
        columns: ['boardId', 'position'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
