import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type RenderOptions, render as rtlRender } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { BrowserRouter, MemoryRouter } from "react-router-dom";

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
	initialPath?: string;
}

/**
 * Wrapper component with all necessary providers for testing
 */
function AllTheProviders({ children, queryClient, initialPath }: AllTheProvidersProps) {
	const client = queryClient || createTestQueryClient();

	return (
		<QueryClientProvider client={client}>
			{initialPath ? (
				<MemoryRouter initialEntries={[initialPath]}>{children}</MemoryRouter>
			) : (
				<BrowserRouter>{children}</BrowserRouter>
			)}
		</QueryClientProvider>
	);
}

interface CustomRenderOptions extends Omit<RenderOptions, "wrapper"> {
	queryClient?: QueryClient;
	/** Set the initial URL path for MemoryRouter (useful when testing components that read location.pathname) */
	initialPath?: string;
}

/**
 * Custom render function with all providers
 */
export function render(ui: ReactElement, options?: CustomRenderOptions) {
	const { queryClient, initialPath, ...renderOptions } = options || {};

	return rtlRender(ui, {
		wrapper: ({ children }) => (
			<AllTheProviders queryClient={queryClient} initialPath={initialPath}>
				{children}
			</AllTheProviders>
		),
		...renderOptions,
	});
}

// Re-export everything from testing library.
// NOTE: Our `export function render` above shadows the re-exported one from @testing-library/react
// because explicit named exports take precedence over `export *` star re-exports.
export * from "@testing-library/react";
