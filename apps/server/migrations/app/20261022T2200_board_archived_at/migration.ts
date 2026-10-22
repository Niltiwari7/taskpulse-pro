#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/6f9058512882853b4a7643e4ae9a3080acb0becb25e4da0b2615b963a92d9093/contract';
import startContract from '../../snapshots/6f9058512882853b4a7643e4ae9a3080acb0becb25e4da0b2615b963a92d9093/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/8781289c643ddb345e2ee12ab54df993fb514f617c27c33332669caf6df9394a/contract';
import endContract from '../../snapshots/8781289c643ddb345e2ee12ab54df993fb514f617c27c33332669caf6df9394a/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'Board',
        column: col('archivedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
