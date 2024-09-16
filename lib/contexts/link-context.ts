import { createContext } from "@lit/context";
import type { EntityType } from "../types/app.types";
export type { EntityType } from "../types/app.types";
export const LinkContext = createContext<EntityType | undefined>(Symbol.for("weavy-link"));
