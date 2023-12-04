import { Feature, FeaturesListType } from "../types/features.types";

export const hasFeature = (availableFeatures?: FeaturesListType, feature?: Feature, featureEnabled: boolean = true) => {
  if (availableFeatures && feature) {
    return availableFeatures.indexOf(feature) != -1 && featureEnabled;
  }

  return false;
};
