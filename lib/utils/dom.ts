/**
 * Waits for the DOM to be ready. Same as <script defer></script> or jQuery.ready().
 * Executes instantly if ready.
 *
 * @param {Function} callback - The function to execute when ready.
 */
export function defer(callback: () => void) {
  if (document.readyState !== "loading") {
    callback();
  } else {
    document.addEventListener("DOMContentLoaded", callback, {
      once: true,
    });
  }
}

export const autofocusRef = (r: Element | undefined) => {
  r && requestAnimationFrame(() => (r as HTMLElement)?.focus?.());
};

export async function whenParentsDefined(element: Element, prefix: string = "wy-") {
  const whenParentElementsDefined = [];
  for (let parent: Element | null = element; (parent = parent.parentElement); ) {
    if (parent.matches(":not(:defined)") && parent.localName.startsWith(prefix)) {
      console.log("Waiting for defining", parent.localName);
      whenParentElementsDefined.push(customElements.whenDefined(parent.localName));
    }
  }

  await Promise.all(whenParentElementsDefined);
}

export const observeConnected = (target: Element, callback: (isConnected: boolean, target: Element) => void) => {
  let lastIsConnected: boolean;
  const connectObserver = new ResizeObserver(() => {
    const { isConnected } = target;
    if (isConnected !== lastIsConnected) {
      lastIsConnected = isConnected;
      callback(isConnected, target);
    }
  });

  connectObserver.observe(target);

  return connectObserver;
};

export async function whenDocumentVisible() {
  if (document.hidden) {
    await new Promise((resolve) => {
      window.addEventListener(
        "visibilitychange",
        () => {
          if (!document.hidden) {
            resolve(true);
          }
        },
        { once: true }
      );
    });
  }
}

export const defaultVisibilityCheckOptions: CheckVisibilityOptions = {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  /* @ts-ignore */
  opacityProperty: true,
  visibilityProperty: true,
  // Legacy compatibility
  checkOpacity: true,
  checkVisibilityCSS: true,
};

export function untilVisibility(target: HTMLElement, visibility: boolean = true, options: CheckVisibilityOptions = defaultVisibilityCheckOptions, callBack: (value: unknown) => void) {
  if(target.checkVisibility(options) === visibility) {
    callBack(visibility);
  } else {
    requestAnimationFrame(() => untilVisibility(target, visibility, options, callBack))
  }
}

export async function whenElementVisible(target: HTMLElement, visibility: boolean = true, options: CheckVisibilityOptions = defaultVisibilityCheckOptions) {
  if (target.checkVisibility(options) !== visibility) {
    const whenVisible = new Promise((r) => {
      untilVisibility(target, visibility, options, r);
    });
    await whenVisible;
  }
}

export function isInShadowDom(node: Node) {
  return node.getRootNode() instanceof ShadowRoot;
}

export function supportsPopover() {
  return HTMLElement.prototype.hasOwnProperty("popover");
}
