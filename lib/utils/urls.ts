import { throwOnDomNotAvailable } from "./dom";

/** Opens a url normally, in a specific target or as a download */
export function openUrl(url: string = "", target: string = "", name: string = "", download: boolean = false) {
  throwOnDomNotAvailable();

  if (url) {
    // a is needed for downloading object urls
    const a = document.createElement("a");

    if (download) {
      if (/^(data:|blob:)/.test(url)) {
        // Only set download param for files not from server
        a.download = name || "download";
      } else {
        // add download parameter, needed for CORS downloads
        url = url.includes("?d=1") || url.includes("&d=1") ? url : url.includes("?") ? url + "&d=1" : url + "?d=1";
      }
    }

    if (target) {
      a.target = target;
    }

    a.href = url;

    document.body.appendChild(a);

    try {
      a.click();
    } catch {
      console.warn("Could not open link normally, trying fallback");
      if (!/^(?:blob:|data:)/.test(url)) {
        try {
          window.open(url, target);
        } catch {
          console.error(`Could not ${download ? "download" : "open"} ${name}`);
        }
      } else {
        console.error(`Could not ${download ? "download" : "open"} ${name}`);
      }
    }

    document.body.removeChild(a);
  }
}


/** Provides an url that is served from the current environment and from source when in dev/serve mode */
export function environmentUrl(url: URL | string, importMetaUrl?: URL | string) {
  return new URL(
    url,
    typeof WEAVY_IMPORT_URL === "string" &&
    (!importMetaUrl || !new URL(importMetaUrl).href.startsWith(WEAVY_IMPORT_URL))
      ? WEAVY_IMPORT_URL
      : importMetaUrl
  );
}
