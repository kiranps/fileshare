import { useQuery } from "@tanstack/react-query";
import type { UseQueryOptions } from "@tanstack/react-query";
import { webdavPropfind } from "../api/webdavPropfind";

export function useWebDAVPropfind(
  path: string,
  queryOptions?: UseQueryOptions<any, Error, any>,
) {
  return useQuery({
    queryKey: ["webdavPropfind", path],
    queryFn: () => webdavPropfind(path),
    ...queryOptions,
  });
}
