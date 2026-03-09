export function basename(path: string): string {
  return path.replace(/\/\/+$/, "").split("/").pop() ?? "";
}

export function dirname(path: string): string {
  const clean = path.replace(/\/\/+$/, "");
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
