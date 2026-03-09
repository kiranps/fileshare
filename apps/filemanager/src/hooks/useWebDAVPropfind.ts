import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  webdavPropfind,
  webdavDelete,
  webdavMove,
  webdavCopy,
  webdavMkcol,
  webdavPut,
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

export function useWebDAVPut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ path, file }: { path: string; file: File }) => {
      return webdavPut(path, file);
    },
    onSuccess: (_data, variables: any) => {
      const parts = (variables as any).path.split("/").filter(Boolean);
      parts.pop();
      const parent = "/" + parts.join("/");
      queryClient.invalidateQueries({ queryKey: ["files", parent] });
    },
  });
}
