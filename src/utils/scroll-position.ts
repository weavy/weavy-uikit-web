/**
 * Gets the next positioned child relative to the element.
 *
 * @param {Element} el - Reference element in the scrollable area
 * @returns HTMLElement
 */
export function getNextPositionedChild(el: Element | null) {
  while (el) {
    el = el.nextElementSibling;
    if (el instanceof HTMLElement && /absolute|sticky|fixed/.test(getComputedStyle(el).position) === false) {
      return el as HTMLElement;
    }
  }
  return null;
}

/**
 * Finds the nearest scrollable area. Defaults to document.scrollingElement.
 *
 * @param {Element?} element - Reference element in the scrollable area
 * @param {boolean} [includeHidden=false] - Treat elements with `overflow: hidden` as scrollable areas.
 * @returns Element
 */
export function getScrollParent(element: Element, includeHidden: boolean = false): HTMLElement {
  if (element) {
    let style = getComputedStyle(element);
    const excludeStaticParent = style.position === "absolute";
    const overflowRegex = includeHidden ? /(auto|scroll|overlay|hidden)/ : /(auto|overlay|scroll)/;

    if (style.position === "fixed" && document.scrollingElement) {
      return document.scrollingElement as HTMLElement;
    }

    for (let parent: Element | null = element; (parent = parent.parentElement); ) {
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
 * Checks if a parent scroll container is scrolled to bottom
 * @param {Element?} element
 * @param {number} [bottomThreshold=32] - Nearby limit for the bottom. Needs to be at least 1 to catch float calculation errors.
 * @returns boolean
 */
export function isParentAtBottom(element: Element, bottomThreshold: number = 32) {
  if (element) {
    const area = getScrollParent(element);

    // We need to account for scrollTop being a float
    return Math.abs(area.scrollTop + area.clientHeight - area.scrollHeight) < bottomThreshold;
  }
  return false;
}

/**
 * Scrolls a parent scroll container to the bottom using a reference element in the scrollable area.
 *
 * @param {Element?} element - Element in the scroll area
 * @param {boolean} [smooth] - Use smooth scrolling instead of instant scrolling
 */
export async function scrollParentToBottom(element?: Element, smooth: boolean = false) {
  if (element) {
    const area = getScrollParent(element);
    //console.log("scrolling to bottom", {scrollTop: area.scrollTop, clientHeight: area.clientHeight, scrollHeight: area.scrollHeight}, (area.scrollTop + area.clientHeight) - area.scrollHeight);

    // Don't bother if the scroll already is correct
    // We need to account for scrollTop being a float by using 1px diff
    if (Math.abs(area.scrollTop + area.clientHeight - area.scrollHeight) > 1) {
      if (smooth) {
        area.scrollTo({
          top: area.scrollHeight,
          left: 0,
          behavior: "smooth",
        });
      } else {
        area.scrollTop = area.scrollHeight;
      }
    }

    // Check when the scroll is done
    await new Promise((resolve) => {
      let lastScrollTop = area.scrollTop;
      const scrollCheck = () => {
        if (smooth && area.scrollTop === lastScrollTop) {
          //console.log("smooth scroll interrupted, performing unsmooth scroll instead");
          area.scrollTop = area.scrollHeight;
        }

        lastScrollTop = area.scrollTop;

        // We need to account for scrollTop being a float by using 1px diff
        if (Math.abs(area.scrollTop + area.clientHeight - area.scrollHeight) > 1) {
          requestAnimationFrame(scrollCheck);
        } else {
          resolve(undefined);
        }
      };

      requestAnimationFrame(scrollCheck);
    });
    //console.log("scrolltoBottom done")
  }
}
