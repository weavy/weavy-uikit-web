import { WeavyContext, type WeavyContextType } from "./weavy-context";
import { WeavyContextOptionsType } from "../types/weavy.types";

export interface WeavyVersionProps {
  readonly version: string;
  checkVersion: (version?: string) => Promise<void>;
}

// WeavyVersion mixin/decorator
export const WeavyVersionMixin = (base: typeof WeavyContext) => {
  return class WeavyVersion extends base implements WeavyVersionProps {
    constructor(options: WeavyContextOptionsType) {
      super(options);

      this.whenUrl().then(() => {
        if (!this.isDestroyed) {
          (this as this & WeavyContextType).checkVersion();
        }
      });
    }

    readonly version: string = WeavyContext.version;

    /**
     * Checks the version of the Weavy Context against the Weavy Environment version.
     *
     * @param {string} [version] - Optional version to check against the environment version.
     */
    async checkVersion(this: this & WeavyContextType, version: string = this.version) {
      await this.whenUrl();
      this.networkStateIsPending = true;

      let response;
      try {
        response = await fetch(new URL("/version", this.url), await this.fetchOptions(false));
        if (!response.ok) {
          throw new Error("Could not verify environment version.");
        }
        this.networkStateIsPending = false;
        this.serverState = "ok";
      } catch (e) {
        this.networkStateIsPending = false;
        this.serverState = "unreachable";
        console.warn("Could not check version: " + (e as Error).toString());
        return;
      }

      const environmentVersion = await response.text();

      if (!version || !environmentVersion || version !== environmentVersion) {
        try {
          const semverVersion = version.split(".").slice(0, 2);
          const semverEnvironmentVersion = environmentVersion.split(".").slice(0, 2);

          if (semverVersion[0] !== semverEnvironmentVersion[0]) {
            throw new Error();
          } else if (semverVersion[1] !== semverEnvironmentVersion[1]) {
            console.warn(
              `Version inconsistency: ${WeavyContext.sourceName}@${this.version} ≠ ${
                (this.url as URL)?.hostname
              }@${environmentVersion}`
            );
          }
        } catch (e) {
          throw new Error(
            `Version mismatch! ${WeavyContext.sourceName}@${this.version} ≠ ${
              (this.url as URL)?.hostname
            }@${environmentVersion}`
          );
        }
      }
    }
  };
};
