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
	console.log("listFiles");
	const result = await p2p.conn?.request("fs.list", { path });
	console.log(result);
	return toFileProps(result);
}

export function useWebDAVPropfind(path: string) {
	return useQuery({
		queryKey: ["files", path],
		queryFn: () => listFiles(path),
	});
}
