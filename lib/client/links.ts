import { WeavyClient } from "./weavy";
import { Constructor } from "../types/generic.types";
import { LinkType } from "../types/app.types";
import { dispatchRawLinkEvent } from "../utils/notifications";
import { getStorage } from "../utils/data";

export interface WeavyLinksProps {
  /**
   * Storage for sharing data
   */
  storage?: Storage;

  /**
   * Provide a link for any matching component, via `wy-link` event or via storage.
   * @param link - The link data to provide
   */
  setLink: (link: LinkType) => boolean;

  /**
   * Reads a link from storage and exposes it via the link property and context.
   *
   */
  readStorageLink: () => LinkType | undefined;

  /**
   * Shares a link with other blocks that may consume it automatically in other tabs or windows or when reloading the page.
   *
   * @param link - The entity to provide.
   */
  provideStorageLink: (link: LinkType) => void;

  /**
   * Consumes a link in storage. Make sure to consume it after it has been used.
   */
  consumeStorageLink: () => void;
}

// WeavyLinks mixin/decorator
export const WeavyLinksMixin = <TBase extends Constructor<WeavyClient>>(Base: TBase) => {
  return class WeavyLinks extends Base implements WeavyLinksProps {

    storage = getStorage("localStorage");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...args: any[]) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      super(...args);
    }

    setLink(link: LinkType) {
      this.provideStorageLink(link);
      return dispatchRawLinkEvent(this.host, link);
    }

    provideStorageLink(link: LinkType) {
      // Note: The "storage" event when setting items in storage is only triggered in _other_ windows.
      this.storage?.setItem("wy-link", btoa(JSON.stringify(link)));
    }

    readStorageLink() {
      if (!this.storage) {
        console.error("Storage not available");
        return;
      }

      const storageLink = this.storage.getItem("wy-link");
      if (storageLink) {
        //console.log("found link, parsing...")
        try {
          const parsedLink = JSON.parse(atob(storageLink)) as LinkType;
          if (parsedLink) {
            //console.log("parsed Link", parsedLink)
            return parsedLink;
          }
        } catch (e) {
          console.error("Error parsing link", e);
        }
      }

      return undefined;
    }

    /**
     * Consumes a link in storage. Make sure to consume it after it has been used.
     *
     * @internal
     */
    consumeStorageLink() {
      this.storage?.removeItem("wy-link");
    }
  };
};
