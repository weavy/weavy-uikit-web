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