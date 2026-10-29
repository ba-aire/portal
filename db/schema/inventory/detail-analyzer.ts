import * as t from "drizzle-orm/pg-core";
import { pgTable as table } from "drizzle-orm/pg-core";
import { itemTable } from "./item";
import { model } from "./model";
import type { AnalyzerState } from "./types";

export const detailAnalizer = table("detail_analyzer", {
  id: t.integer().primaryKey().generatedAlwaysAsIdentity(),
  itemId: t
    .integer("item_id")
    .notNull()
    .unique()
    .references(() => itemTable.id, { onDelete: "cascade" }),
  model: t.integer("model").references(() => model.id),
  analyzerState: t.integer("analyzer_state").notNull().$type<AnalyzerState>(),
  itemerialNumber: t.varchar("item_serial_number", { length: 40 }).notNull(),
  analyzerPollutant: t.varchar("analyzer_pollutant", { length: 40 }).notNull(),
  analyzerLastCalibration: t.date("analyzer_last_calibration"),
  analyzerLastMaintenance: t.date("analyzer_last_maintenance"),
});
