import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import * as t from "drizzle-orm/pg-core";
import { pgTable as table } from "drizzle-orm/pg-core";
import { commonColumns } from "../common-columns";
import { itemSubcategory } from "./item-subcategory";
import { model } from "./model";

export const itemTable = table("item", {
  id: t.integer().primaryKey().generatedAlwaysAsIdentity(),
  name: t.varchar("name", { length: 30 }).notNull(),
  itemCode: t.varchar("item_code", { length: 40 }).notNull().unique(),
  subcategoryID: t
    .integer("subcategory_id")
    .notNull()
    .references(() => itemSubcategory.id, { onDelete: "cascade" }),
  itemModel: t
    .integer("model_id")
    .references(() => model.id, { onDelete: "cascade" }),
  acquisitionDate: t.date("acquisition_date").notNull(),
  updatedAt: commonColumns.updatedAt,
});

export type ItemSelect = InferSelectModel<typeof itemTable>;
export type ItemInsert = InferInsertModel<typeof itemTable>;
