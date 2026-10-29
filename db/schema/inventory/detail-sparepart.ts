import * as t from "drizzle-orm/pg-core";
import { pgTable as table } from "drizzle-orm/pg-core";
import { itemTable } from "./item";
import type { SparePartState } from "./types";

export const detailSparepart = table("detail_sparepart", {
  id: t.integer().primaryKey().generatedAlwaysAsIdentity(),
  itemID: t
    .integer("item_id")
    .notNull()
    .references(() => itemTable.id, { onDelete: "cascade" }),
  sparepartState: t
    .varchar("sparepart_state", { length: 20 })
    .notNull()
    .$type<SparePartState>(),
});
