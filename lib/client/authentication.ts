import { WeavyClient, type WeavyType } from "./weavy";
import type { WeavyTokenFactory } from "../types/weavy.types";
import { DestroyError } from "../utils/errors";
import { Constructor } from "../types/generic.types";

export interface WeavyAuthenticationProps {
  whenTokenFactory: () => Promise<void>;
  whenUrlAndTokenFactory: () => Promise<void>;
  whenTokenIsValid: () => Promise<void>;
  tokenFactory: WeavyTokenFactory | undefined;
  tokenUrl: string | URL | undefined;
  getToken: (refresh?: boolean) => Promise<string>;
}

// WeavyAuthentication mixin/decorator
export const WeavyAuthenticationMixin = <TBase extends Constructor<WeavyClient>>(Base: TBase) => {
  return class WeavyAuthentication extends Base implements WeavyAuthenticationProps {
    // AUTHENTICATION

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...args: any[]) {
      super(...args);

      Promise.all([this.whenUrl(), this.whenTokenFactory()]).then(() => {
        if (this.url && this.tokenFactory) {
          this._resolveUrlAndTokenFactory?.(true);
        }
      });
    }

    // whenTokenFactory
    _resolveTokenFactory?: (value: unknown) => void;

    _whenTokenFactory = new Promise((r) => {
      this._resolveTokenFactory = r;
    });

    async whenTokenFactory() {
      await this._whenTokenFactory;
    }

    // whenUrlAndTokenFactory
    _resolveUrlAndTokenFactory?: (value: unknown) => void;

    _whenUrlAndTokenFactory = new Promise((r) => {
      this._resolveUrlAndTokenFactory = r;
    });

    async whenUrlAndTokenFactory() {
      await this._whenUrlAndTokenFactory;
    }

    // whenTokenIsValid
    _resolveTokenIsValid?: (value: unknown) => void;

    _whenTokenIsValid = new Promise((r) => {
      this._resolveTokenIsValid = r;
    });

    async whenTokenIsValid() {
      await this._whenTokenIsValid;
    }

    _tokenFactory?: WeavyTokenFactory;

    /**
     * Async function returning an `access_token` string for _your_ authenticated user. A boolean `refresh` parameter is provided to let you now if a fresh token is needed from Weavy.
     */
    get tokenFactory(): WeavyTokenFactory | undefined {
      return this._tokenFactory;
    }

    set tokenFactory(tokenFactory: WeavyTokenFactory | null | undefined) {
      if (this.isDestroyed) {
        throw new DestroyError();
      }

      if (this._tokenFactory && this._tokenFactory !== tokenFactory) {
        this.whenTokenFactory().then(() => {
          (this as unknown as WeavyType).queryClient.refetchQueries({ stale: true });
        });
      }

      this._tokenFactory = tokenFactory ?? undefined;

      if (this._tokenFactory) {
        queueMicrotask(()=> {
          this._resolveTokenFactory?.(true);
        })
      }
    }

    _tokenUrl?: URL;

    /**
     * An URL to an endpoint returning an JSON data containing an `access_token` string property for _your_ authenticated user. A boolean `refresh=true` query parameter is provided in the request to let you now if when a fresh token is needed from Weavy.
     */
    get tokenUrl(): URL | undefined {
      return this._tokenUrl;
    }

    set tokenUrl(tokenUrl: string | URL | null | undefined) {
      if (this.isDestroyed) {
        throw new DestroyError();
      }

      try {
        if (typeof tokenUrl === "string") {
          if (tokenUrl) {
            this._tokenUrl = new URL(tokenUrl, window.location.toString());
          }
        } else if (tokenUrl instanceof URL) {
          this._tokenUrl = tokenUrl;
        } else if (tokenUrl === undefined || tokenUrl === null) {
          this._tokenUrl = undefined;
        } else {
          throw -1;
        }
      } catch (e) {
        throw new Error("Invalid url", e as Error);
      }

      if (this._tokenUrl && !this.tokenFactory) {
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

    _tokenPromise: Promise<string> | null = null;
    _token: string = "";

    _validateToken(token: unknown) {
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

      this._resolveTokenIsValid?.(token);

      return true;
    }

    _validTokenFromFactory: (refresh: boolean) => Promise<string> = async (refresh = false) => {
      const racePromises = [this.whenTokenFactory()];

      if (this.tokenFactoryRetryDelay !== Infinity) {
        racePromises.push(new Promise((r) => setTimeout(r, this.tokenFactoryRetryDelay)));
      }

      await Promise.race(racePromises);

      const token = await this.tokenFactory?.(refresh) ?? '';

      if (!this._validateToken(token)) {
        // Reset token promise and wait for a more valid token
        this._whenTokenFactory = new Promise((r) => {
          this._resolveTokenFactory = r;
        });

        if (!refresh) {
          return await this._validTokenFromFactory(false);
        }
      } else if (refresh && token === this._token) {
        // same token, try again in a while?
        if (this.tokenFactoryRetryDelay !== Infinity) {
          await new Promise((r) => setTimeout(r, this.tokenFactoryRetryDelay));
          return await this._validTokenFromFactory(true);
        }
      }

      if (!token) {
        throw new TypeError("Could not get a valid token from tokenFactory.");
      }

      this._resolveTokenFactory?.(true);
      this.whenUrl().then(this._resolveUrlAndTokenFactory);

      return token;
    };

    async getToken(refresh: boolean = false): Promise<string> {
      if (this.isDestroyed) {
        throw new DestroyError();
      }

      if (this._token && !refresh) {
        return this._token;
      }

      if (!this._tokenPromise) {
        this._tokenPromise = new Promise((resolve, reject) => {
          // Try getting a valid token
          this._validTokenFromFactory(refresh).then(resolve).catch(reject);

          if (this.tokenFactoryTimeout !== Infinity) {
            setTimeout(() => reject(new Error("Token factory timeout.")), this.tokenFactoryTimeout);
          }

          window.addEventListener("offline", () => reject(new Error("Network changed.")), { once: true });
          window.addEventListener("online", () => reject(new Error("Network changed.")), { once: true });
        });
        try {
          const token = await this._tokenPromise;

          this._tokenPromise = null;
          this._token = token;
          return this._token;
        } catch (e) {
          this._tokenPromise = null;
          throw e;
        }
      } else {
        //console.log(this.weavyId, "Already a promise in action, wait for it to resolve...")
        return await this._tokenPromise;
      }
    }
  };
};
