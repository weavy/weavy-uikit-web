import { createContext } from "@lit/context";
import type { FeaturesType } from "../types/features.types";
export type { FeaturesType } from "../types/features.types";
export const featuresContext = createContext<FeaturesType | undefined>(Symbol.for("weavy-app-features"));
