import { createContext } from "@lit/context";
import type { ProductFeaturesType } from "../types/product.types";
export type { ProductFeaturesType } from "../types/product.types";
export const productFeaturesContext = createContext<ProductFeaturesType | undefined>(Symbol.for("weavy-product-features"));
