CREATE TABLE verification_challenges (id TEXT PRIMARY KEY NOT NULL, email TEXT NOT NULL, code_hash TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, expires INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX challenge_expiry ON verification_challenges (expires);
--> statement-breakpoint
CREATE TABLE verification_sessions (id TEXT PRIMARY KEY NOT NULL, email TEXT NOT NULL, expires INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX session_expiry ON verification_sessions (expires);
--> statement-breakpoint
CREATE TABLE verification_limits (id TEXT PRIMARY KEY NOT NULL, count INTEGER NOT NULL, expires INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX limit_expiry ON verification_limits (expires);
