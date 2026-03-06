import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { webdavPropfind, webdavDelete } from "../api/webdavPropfind";

export function useWebDAVPropfind(path: string) {
  return useQuery({
    queryKey: ["files", path],
    queryFn: () => webdavPropfind(path),
  });
}

export function useWebDAVDelete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ path }: { path: string }) => {
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
