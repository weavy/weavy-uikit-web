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
      whenParentElementsDefined.push(customElements.whenDefined(parent.localName))
    }
  }
  
  await Promise.all(whenParentElementsDefined);
}

export const observeConnected = (target: Element, callback: (isConnected: boolean, target: Element) => void) => {
  let lastIsConnected: boolean;
  return new ResizeObserver(() => {
    const { isConnected } = target;
    if (isConnected !== lastIsConnected) {
      lastIsConnected = isConnected;
      callback(isConnected, target);
    }
  }).observe(target);
}