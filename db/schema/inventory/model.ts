import * as t from "drizzle-orm/pg-core";
import { pgTable as table } from "drizzle-orm/pg-core";
import { brand } from "./brand";

export const model = table(
  "model",
  {
    id: t.integer().primaryKey().generatedAlwaysAsIdentity(),
    name: t.varchar("name", { length: 40 }).notNull(),
    brandId: t
      .integer("brand_id")
      .notNull()
      .references(() => brand.id, { onDelete: "cascade" }),
  },
  (table) => [t.unique().on(table.brandId, table.name)],
);
