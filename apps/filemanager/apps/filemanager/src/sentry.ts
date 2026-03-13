import * as Sentry from "@sentry/react";
import { BrowserTracing } from "@sentry/tracing";

const dsn = String(import.meta.env.VITE_SENTRY_DSN || "");
const env = String(import.meta.env.VITE_SENTRY_ENV || "dev");

if (dsn) {
  Sentry.init({
    dsn,
    integrations: [new BrowserTracing()],
    tracesSampleRate: 0.1,
    environment: env,
  });
}

export default Sentry;
