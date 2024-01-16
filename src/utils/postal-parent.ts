//import WeavyPromise from './promise';
import WeavyEvents from "./events";

import { S4 } from "./data";

//console.debug("postal.js", self.name);

type WeavyPostalConfigType = {
  timeout?: number;
};

type WeavyIdType = string | true;

type PostMessageType = object & { 
  name?: string,
  distributeName?: string,
  weavyId?: WeavyIdType,
  weavyMessageId?: string
};

function extractOrigin(url: string) {
  let extractOrigin: string = "";
  try {
    extractOrigin = /^((?:https?:\/\/[^/]+)|(?:file:\/\/))\/?/.exec(url)?.[1] || "";
  } catch (e) {
    console.error(
      "Unable to resolve location origin. Make sure you are using http, https or file protocol and have a valid location URL."
    );
  }
  return extractOrigin;
}

class WeavyPostalParent extends WeavyEvents {
  private contentWindows = new Set<MessageEventSource>();
  private contentWindowsMapByWeavyId = new Map<WeavyIdType, Map<string, MessageEventSource>>();
  private contentWindowOrigins = new WeakMap<MessageEventSource, string>();
  private contentWindowNames = new WeakMap<MessageEventSource, string>();
  private contentWindowWeavyIds = new WeakMap<MessageEventSource, WeavyIdType>();
  private contentWindowDomain = new WeakMap<MessageEventSource, string>();

  private origin = extractOrigin(window.location.href);

  timeout = 2000;

  /**
   * The weavy console logging.
   */
  get console() {
    return console;
  }

  constructor(options: WeavyPostalConfigType = {}) {
    super();

    if (options?.timeout) {
      this.timeout = options.timeout;
    }

    window.addEventListener("message", (e: MessageEvent) => {
      if (e.data.name && e.data.weavyId !== undefined) {
        if (e.data.weavyMessageId && e.data.name !== "message-receipt" && e.data.name !== "unready") {
          //console.debug("sending message receipt", e.data.weavyMessageId, e.data.name)
          try {
            e.source?.postMessage(
              { name: "message-receipt", weavyId: e.data.weavyId, weavyMessageId: e.data.weavyMessageId },
              { targetOrigin: e.origin }
            );
          } catch (error) {
            console.error("could not post back message-receipt to source");
          }
        }

        switch (e.data.name) {
          case "register-child": {
            if (!e.source || !this.contentWindowWeavyIds.has(e.source)) {
              console.warn("register-child: contentWindow not pre-registered", e.source);
            }

            if (e.source && this.contentWindowOrigins.get(e.source) !== e.origin) {
              console.error(
                "register-child: " + this.contentWindowNames.get(e.source) + " has invalid origin",
                e.origin
              );
              return;
            }

            try {
              const weavyId = this.contentWindowWeavyIds.get(e.source!);
              const contentWindowName = this.contentWindowNames.get(e.source!);

              if (contentWindowName && e.source) {
                e.source.postMessage(
                  {
                    name: "register-window",
                    windowName: contentWindowName,
                    weavyId: weavyId || true,
                  },
                  { targetOrigin: e.origin }
                );
              }
            } catch (error) {
              console.error("could not register frame window", error);
            }
            break;
          }
          case "ready": {
            //console.log("received ready", this.contentWindowsByWeavyId.has(e.data.weavyId) && this.contentWindowNames.has(e.source) && this.#contentWindowsByWeavyId.get(e.data.weavyId).get(this.#contentWindowNames.get(e.source)) === e.source, e.origin)
            if (
              e.source &&
              this.contentWindowsMapByWeavyId.has(e.data.weavyId) &&
              this.contentWindowNames.has(e.source) &&
              this.contentWindowsMapByWeavyId.get(e.data.weavyId)?.get(this.contentWindowNames.get(e.source)!)
            ) {
              this.contentWindowDomain.set(e.source, e.origin);
              this.distributeMessage(e);
            }

            break;
          }
          case "unready": {
            // Source window does no longer exist at this point
            if (this.contentWindowsMapByWeavyId.has(e.data.weavyId)) {
              this.distributeMessage(e, true);
            }

            break;
          }
          default: {
            if (e.source === window || this.contentWindowsMapByWeavyId.size) {
              this.distributeMessage(e);
            }

            break;
          }
        }
      }
    });
  }

  private distributeMessage(e: MessageEvent, fromFrame: boolean = false) {
    const fromSelf = e.source === window && e.origin === this.origin;
    fromFrame ||=
      (e.source && this.contentWindowOrigins.has(e.source) && e.origin === this.contentWindowOrigins.get(e.source)) ||
      false;

    if (fromSelf || fromFrame) {
      if (fromFrame && !e.data.windowName && e.source) {
        e.data.windowName = this.contentWindowNames.get(e.source);
      }

      const messageName = e.data.name;

      //console.debug("message from", fromSelf && "self" || fromFrame && "frame " + e.data.windowName, e.data.name, e.data.weavyId);

      this.triggerEvent(messageName, e.data, e);
      this.triggerEvent("message", e.data, e);
    }
  }

  /**
   * Sends the id of a frame to the frame content scripts, so that the frame gets aware of which id it has.
   * The frame needs to have a unique name attribute.
   *
   * @category panels
   * @param {string} weavyId - The id of the group or entity which the contentWindow belongs to.
   * @param {Window} contentWindow - The frame window to send the data to.
   */
  registerContentWindow(
    contentWindow: WindowProxy,
    contentWindowName: string,
    weavyId: WeavyIdType,
    contentOrigin: string
  ) {
    try {
      if (!contentWindowName) {
        console.error("registerContentWindow() No valid contentWindow to register, must be a window and have a name.");
        return;
      }
    } catch (e) {
      console.error("registerContentWindow() cannot access contentWindowName");
    }

    if (contentWindow.self) {
      contentWindow = contentWindow.self;
    }

    this.console.log("registerContentWindow", contentWindow);

    if (!weavyId || weavyId === "true") {
      weavyId = true;
    }

    if (!this.contentWindowsMapByWeavyId.has(weavyId)) {
      this.contentWindowsMapByWeavyId.set(weavyId, new Map());
    }

    this.contentWindowsMapByWeavyId.get(weavyId)?.set(contentWindowName, contentWindow);
    this.contentWindows.add(contentWindow);
    this.contentWindowNames.set(contentWindow, contentWindowName);
    this.contentWindowWeavyIds.set(contentWindow, weavyId);
    this.contentWindowOrigins.set(contentWindow, contentOrigin);
  }

  unregisterAll(weavyId: WeavyIdType) {
    if (this.contentWindowsMapByWeavyId.has(weavyId)) {
      this.contentWindowsMapByWeavyId.get(weavyId)?.forEach((contentWindow, contentWindowName) => {
        this.unregisterContentWindow(contentWindowName, weavyId);
      });
      this.contentWindowsMapByWeavyId.get(weavyId);
      this.contentWindowsMapByWeavyId.delete(weavyId);
    }
  }

  unregisterContentWindow(windowName: string, weavyId: WeavyIdType) {
    if (this.contentWindowsMapByWeavyId.has(weavyId)) {
      if (this.contentWindowsMapByWeavyId.get(weavyId)?.has(windowName)) {
        const contentWindow = this.contentWindowsMapByWeavyId.get(weavyId)?.get(windowName);
        if (contentWindow) {
          try {
            this.contentWindows.delete(contentWindow);
            this.contentWindowNames.delete(contentWindow);
            this.contentWindowWeavyIds.delete(contentWindow);
            this.contentWindowOrigins.delete(contentWindow);
          } catch (e) {
            /* no need to delete contentwindow */
          }
        }
      }
      this.contentWindowsMapByWeavyId.get(weavyId)?.delete(windowName);
      if (this.contentWindowsMapByWeavyId.get(weavyId)?.size === 0) {
        try {
          this.contentWindowsMapByWeavyId.delete(weavyId);
        } catch (e) {
          /* no need to delete weavyId */
        }
      }
    }
  }

  private async whenPostMessage(contentWindow: MessageEventSource, message: PostMessageType, transfer?: Transferable[]) {
    //var whenReceipt = new WeavyPromise();

    if (transfer === null) {
      // Chrome does not allow transfer to be null
      transfer = undefined;
    }

    const toSelf = contentWindow === window.self;
    const targetOrigin = toSelf ? extractOrigin(window.location.href) : this.contentWindowOrigins.get(contentWindow);
    const validWindow = toSelf || (contentWindow && targetOrigin === this.contentWindowDomain.get(contentWindow));

    if (validWindow) {
      if (!message.weavyMessageId) {
        message.weavyMessageId = S4() + S4();
      }

      let messageWatchdog: number;

      await Promise.race([
        new Promise((resolve, reject) => {
          messageWatchdog = window.setTimeout(() => {
            reject(new Error("postMessage() receipt timed out: " + message.weavyMessageId + ", " + message.name));
          }, this.timeout || 2000);
        }),
        new Promise((resolve) => {
          this.on("message-receipt", { weavyId: message.weavyId, weavyMessageId: message.weavyMessageId }, () => {
            console.debug("message-receipt received", message.weavyMessageId, message.name);
            clearTimeout(messageWatchdog);
            resolve(undefined);
          });

          contentWindow.postMessage(message, { targetOrigin, transfer });
        }),
      ]);
    } else {
      throw new Error("postMessage() Invalid window origin: " + targetOrigin + ", " + message.name);
    }
  }

  postToChildren(message: PostMessageType, transfer?: Transferable[]) {
    if (typeof message !== "object" || !message.name) {
      console.error("postToChildren() Invalid message format", message);
      return;
    }

    if (transfer === null) {
      // Chrome does not allow transfer to be null
      transfer = undefined;
    }

    message.distributeName = message.name;
    message.name = "distribute";
    message.weavyId = message.weavyId || true;

    this.contentWindows.forEach((contentWindow) => {
      const targetOrigin = this.contentWindowOrigins.get(contentWindow);
      if (targetOrigin === this.contentWindowDomain.get(contentWindow)) {
        try {
          contentWindow.postMessage(message, { targetOrigin, transfer });
        } catch (e) {
          console.warn(
            "postToChildren() could not distribute message to " + this.contentWindowNames.get(contentWindow)
          );
        }
      }
    });
  }

  async postToFrame(windowName: string, weavyId: WeavyIdType, message: PostMessageType, transfer?: Transferable[]) {
    if (typeof message !== "object" || !message.name) {
      console.error("postToFrame() Invalid message format", message);
      return;
    }

    const contentWindow = this.contentWindowsMapByWeavyId.get(weavyId)?.get(windowName);

    if (!contentWindow) {
      throw new Error(`postToFrame() Window not registered: ${weavyId}, ${windowName}`);
    }

    message.weavyId = weavyId;

    return await this.whenPostMessage(contentWindow, message, transfer);
  }

  async postToSelf(message: PostMessageType, transfer?: Transferable[]) {
    if (typeof message !== "object" || !message.name) {
      console.error("postToSelf() Invalid message format", message);
      return;
    }

    message.weavyId = message.weavyId || true;

    return await this.whenPostMessage(window.self, message, transfer);
  }

  postToSource(e: MessageEvent, message: PostMessageType, transfer?: Transferable[]) {
    if (e.source && e.data.weavyId !== undefined) {
      const fromSelf = e.source === window.self && e.origin === this.origin;
      const fromFrame = this.contentWindowOrigins.has(e.source) && e.origin === this.contentWindowOrigins.get(e.source);

      if (transfer === null) {
        // Chrome does not allow transfer to be null
        transfer = undefined;
      }

      if (fromSelf || fromFrame) {
        message.weavyId = e.data.weavyId;

        try {
          e.source.postMessage(message, { targetOrigin: e.origin, transfer });
        } catch (e) {
          console.error("postToSource() Could not post message back to source", e);
        }
      }
    }
  }
}

export default new WeavyPostalParent();
