import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  webdavPropfind,
  webdavDelete,
  webdavMove,
  webdavCopy,
  webdavMkcol,
  webdavPut,
} from "../api/webdav";
import { dirname } from "../utils/files";

export function useWebDAVPropfind(path: string) {
  return useQuery({
    queryKey: ["files", path],
    queryFn: () => webdavPropfind(path),
  });
}

export function useWebDAVDelete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (path: string) => webdavDelete(path),
    onSuccess: (data) => {
      const parentPath = dirname(data.path);
      queryClient.invalidateQueries({ queryKey: ["files", parentPath] });
    },
  });
}

export function useWebDAVMove() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      fromPath,
      toPath,
      overwrite,
    }: {
      fromPath: string;
      toPath: string;
      overwrite?: boolean;
    }) => webdavMove(fromPath, toPath, overwrite ?? false),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["files", dirname(data.from)] });
      queryClient.invalidateQueries({ queryKey: ["files", dirname(data.to)] });
    },
  });
}

export function useWebDAVCopy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      fromPath,
      toPath,
      overwrite,
    }: {
      fromPath: string;
      toPath: string;
      overwrite?: boolean;
    }) => webdavCopy(fromPath, toPath, overwrite ?? false),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["files", dirname(data.from)] });
      queryClient.invalidateQueries({ queryKey: ["files", dirname(data.to)] });
    },
  });
}

export function useWebDAVMkcol() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (path: string) => webdavMkcol(path),
    onSuccess: (data) => {
      const parentPath = dirname(data.path);
      queryClient.invalidateQueries({ queryKey: ["files", parentPath] });
    },
  });
}

export function useWebDAVPut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ path, file }: { path: string; file: File }) =>
      webdavPut(path, file),
    onSuccess: (_data, variables) => {
      const parentPath = dirname(variables.path);
      queryClient.invalidateQueries({ queryKey: ["files", parentPath] });
    },
  });
}
