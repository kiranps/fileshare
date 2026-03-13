import * as Sentry from "@sentry/react";

const dsn = String(import.meta.env.VITE_SENTRY_DSN || "");
const env = String(import.meta.env.VITE_SENTRY_ENV || "dev");

Sentry.init({
	dsn,
	tracesSampleRate: 0.1,
	environment: env,
	sendDefaultPii: true,
});

export default Sentry;
