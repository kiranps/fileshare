export function basename(path: string): string {
	return path.replace(/\/+$/, "").split("/").pop() ?? "";
}

export function dirname(path: string): string {
	const clean = path.replace(/\/+$/, "");
	const parts = clean.split("/");
	parts.pop();
	return parts.join("/") || "/";
}

export function normalizePath(path: string): string {
	let result = path.replace(/\/+/g, "/");
	result = result.startsWith("/") ? result : "/" + result;
	if (result.length > 1 && result.endsWith("/")) result = result.slice(0, -1);
	return result;
}

export function joinPath(...parts: string[]): string {
	return normalizePath(parts.join("/").replace(/\/+/g, "/"));
}

export function openFilePicker(): Promise<File[]> {
	return new Promise((resolve) => {
		const input = document.createElement("input");
		input.type = "file";
		input.multiple = true;

		input.addEventListener("change", () => {
			const files = input.files ? Array.from(input.files) : [];
			resolve(files);
		});

		input.click();
	});
}

export function openFolderPicker(): Promise<File[]> {
	return new Promise((resolve) => {
		const input = document.createElement("input");
		input.type = "file";
		input.multiple = true;

		Object.assign(input, { webkitdirectory: true });

		input.addEventListener("change", () => {
			const files = input.files ? Array.from(input.files) : [];
			resolve(files);
		});

		input.click();
	});
}

export function collectDirs(files: File[]): string[] {
	const dirs = new Set<string>();

	for (const file of files) {
		const parts = file.webkitRelativePath.split("/");

		parts.pop(); // remove filename

		let path = "";

		for (const part of parts) {
			path = path ? `${path}/${part}` : part;
			dirs.add(path);
		}
	}

	return Array.from(dirs);
}

export function encodePath(path: string): string {
	return path
		.split("/")
		.map((segment) => encodeURIComponent(decodeURIComponentSafe(segment)))
		.join("/");
}

function decodeURIComponentSafe(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}
