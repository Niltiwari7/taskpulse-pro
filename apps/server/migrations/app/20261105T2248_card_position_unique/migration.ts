#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/2e32e02144c68021e4513fe3a6c5cd02ff8f0c800e50b1425317673cd36b71ec/contract';
import startContract from '../../snapshots/2e32e02144c68021e4513fe3a6c5cd02ff8f0c800e50b1425317673cd36b71ec/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/de639faf921b9159e7364ec1c2e70199e61c2021bd9726bd2894fe9fde40bd16/contract';
import endContract from '../../snapshots/de639faf921b9159e7364ec1c2e70199e61c2021bd9726bd2894fe9fde40bd16/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addUnique({
        schema: 'public',
        table: 'Card',
        constraint: 'Card_listId_position_key',
        columns: ['listId', 'position'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
