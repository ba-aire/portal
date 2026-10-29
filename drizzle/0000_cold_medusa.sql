CREATE TABLE IF NOT EXISTS "brand" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "brand_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(40) NOT NULL,
	CONSTRAINT "brand_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "detail_analyzer" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "detail_analyzer_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"item_id" integer NOT NULL,
	"model" integer,
	"analyzer_state" integer NOT NULL,
	"item_serial_number" varchar(40) NOT NULL,
	"analyzer_pollutant" varchar(40) NOT NULL,
	"analyzer_last_calibration" date,
	"analyzer_last_maintenance" date,
	CONSTRAINT "detail_analyzer_item_id_unique" UNIQUE("item_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "detail_consumable" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "detail_consumable_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"item_id" integer NOT NULL,
	"consumable_state" varchar(20) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "detail_cylinder" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "detail_cylinder_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"item_id" integer NOT NULL,
	"cylinder_number" varchar(30) NOT NULL,
	"cylinder_concentration" numeric(10, 2),
	"cylinder_connector" varchar(20) NOT NULL,
	"cylinder_expiration_date" date NOT NULL,
	"cylinder_certificate" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "detail_sparepart" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "detail_sparepart_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"item_id" integer NOT NULL,
	"sparepart_state" varchar(20) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "equipment_to_spareparts" (
	"equipment_id" integer NOT NULL,
	"sparepart_id" integer NOT NULL,
	CONSTRAINT "equipment_to_spareparts_equipment_id_sparepart_id_pk" PRIMARY KEY("equipment_id","sparepart_id"),
	CONSTRAINT "no_self_reference" CHECK ("equipment_to_spareparts"."sparepart_id" <> "equipment_to_spareparts"."equipment_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory" (
	"item_id" integer NOT NULL,
	"station_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"updated_by" varchar(100),
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "inventory_item_id_station_id_pk" PRIMARY KEY("item_id","station_id"),
	CONSTRAINT "quantity_check" CHECK ("inventory"."quantity" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "item_category" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "item_category_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "item_category_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "item_subcategory" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "item_subcategory_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"category_id" integer NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "item_subcategory_category_id_name_unique" UNIQUE("category_id","name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "item" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "item_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(30) NOT NULL,
	"item_code" varchar(40) NOT NULL,
	"subcategory_id" integer NOT NULL,
	"acquisition_date" date NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "item_item_code_unique" UNIQUE("item_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "model" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "model_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"model_name" varchar(40) NOT NULL,
	"brand_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "station" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "station_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"station_name" varchar(100) NOT NULL,
	"station_image_url" text,
	"station_latitude" numeric(9, 6),
	"station_longitude" numeric(9, 6),
	"station_address" text,
	"station_description" text,
	"operational_since" date
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transaction" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transaction_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"item_id" integer NOT NULL,
	"station_id_origen" integer NOT NULL,
	"station_id_destino" integer NOT NULL,
	"cantidad" integer NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "station_check" CHECK ("transaction"."station_id_origen" <> "transaction"."station_id_destino"),
	CONSTRAINT "cantidad_check" CHECK ("transaction"."cantidad" > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(40) NOT NULL,
	"email" varchar(40) NOT NULL,
	"password_hash" text NOT NULL,
	"role" varchar(10) DEFAULT 'VIEWER' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"updated_by" varchar(100),
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "user_name_unique" UNIQUE("name"),
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "detail_analyzer" ADD CONSTRAINT "detail_analyzer_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "detail_analyzer" ADD CONSTRAINT "detail_analyzer_model_model_id_fk" FOREIGN KEY ("model") REFERENCES "public"."model"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "detail_consumable" ADD CONSTRAINT "detail_consumable_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "detail_cylinder" ADD CONSTRAINT "detail_cylinder_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "detail_sparepart" ADD CONSTRAINT "detail_sparepart_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "equipment_to_spareparts" ADD CONSTRAINT "equipment_to_spareparts_equipment_id_item_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."item"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "equipment_to_spareparts" ADD CONSTRAINT "equipment_to_spareparts_sparepart_id_item_id_fk" FOREIGN KEY ("sparepart_id") REFERENCES "public"."item"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory" ADD CONSTRAINT "inventory_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory" ADD CONSTRAINT "inventory_station_id_station_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."station"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "item_subcategory" ADD CONSTRAINT "item_subcategory_category_id_item_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."item_category"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "item" ADD CONSTRAINT "item_subcategory_id_item_subcategory_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."item_subcategory"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "model" ADD CONSTRAINT "model_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transaction" ADD CONSTRAINT "transaction_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transaction" ADD CONSTRAINT "transaction_station_id_origen_station_id_fk" FOREIGN KEY ("station_id_origen") REFERENCES "public"."station"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transaction" ADD CONSTRAINT "transaction_station_id_destino_station_id_fk" FOREIGN KEY ("station_id_destino") REFERENCES "public"."station"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
