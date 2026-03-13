import { createContext } from "@lit/context";
import {
  ComponentFeaturePolicy,
  ComponentFeaturePolicyConfig,
  Feature,
  FeatureListType,
} from "../types/features.types";
export { type ComponentFeaturePolicy, Feature } from "../types/features.types";

export const FeaturePolicyContext = createContext<ComponentFeaturePolicy | undefined>(Symbol.for("weavy-features"));

/**
 * Component feature policy handler.
 */
export class ComponentFeatures implements ComponentFeaturePolicy {
  #componentFeatures: FeatureListType;
  #defaultFeatures: FeatureListType;
  #allowedFeatures: FeatureListType;

  /**
   * Creates a feature policy. All features are initially enabled unless `defaultFeatures` is specified.
   *
   * @constructor
   * @param componentFeatures - Available features.
   */
  constructor(componentFeaturesConfig: ComponentFeaturePolicyConfig, allowedFeatures?: FeatureListType) {
    this.#componentFeatures = Object.keys(componentFeaturesConfig) as FeatureListType;
    this.#defaultFeatures = (Object.entries(componentFeaturesConfig) as [Feature, boolean][]).reduce(
      (features, [feature, enabled]) => {
        if (enabled) {
          features.push(feature);
        }
        return features;
      },
      [] as FeatureListType,
    );
    this.#allowedFeatures = allowedFeatures ?? this.#defaultFeatures;
  }

  features(): FeatureListType {
    return this.#componentFeatures;
  }

  supportedFeature(...features: Feature[]) {
    return features.every((feature) => this.#componentFeatures.includes(feature));
  }

  allowedFeatures(): FeatureListType {
    return this.#allowedFeatures;
  }

  allowsFeature(...features: Feature[]): boolean {
    return features.every((feature) => {
      if (!this.supportedFeature(feature)) {
        //console.warn(`Feature is unsupported: ${feature}`);
        return false;
      }
      return this.#allowedFeatures.includes(feature);
    });
  }

  allowsAnyFeature(...features: Feature[]): boolean {
    return features.some((feature) => {
      if (!this.supportedFeature(feature)) {
        //console.warn(`Feature is unsupported: ${feature}`);
        return false;
      }
      return this.#allowedFeatures.includes(feature);
    });
  }

  /**
   * Sets the allowed features.
   * @param allowedFeatures - Space separated string with features that will be enabled. Empty string will disable all features. `null` or `undefined` will enable all features.
   */
  setAllowedFeatures(allowedFeatures?: string | null): FeatureListType {
    this.#allowedFeatures =
      typeof allowedFeatures === "string"
        ? featureListFromString(allowedFeatures, this.#componentFeatures, this.#defaultFeatures)
        : this.#defaultFeatures;

    return this.#allowedFeatures;
  }

  immutableCopy() {
    const componentFeaturesConfig = featureConfigFromList(this.#componentFeatures, this.#defaultFeatures);
    return new ComponentFeatures(componentFeaturesConfig, this.#allowedFeatures);
  }
}

/**
 * Creates a list of allowed features based on the featureList as default.
 * 
 * @param features 
 * @param availableFeatureList - An array of allowed features.
 * @param defaultFeatureList - An array of default features.
 * @returns An array of allowed features
 */
export function featureListFromString(features: string, availableFeatureList: FeatureListType, defaultFeatureList: FeatureListType) {
  let includedFeatures: FeatureListType = [...defaultFeatureList];

  features.split(" ").forEach((feature) => {
    if (feature) {
      if (feature.startsWith("-")) {
        // Remove minus-feature
        const removeFeature = feature.substring(1) as Feature;
        includedFeatures = includedFeatures.filter((feature) => feature !== removeFeature);
      } else if (availableFeatureList.includes(feature as Feature)) {
        // Add feature if not present
        if (!includedFeatures.includes(feature as Feature)) {
          includedFeatures.push(feature as Feature);
        }
      } else {
        console.warn("Unknown feature provided:", feature);
      }
    }
  });

  return includedFeatures;
}

export function featureConfigFromList(featureList: FeatureListType, defaultFeatures?: FeatureListType) {
  defaultFeatures ??= featureList;
  return Object.fromEntries(featureList.map((feature) => [feature, defaultFeatures.includes(feature)]));
}

/** A list of all available features */
export const allFeatures = Object.values(Feature);
