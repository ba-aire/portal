import { sql } from "drizzle-orm";
import * as t from "drizzle-orm/pg-core";
import { pgTable as table } from "drizzle-orm/pg-core";
import { commonColumns } from "../common-columns";
import { itemTable } from "./item";
import { location } from "./location";

export const transaction = table(
  "transaction",
  {
    id: t.integer().primaryKey().generatedAlwaysAsIdentity(),
    itemId: t
      .integer("item_id")
      .notNull()
      .references(() => itemTable.id, { onDelete: "cascade" }),
    fromStationId: t
      .integer("station_id_origen")
      .notNull()
      .references(() => location.id, { onDelete: "cascade" }),
    toStationId: t
      .integer("station_id_destino")
      .notNull()
      .references(() => location.id, { onDelete: "cascade" }),
    quantity: t.integer("cantidad").notNull(),
    updatedAt: commonColumns.updatedAt,
  },
  (table) => [
    t.check(
      "station_check",
      sql`${table.fromStationId} <> ${table.toStationId}`,
    ),
    t.check("cantidad_check", sql`${table.quantity} > 0`),
  ],
);
