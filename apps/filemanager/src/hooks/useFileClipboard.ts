import { useState } from "react";
import { useFileManagerStore } from "../store/useFileManagerStore";
import { basename, joinPath } from "../utils/files";
import { useWebDAVCopy, useWebDAVMove } from "./useWebDAVPropfind";

export type ClipboardAction = "cut" | "copy";

/**
 * Manages the clipboard for cut/copy/paste file operations.
 * The clipboard holds the paths of files staged for the operation,
 * and `activeAction` indicates whether a cut or copy is pending.
 *
 * `paste` returns a Promise that resolves when all mutations succeed and
 * rejects (with an AggregateError) if any mutation fails. The clipboard is
 * only cleared on full success so the user can retry after a partial failure.
 */
export function useFileClipboard() {
	const [clipboard, setClipboard] = useState<string[]>([]);
	const [activeAction, setActiveAction] = useState<ClipboardAction | null>(null);
	const activePath = useFileManagerStore((s) => s.activePath);
	const moveMutation = useWebDAVMove();
	const copyMutation = useWebDAVCopy();

	const cut = (paths: string[]) => {
		setClipboard(paths);
		setActiveAction("cut");
	};

	const copy = (paths: string[]) => {
		setClipboard(paths);
		setActiveAction("copy");
	};

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
			// All succeeded — clear clipboard.
			setClipboard([]);
			setActiveAction(null);
		} else {
			// Keep clipboard so the user can retry; surface errors to the caller.
			throw new AggregateError(
				failures.map((f: PromiseRejectedResult) => f.reason as unknown),
				`${failures.length} of ${clipboard.length} ${activeAction} operation(s) failed`,
			);
		}
	};

	const hasPending = clipboard.length > 0;

	return { clipboard, activeAction, cut, copy, paste, hasPending };
}
