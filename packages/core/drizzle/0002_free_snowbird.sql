CREATE TABLE "user_credentials" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"openrouter_api_key_enc" text,
	"pexels_api_key_enc" text,
	"pixabay_api_key_enc" text,
	"azure_speech_key_enc" text,
	"azure_speech_region" text,
	"r2_account_id_enc" text,
	"r2_access_key_id_enc" text,
	"r2_secret_access_key_enc" text,
	"r2_bucket" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_credentials" ADD CONSTRAINT "user_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;