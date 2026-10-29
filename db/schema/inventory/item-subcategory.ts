import * as t from "drizzle-orm/pg-core";
import { pgTable as table } from "drizzle-orm/pg-core";
import { itemCategory } from "./item-category";

export const itemSubcategory = table(
  "item_subcategory",
  {
    id: t.integer().primaryKey().generatedAlwaysAsIdentity(),
    name: t.text("name").notNull(),
    categoryId: t
      .integer("category_id")
      .notNull()
      .references(() => itemCategory.id, {
        onDelete: "cascade",
      }),
  },
  (table) => [t.unique().on(table.categoryId, table.name)],
);
