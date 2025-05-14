import { createContext } from "@lit/context";
import type { ContextDataBlobsType } from "../types/context.types";
export type { ContextDataBlobsType } from "../types/context.types";
export const DataBlobsContext = createContext<ContextDataBlobsType | undefined>(Symbol.for("weavy-data-blobs"));
