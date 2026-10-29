import * as t from "drizzle-orm/pg-core";
import { pgTable as table } from "drizzle-orm/pg-core";
import { itemTable } from "./item";
import type { ConsumableState } from "./types";

export const detailConsumable = table("detail_consumable", {
  id: t.integer().primaryKey().generatedAlwaysAsIdentity(),
  itemId: t
    .integer("item_id")
    .notNull()
    .references(() => itemTable.id, { onDelete: "cascade" }),
  consumableState: t
    .varchar("consumable_state", { length: 20 })
    .notNull()
    .$type<ConsumableState>(),
});
