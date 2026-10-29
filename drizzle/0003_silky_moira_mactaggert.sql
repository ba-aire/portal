ALTER TABLE "item" ADD COLUMN "model_id" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "item" ADD CONSTRAINT "item_model_id_model_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."model"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
