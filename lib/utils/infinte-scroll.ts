import { getNextPositionedChild, getScrollParent } from "./scroll-position";

const THRESHOLD = 0; // as soon as even one pixel is visible, the callback will be run
const ROOT_MARGIN = "512px"; // margin around the root, used to grow or shrink the root element's bounding box before computing intersections

/**
 * Creates a new regular scroll listener
 *
 * @param {Element} observeElement
 * @param {Function} whenNext
 * @returns IntersectionObserver
 */
export function createScroller(observeElement: Element, whenNext: () => Promise<void>, reverse: boolean = false) {
  // inverted infinite scroll (e.g. for messages)
  let prevSleep = false;

  //console.log("creating reverse scroller");
  const parent = getScrollParent(observeElement) as HTMLElement;

  // Disable scroll anchoring https://developer.mozilla.org/en-US/docs/Web/CSS/overflow-anchor/Guide_to_scroll_anchoring
  parent.style.overflowAnchor = "none";

  // Bug using scrollingElement in frames. See https://github.com/w3c/IntersectionObserver/issues/372
  const intersectionParent = parent === document.documentElement ? document : parent;

  whenNext ??= () => Promise.reject(new Error("No reverse scroller handler function defined")); // default

  //console.log("create Scroller!!", parent)

  const scrollObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !prevSleep) {
          prevSleep = true;

          let nextPositionedChild: HTMLElement, prevScrollHeight: number, childOffsetBefore: number;

          // find first child (that is regularly positioned)
          if (reverse) {
            nextPositionedChild = getNextPositionedChild(entry.target) || (entry.target as HTMLElement);
            prevScrollHeight = parent.scrollHeight;
            childOffsetBefore = nextPositionedChild.offsetTop;
            //console.log("picking nextPositionedChild", nextPositionedChild, nextPositionedChild.isConnected)
          }

          const afterNext = () => {
            queueMicrotask(() => {
              // Place last in microtask queue
              // scroll parent so that first child remains in the same position as before
              // NOTE: when this is called via observer we need to requestAnimationFrame, otherwise scrolling happens to fast (before the DOM has been updated)
              if (prevScrollHeight !== parent.scrollHeight) {
                // layout already rendered
                if (reverse && nextPositionedChild?.isConnected) {
                  const diff = nextPositionedChild.offsetTop - childOffsetBefore;
                  //console.log("infinite scroll updated instantly", nextPositionedChild.offsetTop, childOffsetBefore, nextPositionedChild.isConnected);
                  parent.scrollTop += diff;
                }
                requestAnimationFrame(() => (prevSleep = false));
              } else {
                queueMicrotask(() => {
                  if (prevScrollHeight !== parent.scrollHeight) {
                    // layout rendered after
                    if (reverse && nextPositionedChild?.isConnected) {
                      const diff = nextPositionedChild.offsetTop - childOffsetBefore;
                      //console.log("infinite scroll updated by microtask", nextPositionedChild.offsetTop, childOffsetBefore, nextPositionedChild.isConnected);
                      parent.scrollTop += diff;
                    }
                    requestAnimationFrame(() => (prevSleep = false));
                  } else {
                    // layout not rendered yet
                    requestAnimationFrame(() => {
                      if (reverse && scrollObserver.takeRecords().length && nextPositionedChild?.isConnected) {
                        const diff = nextPositionedChild.offsetTop - childOffsetBefore;
                        //console.log("infinite scroll updated by animationframe", nextPositionedChild.offsetTop, childOffsetBefore, nextPositionedChild.isConnected);
                        parent.scrollTop += diff;
                      }
                      requestAnimationFrame(() => (prevSleep = false));
                    });
                  }
                });
              }
            });
          };

          const whenNextResult = whenNext();

          if (whenNextResult) {
            whenNextResult.then(afterNext);
          } else {
            afterNext();
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
 * @param {Element} observeElement
 * @param {Function} whenNext
 * @returns IntersectionObserver
 */
export function createReverseScroller(observeElement: Element, whenNext: () => Promise<void>) {
  return createScroller(observeElement, whenNext, true);
}
