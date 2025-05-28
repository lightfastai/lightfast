ALTER TABLE "stream" DROP CONSTRAINT "stream_sessionId_session_id_fk";
--> statement-breakpoint
ALTER TABLE "stream" ADD CONSTRAINT "stream_sessionId_session_id_fk" FOREIGN KEY ("sessionId") REFERENCES "public"."session"("id") ON DELETE cascade ON UPDATE no action;