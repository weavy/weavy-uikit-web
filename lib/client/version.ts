import { WeavyClient, type WeavyType } from "./weavy";
import { Constructor } from "../types/generic.types";

export interface WeavyVersionProps {
  readonly version: string;
  checkVersion: (version?: string) => Promise<void>;
}

// WeavyVersion mixin/decorator
export const WeavyVersionMixin = <TBase extends Constructor<WeavyClient>>(Base: TBase) => {
  return class WeavyVersion extends Base implements WeavyVersionProps {
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...args: any[]) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      super(...args);

      void this.whenUrl().then(() => {
        if (!this.isDestroyed) {
          void (this as this & WeavyType).checkVersion();
        }
      });
    }

    /**
     * The semver version of the package.
     */
    readonly version: string = WeavyClient.version;

    /**
     * Checks the version of the Weavy Context against the Weavy Environment version.
     *
     * @param {string} [version] - Optional version to check against the environment version.
     */
    async checkVersion(this: this & WeavyType, version: string = this.version) {
      await this.whenUrl();
      this.networkStateIsPending = true;

      let response;
      try {
        response = await fetch(new URL("/version", this.url), await this.fetchOptions({}, false));
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

      if (environmentVersion.startsWith("v") && (!version || !environmentVersion || version !== environmentVersion)) {
        try {
          const semverVersion = version.split(".").slice(0, 2);
          const semverEnvironmentVersion = environmentVersion.split(".").slice(0, 2);

          if (semverVersion[0] !== semverEnvironmentVersion[0]) {
            throw new Error();
          } else if (semverVersion[1] !== semverEnvironmentVersion[1]) {
            console.warn(
              `Version inconsistency: ${WeavyClient.sourceName}@${this.version} ≠ ${
                (this.url as URL)?.hostname
              }@${environmentVersion}`
            );
          }
        } catch {
          throw new Error(
            `Version mismatch! ${WeavyClient.sourceName}@${this.version} ≠ ${
              (this.url as URL)?.hostname
            }@${environmentVersion}`
          );
        }
      }
    }
  };
};
