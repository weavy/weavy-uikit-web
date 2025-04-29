import { DestroyError } from "../utils/errors";
import { WeavyClient, type WeavyType } from "./weavy";
import { assign } from "../utils/objects";
import { defaultFetchSettings } from "../utils/data";
import type { Constructor } from "../types/generic.types";
import { type FetchOptions, HeaderContentType, HttpMethodType, type HttpUploadMethodType } from "../types/http.types";

export interface WeavyFetchProps {
  /**
   * Gets defaulted fetch options that includes authorization headers for the current user.
   * 
   * @param options { FetchOptions } - Any RequestInit compatible fetch options that should be defaulted and updated with current Authorization.
   * @param authorized { boolean } - Whether to embed authorization token for the endpoint. Set to `false` for any endpoint that doesn't require authorization. Defaults to `true`.
   * @returns {Promise<RequestInit>} Options for Fetch or Request
   */
  fetchOptions: (options?: FetchOptions, authorized?: boolean) => Promise<RequestInit>;

  /**
   * Fetch data from the Web API. Includes token handling and acts on behalf of the current user.
   * 
   * @param url { string | URL } - The URL to the Web API endpoint. Note: Only Web API URL:s are supported.
   * @param options { FetchOptions } Optional RequestInit compatible fetch options. Note that `method` is limited to "GET" | "POST" | "PUT" | "DELETE" | "PATCH".
   * @returns { Promise<Response> } A standard fetch() Response
   */
  fetch: (url: string | URL, options?: FetchOptions) => Promise<Response>;

  /**
   * Upload data to the Web API using a progress callback function to monitor the progress.
   * 
   * @param url { string | URL } - The URL to the Web API endpoint. Note: Only Web API URL:s are supported.
   * @param method { "POST" | "PUT" | "PATCH" } - The http method to use.
   * @param body { string | FormData } - The data to send.
   * @param [contentType] {HeaderContentType} - Optional content type of the body. Defaults to "application/json;charset=utf-8"
   * @param onProgress {(progress: number) => void} Callback function for the progress. The progress parameter is provided as 0-100 percent.
   * @returns { Promise<Response> } A standard fetch() Response
   */
  upload: (
    url: string | URL,
    method: HttpUploadMethodType,
    body: string | FormData,
    contentType?: HeaderContentType,
    onProgress?: (progress: number) => void,
  ) => Promise<Response>;

  /**
   * Gets an Web API URL and returns a Response.
   *
   * @deprecated Use .fetch(url) instead.
   * @param url { string | URL } - The URL to the API endpoint.
   * @returns { Promise<Response> } A standard fetch() Response
   */
  get: (url: string | URL) => Promise<Response>;

  /**
   * Posts data to the Web API and returns a Response.
   *
   * @deprecated Use .fetch(url, options) instead.
   * @param url {string | URL} - The URL of the API endpoint
   * @param method { "GET" | "POST" | "PUT" | "DELETE" | "PATCH" } - The http method to use.
   * @param [body] {BodyInit} - The body data to send. JSON must be encoded as a string.
   * @param [contentType] {HeaderContentType} - The content type of the body. Defaults to "application/json;charset=utf-8".
   * @returns { Promise<Response> } A standard fetch() Response
   */
  post: (
    url: string | URL,
    method: HttpMethodType,
    body?: BodyInit,
    contentType?: HeaderContentType,
  ) => Promise<Response>;
}

// WeavyFetch mixin/decorator
export const WeavyFetchMixin = <TBase extends Constructor<WeavyClient>>(Base: TBase) => {
  return class WeavyFetch extends Base implements WeavyFetchProps {
    // FETCH

    async fetchOptions(
      this: this & WeavyType,
      options: FetchOptions = {},
      authorized: boolean = true
    ): Promise<RequestInit> {
      if (this.isDestroyed) {
        throw new DestroyError();
      }

      const fetchSettings: FetchOptions = {
        headers: {
          "X-Weavy-Source": `${WeavyClient.sourceName}@${WeavyClient.version}`,
          "Content-Type": HeaderContentType.JSON,
        },
        method: "GET",
      };

      const defaultedOptions = assign(assign(defaultFetchSettings, fetchSettings, true), options, true);

      const overriddenOptions = authorized
        ? assign(
            defaultedOptions,
            {
              headers: {
                Authorization: "Bearer " + (await this.getToken()),
              },
            },
            true
          )
        : defaultedOptions;

      return overriddenOptions;
    }

    async fetch(
      this: this & WeavyType,
      url: string | URL,
      options?: FetchOptions,
      retry: boolean = true
    ): Promise<Response> {
      if (this.isDestroyed) {
        throw new DestroyError();
      }

      const fetchOptions: RequestInit = await this.fetchOptions(options);

      this.networkStateIsPending = true;
      const response = await fetch(new URL(url, this.url), fetchOptions);

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          if (retry) {
            await this.getToken(true);
            return await this.fetch(url, options, false);
          } else {
            this.networkStateIsPending = false;
            this.serverState = "unauthorized";
          }
        } else {
          this.networkStateIsPending = false;
        }

        //console.error(this.weavyId, `Error calling endpoint ${url}`, response)
      } else {
        this.networkStateIsPending = false;
        this.serverState = "ok";
      }

      return response;
    }

    async upload(
      this: this & WeavyType,
      url: string | URL,
      method: HttpUploadMethodType,
      body: string | FormData,
      contentType: HeaderContentType = HeaderContentType.JSON,
      onProgress?: (progress: number) => void,
      retry: boolean = true
    ) {
      if (this.isDestroyed) {
        throw new DestroyError();
      }

      const token = await this.getToken();

      return await new Promise<Response>((resolve, reject) => {
        // XMLHttpRequest instead of fetch because we want to track progress
        const xhr = new XMLHttpRequest();
        xhr.open(method, new URL(url, this.url), true);
        xhr.setRequestHeader("Authorization", "Bearer " + token);
        xhr.setRequestHeader("X-Weavy-Source", `${WeavyClient.sourceName}@${WeavyClient.version}`);
        if (contentType) {
          xhr.setRequestHeader("Content-Type", contentType);
        }
        if (onProgress) {
          xhr.upload.addEventListener("progress", (e: ProgressEvent<EventTarget>) => {
            onProgress((e.loaded / e.total) * 100 || 100);
          });
        }

        xhr.onload = (_evt: ProgressEvent<EventTarget>) => {
          if (retry && (xhr.status === 401 || xhr.status === 401)) {
            this.getToken(true)
              .then(() => this.upload(url, method, body, contentType, onProgress, false))
              .then(resolve)
              .catch(reject);
          } else {
            resolve(new Response(xhr.response as BodyInit, { status: xhr.status, statusText: xhr.statusText }));
          }
        };
        xhr.onerror = reject;
        xhr.send(body);
      });
    }

    // DEPRECATED
    async get(this: this & WeavyType, url: string | URL) {
      console.warn(`weavy.get() is deprecated, use weavy.fetch("${url}") instead.`);
      return this.fetch(url);
    }

    // DEPRECATED
    async post(
      this: this & WeavyType,
      url: string | URL,
      method: HttpMethodType,
      body?: BodyInit,
      contentType?: HeaderContentType
    ) {
      console.warn(
        `weavy.post() is deprecated, use weavy.fetch("${url}", { method: "${method}"}) instead.`
      );
      const headers = contentType ? ({ "Content-Type": contentType } as HeadersInit) : undefined;
      return this.fetch(url, { method, body, headers });
    }
  };
};
