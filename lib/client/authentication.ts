import { WeavyContext, type WeavyContextType } from "./weavy-context";
import type { WeavyTokenFactory, WeavyContextOptionsType } from "../types/weavy.types";
import { DestroyError } from "../utils/errors";
import { toUrl } from "../converters/url";

export interface WeavyAuthenticationProps {
  whenUrlAndTokenFactory: () => Promise<void>;
  whenTokenIsValid: () => Promise<void>;
  tokenFactory: WeavyTokenFactory | undefined;
  tokenUrl: string | URL | undefined;
  getToken: (refresh?: boolean) => Promise<string>;
}

// WeavyAuthentication mixin/decorator
export const WeavyAuthentication = (base: typeof WeavyContext) => {
  return class WeavyAuthentication extends base implements WeavyAuthenticationProps {
    // AUTHENTICATION

    constructor(options: WeavyContextOptionsType) {
      super(options);

      this.whenUrl().then(() => {
        if (this.url && this.tokenFactory) {
          this.#resolveUrlAndTokenFactory?.(true);
        }
      });
    }

    // whenUrlAndTokenFactory
    #resolveUrlAndTokenFactory?: (value: unknown) => void;

    #whenUrlAndTokenFactory = new Promise((r) => {
      this.#resolveUrlAndTokenFactory = r;
    });

    async whenUrlAndTokenFactory() {
      await this.#whenUrlAndTokenFactory;
    }

    // whenTokenIsValid
    #resolveTokenIsValid?: (value: unknown) => void;

    #whenTokenIsValid = new Promise((r) => {
      this.#resolveTokenIsValid = r;
    });

    async whenTokenIsValid() {
      await this.#whenTokenIsValid;
    }

    #tokenFactory?: WeavyTokenFactory;

    /**
     * Async function returning an `access_token` string for _your_ authenticated user. A boolean `refresh` parameter is provided to let you now if a fresh token is needed from Weavy.
     */
    get tokenFactory() {
      return this.#tokenFactory;
    }

    set tokenFactory(tokenFactory) {
      if (this.isDestroyed) {
        throw new DestroyError();
      }

      if (this.#tokenFactory && this.#tokenFactory !== tokenFactory) {
        this.whenUrlAndTokenFactory().then(() => {
          (this as this & WeavyContextType).queryClient.refetchQueries({ stale: true });
        });
      }

      this.#tokenFactory = tokenFactory;

      if (this.url && this.#tokenFactory) {
        this.#resolveUrlAndTokenFactory?.(true);
      }
    }

    #tokenUrl?: URL;

    /**
     * An URL to an endpoint returning an JSON data containing an `access_token` string property for _your_ authenticated user. A boolean `refresh=true` query parameter is provided in the request to let you now if when a fresh token is needed from Weavy.
     */
    get tokenUrl() {
      return this.#tokenUrl;
    }

    set tokenUrl(tokenUrl: string | URL | undefined) {
      if (this.isDestroyed) {
        throw new DestroyError();
      }

      try {
        if (typeof tokenUrl === "string") {
          this.#tokenUrl = toUrl(tokenUrl);
        } else if (tokenUrl instanceof URL) {
          this.#tokenUrl = tokenUrl;
        } else if (tokenUrl !== undefined) {
          throw -1;
        }
      } catch (e) {
        throw new Error("Invalid url");
      }

      if (this.#tokenUrl && !this.tokenFactory) {
        // Set default tokenFactory
        this.tokenFactory = async (refresh) => {
          if (!this.tokenUrl) {
            throw new Error("tokenURL property is not valid");
          }

          const tokenUrl = new URL(this.tokenUrl);

          if (refresh) {
            tokenUrl.searchParams.set("refresh", "true");
          } else {
            tokenUrl.searchParams.delete("refresh");
          }

          const response = await fetch(tokenUrl);

          if (response.ok) {
            const data = await response.json();

            if (data.access_token === undefined) {
              throw new Error("Token response does not contain required property: access_token");
            }

            return data.access_token;
          } else {
            throw new Error("Could not get access token from server!");
          }
        };
      }
    }

    #tokenPromise: Promise<string> | null = null;
    #token: string = "";

    #validateToken(token: unknown) {
      if (!token) {
        return false;
      }

      if (typeof token !== "string") {
        throw new TypeError(`You have provided an invalid string access token of type ${typeof token}.`);
      } else if (typeof token === "string" && !token.startsWith("wyu_")) {
        if (token.startsWith("wys_")) {
          throw new TypeError("You have provided an API key for authentication. Provide a user access token instead.");
        } else {
          throw new TypeError(`You have provided an invalid string as access token.`);
        }
      }

      this.#resolveTokenIsValid?.(token);

      return true;
    }

    #validTokenFromFactory: WeavyTokenFactory = async (refresh: boolean = false) => {
      const racePromises = [this.whenUrlAndTokenFactory()];

      if (this.tokenFactoryRetryDelay !== Infinity) {
        racePromises.push(new Promise((r) => setTimeout(r, this.tokenFactoryRetryDelay)));
      }

      await Promise.race(racePromises);

      const token = await this.tokenFactory?.(refresh);

      if (!this.#validateToken(token)) {
        // Reset token promise and wait for a more valid token
        this.#whenUrlAndTokenFactory = new Promise((r) => {
          this.#resolveUrlAndTokenFactory = r;
        });

        if (!refresh) {
          return await this.#validTokenFromFactory(false);
        }
      }

      if (!token) {
        throw new TypeError("Could not get a valid token from tokenFactory.");
      }

      this.#resolveUrlAndTokenFactory?.(true);

      return token;
    };

    async getToken(refresh: boolean = false): Promise<string> {
      if (this.isDestroyed) {
        throw new DestroyError();
      }

      if (this.#token && !refresh) {
        return this.#token;
      }

      await this.whenUrlAndTokenFactory();

      if (!this.#tokenPromise) {
        this.#tokenPromise = new Promise((resolve, reject) => {
          // Try getting a valid token
          this.#validTokenFromFactory(refresh).then(resolve).catch(reject);

          if (this.tokenFactoryTimeout !== Infinity) {
            setTimeout(() => reject(new Error("Token factory timeout.")), this.tokenFactoryTimeout);
          }

          window.addEventListener("offline", () => reject(new Error("Network changed.")), { once: true });
          window.addEventListener("online", () => reject(new Error("Network changed.")), { once: true });
        });
        try {
          const token = await this.#tokenPromise;

          this.#tokenPromise = null;
          this.#token = token;
          return this.#token;
        } catch (e) {
          this.#tokenPromise = null;
          console.error(e);
          throw e;
        }
      } else {
        //console.log(this.weavyId, "Already a promise in action, wait for it to resolve...")
        return await this.#tokenPromise;
      }
    }
  };
};
