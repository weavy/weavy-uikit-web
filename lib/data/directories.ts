import type { WeavyType } from "../client/weavy";
import type { DirectoryType } from "../types/users.types";
import { getApiOptions } from "./api";

/** Query options for resolving a directory by its ID or name. */
export function getDirectoryOptions(weavy: WeavyType, directory: string | number) {
  directory = directory.toString();
  return getApiOptions<DirectoryType | null>(
    weavy,
    ["directories", directory],
    `/api/directories/${encodeURIComponent(directory)}`,
  );
}
