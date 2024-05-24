import { AppTypes } from "../types/app.types";
import { FeaturesProductType } from "../types/features.types";

export function getProductFromAppType(app: AppTypes) {
  switch (app) {
    case AppTypes.Posts:
      return FeaturesProductType.Feeds;
    default:
      return app as unknown as FeaturesProductType;
  }
}