#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/550418294928c7bf9fee20fd849862de9a4eb1f2b96fff5fa85891b31749625a/contract';
import endContract from '../../snapshots/550418294928c7bf9fee20fd849862de9a4eb1f2b96fff5fa85891b31749625a/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/8781289c643ddb345e2ee12ab54df993fb514f617c27c33332669caf6df9394a/contract';
import startContract from '../../snapshots/8781289c643ddb345e2ee12ab54df993fb514f617c27c33332669caf6df9394a/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';
import postgres from '@prisma/orm-postgres/runtime';

const { sql: db, contract } = postgres<End>({ contractJson: endContract });

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropCheckConstraint({
        schema: 'public',
        table: 'BoardMember',
        constraint: 'BoardMember_role_check_35f881c2',
      }),
      this.dataTransform(contract, 'rename-BoardMember-role-NORMAL-to-MEMBER', {
        check: () =>
          db.public.BoardMember.select('id')
            .where((f, fns) => fns.eq(f.role, 'NORMAL'))
            .limit(1),
        run: () =>
          db.public.BoardMember.update({ role: 'MEMBER' }).where((f, fns) =>
            fns.eq(f.role, 'NORMAL')
          ),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'BoardMember',
        constraint: 'BoardMember_role_check_364ae04d',
        expression: "\"role\" IN ('ADMIN', 'MEMBER', 'OBSERVER', 'GUEST')",
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
