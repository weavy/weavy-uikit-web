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
    version: string | undefined;
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

    _whenCheckVersion?: Promise<WeavyVersionType>;

    /**
     * Checks the version of the Weavy Context against the Weavy Environment version.
     *
     * The environment version is read from the anonymous `/ready` endpoint, which returns
     * `{ "node_id": "...", "version": "33.0.0", "status": "healthy" }` with status 200 when the node is ready,
     * and the same body with status 503 when it is not. The version is read from both, but the server is only
     * considered reachable on 200 since every other request to an unhealthy node is also answered with 503.
     */
    async checkVersion(this: this & WeavyType) {
      if (!this._whenCheckVersion) {
        this._whenCheckVersion = (async () => {
          await this.whenUrl();
          this.networkStateIsPending = true;
          let response: Response | undefined;
          try {
            response = await fetch(new URL("/ready", this.url), await this.fetchOptions({}, false));
          } catch (e) {
            console.warn("Could not check Weavy version: " + (e as Error).toString());
          }
          this.networkStateIsPending = false;
          this.serverState = response?.ok ? "ok" : "unreachable";

          // Only a 503 from the node itself carries the version; a 503 from a proxy or a 404 from an older
          // environment without the version in /ready has no usable body.
          let environmentVersion: string | undefined;
          if (response?.ok || response?.status === 503) {
            try {
              environmentVersion = ((await response.json()) as { version?: string }).version || undefined;
            } catch {
              // Not a JSON body, handled below
            }
          }

          if (!environmentVersion) {
            if (response) {
              console.warn(
                `Could not verify environment version. ${response.status} ${response.statusText}`,
              );
            }
            return {
              client: {
                name: WeavyClient.sourceName,
                version: this.version,
              },
              environment: {
                name: (this.url as URL)?.hostname,
                version: undefined,
              },
            };
          }

          if (!this.version || this.version !== environmentVersion) {
            try {
              // Only major and minor are compared. Patch releases (and prerelease/build suffixes) are considered
              // compatible, so e.g. a UI kit 32.2.0 against an environment 32.2.1 is not a mismatch.
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
              }
            } catch (e) {
              throw new Error(
                `Weavy version mismatch! ${WeavyClient.sourceName}@${this.version} ≠ ${
                  (this.url as URL)?.hostname
                }@${environmentVersion} - This will likely cause errors!`,
                {
                  // eslint-disable-next-line preserve-caught-error, @typescript-eslint/no-unnecessary-type-assertion
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
              this._whenCheckVersion = undefined;
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
      return await this._whenCheckVersion;
    }
  };
};
