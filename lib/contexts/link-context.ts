import { createContext } from "@lit/context";
import type { LinkType } from "../types/app.types";
export type { LinkType } from "../types/app.types";
export const LinkContext = createContext<LinkType | undefined>(Symbol.for("weavy-link"));
