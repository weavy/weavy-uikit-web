import { createContext } from "@lit/context";
import type { AppType, AppListType } from "../types/app.types";
export type { AppType, AppListType } from "../types/app.types";

export const AppContext = createContext<AppType | undefined>(Symbol.for("weavy-app"));
export const AppsContext = createContext<AppListType | undefined>(Symbol.for("weavy-apps"));
