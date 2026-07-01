import { throwOnDomNotAvailable } from "./dom";

/**
 * Gets the next positioned child relative to the element. Elements with `display: contents;` will be checked for their children.
 *
 * @param {HTMLElement} el - Reference element in the scrollable area
 * @returns HTMLElement
 */
export function getNextPositionedChild(el: Element | null, includeSelf: boolean = false): HTMLElement | null {
  if (el && !includeSelf) {
    el = el.nextElementSibling;
  }

  while (el) {
    if (!(el instanceof HTMLElement)) {
      continue;
    }

    const computedStyle = getComputedStyle(el);

    if (computedStyle.display === "none") {
      continue;
    }

    if (computedStyle.display === "contents") {
      if (el.shadowRoot && el.shadowRoot.firstElementChild instanceof HTMLElement) {
        const shadowEl = getNextPositionedChild(el.shadowRoot.firstElementChild, true);

        if (shadowEl) {
          return shadowEl;
        }
      }

      if (el.firstElementChild instanceof HTMLElement) {
        const childEl = getNextPositionedChild(el.firstElementChild, true);

        if (childEl) {
          return childEl;
        }
      }
    }

    if (/absolute|sticky|fixed/.test(computedStyle.position) === false) {
      return el;
    }

    // next
    el = el.nextElementSibling;
  }
  return null;
}

/**
 * Finds the nearest scrollable area. Defaults to document.scrollingElement.
 *
 * @param {HTMLElement?} element - Reference element in the scrollable area
 * @param {boolean} [includeHidden=false] - Treat elements with `overflow: hidden` as scrollable areas.
 * @returns Element
 */
export function getScrollParent(element: HTMLElement, includeHidden: boolean = false): HTMLElement {
  throwOnDomNotAvailable();

  if (element) {
    let style = getComputedStyle(element);
    const excludeStaticParent = style.position === "absolute";
    const overflowRegex = includeHidden ? /(auto|scroll|overlay|hidden)/ : /(auto|overlay|scroll)/;

    if (style.position === "fixed" && document.scrollingElement) {
      return document.scrollingElement as HTMLElement;
    }

    // Check parentElement for normal DOM traversing
    // Check parentNode and/or host to get passed a shadow DOM
    for (
      let parent: Element | ParentNode | null = element;
      (parent = parent.parentElement || parent.parentNode || (parent as unknown as ShadowRoot).host);
    ) {
      if (!(parent instanceof Element)) {
        continue;
      }

      style = getComputedStyle(parent);

      if (excludeStaticParent && style.position === "static") {
        continue;
      }
      if (overflowRegex.test(style.overflow + style.overflowY + style.overflowX)) {
        return parent as HTMLElement;
      }
    }
  }

  return (document.scrollingElement || element) as HTMLElement;
}

/**
 * Checks if a parent scroll container has any overflow
 * @param {HTMLElement?} element
 * @returns boolean
 */
export function hasScroll(element?: HTMLElement) {
  if (element && element.isConnected) {
    const area = getScrollParent(element);
    return area.clientHeight !== area.scrollHeight;
  }
  return false;
}

/**
 * Checks if a parent scroll container is scrolled to bottom
 * @param {HTMLElement?} element
 * @param {number} [bottomThreshold=32] - Nearby limit for the bottom. Needs to be at least 1 to catch float calculation errors.
 * @returns boolean
 */
export function isParentAtBottom(element: HTMLElement, bottomThreshold: number = 32) {
  if (element) {
    return isScrolledToBottom(getScrollParent(element), bottomThreshold);
  }
  return false;
}

/**
 * Checks if a scroll container is scrolled to the bottom. Use this when the
 * scroll container is already known, to avoid re-resolving it via
 * {@link getScrollParent} (e.g. in a high-frequency scroll handler).
 * @param {HTMLElement} area - The scroll container.
 * @param {number} [bottomThreshold=32] - Nearby limit for the bottom. Needs to be at least 1 to catch float calculation errors.
 * @returns boolean
 */
export function isScrolledToBottom(area: HTMLElement, bottomThreshold: number = 32) {
  // We need to account for scrollTop being a float
  return Math.abs(area.scrollTop + area.clientHeight - area.scrollHeight) < bottomThreshold;
}

/**
 * Scrolls a parent scroll container to the bottom using a reference element in the scrollable area.
 *
 * @param {string} direction - Scrolling towards "top" or "bottom".
 * @param {HTMLElement?} element - Element in the scroll area
 * @param {boolean} [smooth] - Use smooth scrolling instead of instant scrolling
 */
export async function scrollParentTo(direction: "top" | "bottom", element?: HTMLElement, smooth: boolean = false) {
  if (element) {
    const area = getScrollParent(element);
    //console.log("scrolling to", direction, {area, scrollTop: area.scrollTop, clientHeight: area.clientHeight, scrollHeight: area.scrollHeight}, (area.scrollTop + area.clientHeight) - area.scrollHeight);

    // Don't bother if the scroll already is correct
    // We need to account for scrollTop being a float by using 1px diff
    const needsScroll = direction === "top" ? area.scrollTop >= 1 : Math.abs(area.scrollTop + area.clientHeight - area.scrollHeight) > 1

    if (needsScroll) {
      const targetTop = direction === "top" ? 0 : area.scrollHeight;

      if (smooth) {
        // Wait for other things to finish rendering before attempting to scroll smoothly
        await new Promise((r) => requestAnimationFrame(r));
        area.scrollTo({
          top: targetTop,
          left: 0,
          behavior: "smooth",
        });
      } else {
        area.scrollTop = targetTop;
      }
    }

    // Check when the scroll is done
    await whenScrolledTo(direction, area, smooth);
    //console.log("scrollto", direction, "done")
  }
}


/**
 * Waits for scroll to top/bottom to finish.
 * @param direction - Scrolling towards "top" or "bottom".
 * @param area - The area to check scroll on.
 * @param smooth - If the scroll is expected to be smooth. Includes fixing for interrupted smooth scrolls.
 */
export async function whenScrolledTo(direction: "top" | "bottom", area: HTMLElement, smooth: boolean = false) {
  await new Promise((resolve) => {
    const targetTop = () => (direction === "bottom" ? area.scrollHeight - area.clientHeight : 0);

    let lastScrollTop = area.scrollTop;
    let lastScrollHeight = area.scrollHeight;
    let failedAttempts = 0;
    // Safety bailouts so we never poll forever. `stalledFrames` covers content that
    // stops progressing; `totalFrames` is an absolute ceiling that also covers a
    // target that keeps moving away (e.g. scroll-snap or momentum fighting the
    // re-pin, or continuously growing content).
    let stalledFrames = 0;
    let totalFrames = 0;
    const maxStalledFrames = 60;
    const maxTotalFrames = 300;

    const scrollCheck = () => {
      const moved = area.scrollTop !== lastScrollTop;
      const grew = area.scrollHeight !== lastScrollHeight;

      // We need to account for scrollTop being a float by using 1px diff
      const isAtTarget = direction === "top" ? area.scrollTop < 1 : isScrolledToBottom(area, 1);

      if (isAtTarget) {
        resolve(undefined);
        return;
      }

      if (smooth) {
        // We allow 1 failed attempt, which often is consumed on scroll start.
        // If a smooth scroll stalls (interrupted, or the target moved because
        // content changed height) fall back to an instant scroll to the target.
        if (!moved && failedAttempts++ === 1) {
          //console.log("smooth scroll interrupted, performing unsmooth scroll instead", failedAttempts);
          area.scrollTop = targetTop();
        }
      } else {
        // Non-smooth: re-pin to the target every frame so we keep following content
        // that grows in height after the initial scroll (async images, embeds, etc.).
        area.scrollTop = targetTop();
      }

      // Bail out once nothing is progressing anymore (target unreachable), or
      // after an absolute ceiling regardless of progress.
      stalledFrames = !moved && !grew ? stalledFrames + 1 : 0;
      if (stalledFrames >= maxStalledFrames || ++totalFrames >= maxTotalFrames) {
        resolve(undefined);
        return;
      }

      lastScrollTop = area.scrollTop;
      lastScrollHeight = area.scrollHeight;
      requestAnimationFrame(scrollCheck);
    };

    requestAnimationFrame(scrollCheck);
  });
}
