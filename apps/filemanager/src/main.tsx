import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Sentry from "./sentry"; // remains relative
import "./index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
		},
	},
});

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<Sentry.ErrorBoundary fallback={<p>Something went wrong</p>}>
			<BrowserRouter>
				<QueryClientProvider client={queryClient}>
					<App />
				</QueryClientProvider>
			</BrowserRouter>
		</Sentry.ErrorBoundary>
	</StrictMode>,
);
