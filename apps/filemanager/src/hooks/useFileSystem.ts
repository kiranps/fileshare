import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dirname } from "../utils/files";
import { p2p } from "../utils/p2p_client";
import type { FileItemProps } from "../types";
import { basename, resolveFileType } from "../utils/files";

function toFileProps(data: any[]): {
	activeDirectory: FileItemProps | undefined;
	files: FileItemProps[];
} {
	const items: FileItemProps[] = data.map((entry) => {
		const name = basename(entry.path);
		const ext = !entry.is_dir && name.includes(".") ? (name.split(".").pop()?.toLowerCase() ?? "") : "";
		const type = resolveFileType(ext, entry.is_dir);

		return {
			id: entry.path,
			name,
			type,
			size: entry.size,
			modified: entry.last_modified ?? new Date(0),
		};
	});

	const [activeDirectory, ...files] = items;
	return { activeDirectory, files };
}

async function listFiles(path: string) {
	const result = await p2p.conn?.request("fs.list", { path });
	return toFileProps(result);
}

/** List files in a directory. */
export function useFiles(path: string) {
	return useQuery({
		queryKey: ["files", path],
		queryFn: () => listFiles(path),
	});
}

/** Delete a file or directory tree. */
export function useDeleteFile() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (path: string) => {
			await p2p.conn?.request("fs.delete", { path });
			return { path };
		},
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: ["files", dirname(data.path)] });
		},
	});
}

/** Move or rename a file or directory. */
export function useMoveFile() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({
			fromPath,
			toPath,
			overwrite = true,
		}: {
			fromPath: string;
			toPath: string;
			overwrite?: boolean;
		}) => {
			await p2p.conn?.request("fs.move", { src: fromPath, dst: toPath, overwrite });
			return { from: fromPath, to: toPath };
		},
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: ["files", dirname(data.from)] });
			queryClient.invalidateQueries({ queryKey: ["files", dirname(data.to)] });
		},
	});
}

/** Copy a file or directory. */
export function useCopyFile() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({
			fromPath,
			toPath,
			overwrite = true,
		}: {
			fromPath: string;
			toPath: string;
			overwrite?: boolean;
		}) => {
			await p2p.conn?.request("fs.copy", { src: fromPath, dst: toPath, overwrite });
			return { from: fromPath, to: toPath };
		},
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: ["files", dirname(data.from)] });
			queryClient.invalidateQueries({ queryKey: ["files", dirname(data.to)] });
		},
	});
}

/** Create a directory. */
export function useCreateDirectory() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (path: string) => {
			await p2p.conn?.request("fs.mkdir", { path });
			return { path };
		},
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: ["files", dirname(data.path)] });
		},
	});
}

/** Upload a file. */
export function useUploadFile() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({ path, file }: { path: string; file: File }) => {
			const arrayBuffer = await file.arrayBuffer();
			const body_b64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
			await p2p.conn?.request("fs.put", { path, body_b64 });
			return { path };
		},
		onSuccess: (_data, variables) => {
			queryClient.invalidateQueries({ queryKey: ["files", dirname(variables.path)] });
		},
	});
}
