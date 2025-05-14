import { createContext } from "@lit/context";
import type { ContextIdType } from "../types/context.types";
export type { ContextIdType } from "../types/context.types";
export const ContextIdContext = createContext<ContextIdType | undefined>(Symbol.for("weavy-context-id"));
