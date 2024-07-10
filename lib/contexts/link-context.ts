import { createContext } from "@lit/context";
import type { EntityType } from "../types/app.types";
export type { EntityType } from "../types/app.types";
export const linkContext = createContext<EntityType | undefined>(Symbol.for("weavy-link"));
