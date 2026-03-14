import { useFileManagerStore } from "../store/useFileManagerStore";
import { basename, joinPath } from "../utils/files";
import { useWebDAVCopy, useWebDAVMove } from "./useWebDAVPropfind";

export type ClipboardAction = "cut" | "copy";

/**
 * Thin wrapper over the global clipboard slice in useFileManagerStore.
 *
 * The synchronous `cut` and `copy` actions are delegated directly to the store.
 * The `paste` operation is implemented here because it requires the WebDAV
 * mutation hooks (which cannot live inside a Zustand store).
 *
 * Most callers should prefer reading `clipboard`, `activeAction`, `hasPending`,
 * `cut`, and `copy` directly from `useFileManagerStore` — this hook is provided
 * for the specific case where `paste` is needed without going through the
 * FileActionsContext (e.g. standalone tests or headless usage).
 */
export function useFileClipboard() {
	const clipboard = useFileManagerStore((s) => s.clipboard);
	const activeAction = useFileManagerStore((s) => s.activeAction);
	const hasPending = useFileManagerStore((s) => s.hasPending);
	const cut = useFileManagerStore((s) => s.cut);
	const copy = useFileManagerStore((s) => s.copy);
	const clearClipboard = useFileManagerStore((s) => s.clearClipboard);
	const activePath = useFileManagerStore((s) => s.activePath);

	const moveMutation = useWebDAVMove();
	const copyMutation = useWebDAVCopy();

	const paste = async (): Promise<void> => {
		if (!activeAction || clipboard.length === 0) return;

		const results = await Promise.allSettled(
			clipboard.map((p) => {
				const toPath = joinPath(activePath, basename(p));
				if (activeAction === "cut") {
					return moveMutation.mutateAsync({ fromPath: p, toPath });
				}
				return copyMutation.mutateAsync({ fromPath: p, toPath });
			}),
		);

		const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");

		if (failures.length === 0) {
			clearClipboard();
		} else {
			throw new AggregateError(
				failures.map((f: PromiseRejectedResult) => f.reason as unknown),
				`${failures.length} of ${clipboard.length} ${activeAction} operation(s) failed`,
			);
		}
	};

	return { clipboard, activeAction, cut, copy, paste, hasPending };
}
