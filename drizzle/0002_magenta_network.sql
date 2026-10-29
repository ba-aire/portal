ALTER TABLE "model" RENAME COLUMN "model_name" TO "name";--> statement-breakpoint
ALTER TABLE "model" ADD CONSTRAINT "model_brand_id_name_unique" UNIQUE("brand_id","name");