import { throwOnDomNotAvailable } from "./dom";
import { getNextPositionedChild, getScrollParent } from "./scroll-position";

const THRESHOLD = 0; // as soon as even one pixel is visible, the callback will be run
const ROOT_MARGIN = undefined; //"512px"; // Margin around the root, used to grow or shrink the root element's bounding box before computing intersections. Does not work well when document is intersectionParent.

/**
 * Creates a new regular scroll listener
 *
 * @param {HTMLElement} observeElement
 * @param {Function} whenNext
 * @returns IntersectionObserver
 */
export function createScroller(observeElement: HTMLElement, whenNext: () => Promise<void>, reverse: boolean = false) {
  throwOnDomNotAvailable();
  whenNext ??= () => Promise.reject(new Error("No scroll function defined"));

  const parentElement = reverse ? getScrollParent(observeElement) : document.documentElement;

  // // Disable scroll anchoring https://developer.mozilla.org/en-US/docs/Web/CSS/overflow-anchor/Guide_to_scroll_anchoring
  // if (parent instanceof HTMLElement && getComputedStyle(parent).overflowAnchor !== "none") {
  //   parent.style.overflowAnchor = "none";
  // }

  // Bug using scrollingElement in frames. See https://github.com/w3c/IntersectionObserver/issues/372
  const intersectionParent = parentElement === document.documentElement ? document : parentElement;

  // wait for layout?
  let wait = false;

  const scrollObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !wait) {
          wait = true;
          if (reverse && parentElement && intersectionParent instanceof HTMLElement) {
            // for reverse scroll we need to take some extra steps to keep the scroll position intact
            const nextPositionedChild = getNextPositionedChild(entry.target) || (entry.target as HTMLElement);
            const prevScrollHeight = parentElement.scrollHeight;
            const childOffsetBefore = nextPositionedChild.offsetTop;

            const afterNext = () => {
              queueMicrotask(() => {
                // NOTE: when this is called via observer we need to requestAnimationFrame, otherwise scrolling happens to fast (before the DOM has been updated)
                if (prevScrollHeight !== parentElement.scrollHeight) {
                  // layout already rendered
                  if (nextPositionedChild?.isConnected) {
                    const diff = nextPositionedChild.offsetTop - childOffsetBefore;
                    //console.log("infinite scroll updated instantly", nextPositionedChild.offsetTop, childOffsetBefore, nextPositionedChild.isConnected);
                    parentElement.scrollTop += diff;
                  }
                  requestAnimationFrame(() => (wait = false));
                } else {
                  queueMicrotask(() => {
                    if (prevScrollHeight !== parentElement.scrollHeight) {
                      // layout rendered after
                      if (nextPositionedChild?.isConnected) {
                        const diff = nextPositionedChild.offsetTop - childOffsetBefore;
                        //console.log("infinite scroll updated by microtask", nextPositionedChild.offsetTop, childOffsetBefore, nextPositionedChild.isConnected);
                        parentElement.scrollTop += diff;
                      }
                      requestAnimationFrame(() => (wait = false));
                    } else {
                      // layout not rendered yet
                      requestAnimationFrame(() => {
                        if (scrollObserver.takeRecords().length && nextPositionedChild?.isConnected) {
                          const diff = nextPositionedChild.offsetTop - childOffsetBefore;
                          //console.log("infinite scroll updated by animationframe", nextPositionedChild.offsetTop, childOffsetBefore, nextPositionedChild.isConnected);
                          parentElement.scrollTop += diff;
                        }
                        requestAnimationFrame(() => (wait = false));
                      });
                    }
                  });
                }
              });
            };

            void whenNext().then(afterNext);
          } else {
            void whenNext().then(() => {
              requestAnimationFrame(() => (wait = false));
            });
          }
        }
      });
    },
    { root: intersectionParent, threshold: THRESHOLD, rootMargin: ROOT_MARGIN }
  );

  scrollObserver.observe(observeElement);

  return scrollObserver;
}

/**
 * Creates a new reverse scroll listener
 *
 * @param {HTMLElement} observeElement
 * @param {Function} whenNext
 * @returns IntersectionObserver
 */
export function createReverseScroller(observeElement: HTMLElement, whenNext: () => Promise<void>) {
  return createScroller(observeElement, whenNext, true);
}
