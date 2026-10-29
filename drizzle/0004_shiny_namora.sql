ALTER TABLE "station" RENAME TO "location";--> statement-breakpoint
ALTER TABLE "inventory" RENAME COLUMN "station_id" TO "location_id";--> statement-breakpoint
ALTER TABLE "inventory" DROP CONSTRAINT "inventory_station_id_station_id_fk";
--> statement-breakpoint
ALTER TABLE "transaction" DROP CONSTRAINT "transaction_station_id_origen_station_id_fk";
--> statement-breakpoint
ALTER TABLE "transaction" DROP CONSTRAINT "transaction_station_id_destino_station_id_fk";
--> statement-breakpoint
ALTER TABLE "inventory" DROP CONSTRAINT "inventory_item_id_station_id_pk";--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_item_id_location_id_pk" PRIMARY KEY("item_id","location_id");--> statement-breakpoint
ALTER TABLE "location" ADD COLUMN "is_station" boolean DEFAULT false;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory" ADD CONSTRAINT "inventory_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transaction" ADD CONSTRAINT "transaction_station_id_origen_location_id_fk" FOREIGN KEY ("station_id_origen") REFERENCES "public"."location"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transaction" ADD CONSTRAINT "transaction_station_id_destino_location_id_fk" FOREIGN KEY ("station_id_destino") REFERENCES "public"."location"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
