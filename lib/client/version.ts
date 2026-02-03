import { WeavyClient, type WeavyType } from "./weavy";
import { Constructor } from "../types/generic.types";

export interface WeavyVersionProps {
  readonly version: string;
  checkVersion: () => Promise<WeavyVersionType>;
}

export type WeavyVersionType = {
  /** The level of possible semver mismatch */
  mismatch?: "major" | "minor" | "patch";

  /** Information about the UI kit version */
  client: {
    /** Package name */
    name: string;
    /** Semver version */
    version: string;
  };

  /** Information about the Weavy environment version */
  environment: {
    /** The hostname of the Weavy environment */
    name: string;
    /** Semver version */
    version: string;
  };
};

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

    #whenCheckVersion?: Promise<WeavyVersionType>;

    /**
     * Checks the version of the Weavy Context against the Weavy Environment version.
     *
     */
    async checkVersion(this: this & WeavyType) {
      if (!this.#whenCheckVersion) {
        this.#whenCheckVersion = (async () => {
          await this.whenUrl();
          this.networkStateIsPending = true;
          let response;
          try {
            response = await fetch(new URL("/version", this.url), await this.fetchOptions({}, false));
            if (!response.ok) {
              throw new Error(`Could not verify environment version. ${response.status} ${response.statusText}`, {
                cause: response.status,
              });
            }
            this.networkStateIsPending = false;
            this.serverState = "ok";
          } catch (e) {
            this.networkStateIsPending = false;
            this.serverState = "unreachable";
            throw new Error("Error checking Weavy version: " + (e as Error).toString(), { cause: (e as Error).cause });
          }

          const environmentVersion = await response.text();

          if (!this.version || !environmentVersion || this.version !== environmentVersion) {
            try {
              const semverVersion = this.version.split(".").slice(0, 2);
              const semverEnvironmentVersion = environmentVersion.split(".").slice(0, 2);

              if (semverVersion[0] !== semverEnvironmentVersion[0]) {
                throw new Error(`Major version mismatch`, {
                  cause: "major",
                });
              } else if (semverVersion[1] !== semverEnvironmentVersion[1]) {
                throw new Error(`Minor version mismatch`, {
                  cause: "minor",
                });
              } else if (semverVersion[2] !== semverEnvironmentVersion[2]) {
                throw new Error(`Patch version mismatch`, {
                  cause: "patch",
                });
              }
            } catch (e) {
              throw new Error(
                `Weavy version mismatch! ${WeavyClient.sourceName}@${this.version} ≠ ${
                  (this.url as URL)?.hostname
                }@${environmentVersion} - This will likely cause errors!`,
                {
                  cause: {
                    mismatch: (e as Error).cause,
                    client: {
                      name: WeavyClient.sourceName,
                      version: this.version,
                    },
                    environment: {
                      name: (this.url as URL)?.hostname,
                      version: environmentVersion,
                    },
                  } as WeavyVersionType,
                },
              );
            } finally {
              this.#whenCheckVersion = undefined;
            }
          } else {
            console.info(`Weavy version ${this.version} ☑️`);
          }
          return {
            client: {
              name: WeavyClient.sourceName,
              version: this.version,
            },
            environment: {
              name: (this.url as URL)?.hostname,
              version: environmentVersion,
            },
          };
        })();
      }
      return await this.#whenCheckVersion;
    }
  };
};
