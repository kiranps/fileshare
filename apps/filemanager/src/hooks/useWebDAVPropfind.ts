import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  webdavPropfind,
  webdavDelete,
  webdavMove,
  webdavCopy,
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
      let parts = fromPath.split("/").filter(Boolean);
      const itemName = parts[parts.length - 1];
      let normalizedTo = toPath.endsWith("/") ? toPath : toPath + "/";
      if (!normalizedTo.startsWith("/")) normalizedTo = "/" + normalizedTo;
      const destinationPath = normalizedTo + itemName;
      return webdavMove(fromPath, destinationPath, overwrite ?? false);
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
      let parts = fromPath.split("/").filter(Boolean);
      const itemName = parts[parts.length - 1];
      let normalizedTo = toPath.endsWith("/") ? toPath : toPath + "/";
      if (!normalizedTo.startsWith("/")) normalizedTo = "/" + normalizedTo;
      const destinationPath = normalizedTo + itemName;
      return webdavCopy(fromPath, destinationPath, overwrite ?? false);
    },
    onSuccess: (data, _variables) => {
      const toParts = data.to.split("/").filter(Boolean);
      toParts.pop();
      const toParent = "/" + toParts.join("/");
      queryClient.invalidateQueries({ queryKey: ["files", toParent] });
    },
  });
}
