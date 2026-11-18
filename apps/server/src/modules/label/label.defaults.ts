import { LABEL_COLORS } from "@taskpulse/shared-types";
import type { Tx } from "../../prisma/db";

export async function createDefaultLabels(tx: Tx, boardId: string): Promise<void> {
  await tx.orm.public.Label.createAndCount(
    LABEL_COLORS.map((color) => ({boardId, color, name:null}))
  )
}