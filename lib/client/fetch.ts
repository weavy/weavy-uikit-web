import { DestroyError } from "../utils/errors";
import { WeavyContext, type WeavyContextType } from "./weavy-context";
import { assign } from "../utils/objects";
import { defaultFetchSettings } from "../utils/data";
import type { PlainObjectType } from "../types/generic.types";
import { HeaderContentType, type HttpMethodType, type HttpUploadMethodType } from "../types/http.types";

export interface WeavyFetchProps {
  fetchOptions: (authorized?: boolean) => Promise<RequestInit>;
  get: (url: string) => Promise<Response>;
  post: (
    url: string,
    method: HttpMethodType,
    body?: BodyInit,
    contentType?: HeaderContentType,
    retry?: boolean
  ) => Promise<Response>;
  upload: (
    url: string,
    method: HttpUploadMethodType,
    body: string | FormData,
    contentType?: HeaderContentType,
    onProgress?: (progress: number) => void,
    retry?: boolean
  ) => Promise<Response>;
}

// WeavyFetch mixin/decorator
export const WeavyFetchMixin = (base: typeof WeavyContext) => {
  return class WeavyFetch extends base implements WeavyFetchProps {
    // FETCH

    async fetchOptions(this: this & WeavyContextType, authorized: boolean = true): Promise<RequestInit> {
      if (this.isDestroyed) {
        throw new DestroyError();
      }

      const headers: PlainObjectType = {
        "X-Weavy-Source": `${WeavyContext.sourceName}@${WeavyContext.version}`,
      };

      if (authorized) {
        headers.Authorization = "Bearer " + (await this.getToken());
      }

      return assign(
        defaultFetchSettings,
        {
          headers,
        },
        true
      );
    }

    async get(this: this & WeavyContextType, url: string): Promise<Response> {
      return await this.post(url, "GET");
    }

    async post(
      this: this & WeavyContextType,
      url: string,
      method: HttpMethodType,
      body?: BodyInit,
      contentType: HeaderContentType = HeaderContentType.JSON,
      retry: boolean = true
    ): Promise<Response> {
      if (this.isDestroyed) {
        throw new DestroyError();
      }

      const fetchOptions: RequestInit = assign(
        await this.fetchOptions(),
        {
          headers: { "content-type": contentType },
          method: method,
          body: body,
        },
        true
      );

      this.networkStateIsPending = true;
      const response = await fetch(new URL(url, this.url), fetchOptions);

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          if (retry) {
            await this.getToken(true);
            return await this.post(url, method, body, contentType, false);
          } else {
            this.networkStateIsPending = false;
            this.serverState = "unauthorized";
          }
        } else {
          this.networkStateIsPending = false;
          this.serverState = "unreachable";
        }

        //console.error(this.weavyId, `Error calling endpoint ${url}`, response)
      } else {
        this.networkStateIsPending = false;
        this.serverState = "ok";
      }

      return response;
    }

    async upload(
      this: this & WeavyContextType,
      url: string,
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
        xhr.setRequestHeader("X-Weavy-Source", `${WeavyContext.sourceName}@${WeavyContext.version}`);
        if (contentType) {
          xhr.setRequestHeader("content-type", contentType);
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
            resolve(new Response(xhr.response, { status: xhr.status, statusText: xhr.statusText }));
          }
        };
        xhr.onerror = reject;
        xhr.send(body);
      });
    }
  };
};
