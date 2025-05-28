ALTER TABLE "Stream" RENAME TO "stream";--> statement-breakpoint
ALTER TABLE "stream" DROP CONSTRAINT "Stream_sessionId_session_id_fk";
--> statement-breakpoint
ALTER TABLE "stream" DROP CONSTRAINT "Stream_id_pk";--> statement-breakpoint
ALTER TABLE "stream" ADD CONSTRAINT "stream_id_pk" PRIMARY KEY("id");--> statement-breakpoint
ALTER TABLE "stream" ADD CONSTRAINT "stream_sessionId_session_id_fk" FOREIGN KEY ("sessionId") REFERENCES "public"."session"("id") ON DELETE no action ON UPDATE no action;