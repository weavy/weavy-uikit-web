import { createContext } from "@lit/context";
import type { AppType } from "../types/app.types";
export type { AppType } from "../types/app.types";
export const appContext = createContext<AppType | undefined>(Symbol.for("weavy-app"));
