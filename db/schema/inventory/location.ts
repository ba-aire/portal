import * as t from "drizzle-orm/pg-core";
import { pgTable as table } from "drizzle-orm/pg-core";

export const location = table("location", {
  id: t.integer().primaryKey().generatedAlwaysAsIdentity(),
  name: t.varchar("name", { length: 100 }).notNull(),
  imageUrl: t.text("image_url"),
  latitude: t.decimal("latitude", { precision: 9, scale: 6 }),
  longitude: t.decimal("longitude", { precision: 9, scale: 6 }),
  address: t.text("address"),
  description: t.text("description"),
  operationalSince: t.date("operational_since"),
  isStation: t.boolean("is_station").default(false),
});
