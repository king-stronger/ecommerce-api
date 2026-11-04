interface Env {
	DATABASE_URL: string;
	BETTER_AUTH_URL: string;
	BETTER_AUTH_SECRET: string;
	TRUSTED_ORIGINS: string;
	COOKIE_DOMAIN: string;
	LOG_LEVEL: "fatal" | "error" | "warn" | "info" | "debug" | "trace";
}
