import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  webdavPropfind,
  webdavDelete,
  webdavMove,
  webdavCopy,
  webdavMkcol,
  webdavGet,
} from "../api/webdav";

export function useWebDAVPropfind(path: string) {
  return useQuery({
    queryKey: ["files", path],
    queryFn: () => webdavPropfind(path),
  });
}

export function useWebDAVDelete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (path: string) => {
      return webdavDelete(path);
    },
    onSuccess: (data, _variables) => {
      const deletedPath = data.path;
      const pathParts = deletedPath.split("/").filter(Boolean);
      pathParts.pop();
      const parentPath = "/" + pathParts.join("/");
      queryClient.invalidateQueries({ queryKey: ["files", parentPath] });
    },
  });
}

export function useWebDAVMove() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      fromPath,
      toPath,
      overwrite,
    }: {
      fromPath: string;
      toPath: string;
      overwrite?: boolean;
    }) => {
      return webdavMove(fromPath, toPath, overwrite ?? false);
    },
    onSuccess: (data, _variables) => {
      const toParts = data.to.split("/").filter(Boolean);
      toParts.pop();
      const toParent = "/" + toParts.join("/");
      queryClient.invalidateQueries({ queryKey: ["files", toParent] });
    },
  });
}

export function useWebDAVCopy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      fromPath,
      toPath,
      overwrite,
    }: {
      fromPath: string;
      toPath: string;
      overwrite?: boolean;
    }) => {
      return webdavCopy(fromPath, toPath, overwrite ?? false);
    },
    onSuccess: (data, _variables) => {
      const toParts = data.to.split("/").filter(Boolean);
      toParts.pop();
      const toParent = "/" + toParts.join("/");
      queryClient.invalidateQueries({ queryKey: ["files", toParent] });
    },
  });
}

export function useWebDAVMkcol() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (path: string) => {
      return webdavMkcol(path);
    },
    onSuccess: (data, _variables) => {
      // Invalidate the parent dir listing
      const parentPath = (() => {
        const parts = data.path.split("/").filter(Boolean);
        parts.pop(); // remove new directory name
        return "/" + parts.join("/");
      })();
      queryClient.invalidateQueries({ queryKey: ["files", parentPath] });
    },
  });
}

import { useEffect } from "react";

/**
 * useWebDAVGet - Triggers file download (Blob) as soon as fetched.
 * Does not return file data, only query state.
 *
 * @param path WebDAV file path
 * @param filename filename for download (eg. "file.txt")
 * @param options Optional { signal?: AbortSignal }
 * @returns { isLoading, error, isError, isSuccess, ... } (no data)
 */
export function useWebDAVGet(
  path: string,
  filename: string,
  options?: { signal?: AbortSignal }
) {
  const query = useQuery({
    queryKey: ["file-download", path],
    queryFn: () => webdavGet(path, options),
    enabled: !!path, // only trigger if path provided
  });

  useEffect(() => {
    if (query.isSuccess && query.data && query.data.blob) {
      const blob = query.data.blob;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || "download";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    }
  }, [query.isSuccess, query.data, filename]);

  // Only expose query state, hide data
  const { data, ...rest } = query;
  return rest;
}
