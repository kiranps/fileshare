import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type RenderOptions, render as rtlRender } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";

/**
 * Create a new QueryClient for testing with disabled retries and cache
 */
export function createTestQueryClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
				gcTime: 0,
				staleTime: 0,
			},
			mutations: {
				retry: false,
			},
		},
	});
}

interface AllTheProvidersProps {
	children: ReactNode;
	queryClient?: QueryClient;
}

/**
 * Wrapper component with all necessary providers for testing
 */
function AllTheProviders({ children, queryClient }: AllTheProvidersProps) {
	const client = queryClient || createTestQueryClient();

	return (
		<QueryClientProvider client={client}>
			<BrowserRouter>{children}</BrowserRouter>
		</QueryClientProvider>
	);
}

interface CustomRenderOptions extends Omit<RenderOptions, "wrapper"> {
	queryClient?: QueryClient;
}

/**
 * Custom render function with all providers
 */
export function render(ui: ReactElement, options?: CustomRenderOptions) {
	const { queryClient, ...renderOptions } = options || {};

	return rtlRender(ui, {
		wrapper: ({ children }) => <AllTheProviders queryClient={queryClient}>{children}</AllTheProviders>,
		...renderOptions,
	});
}

// Re-export everything from testing library
export * from "@testing-library/react";
export { render };
