import { ReactiveController, ReactiveControllerHost } from "lit";

export class SwipeScrollController implements ReactiveController {
  host: ReactiveControllerHost;

  delay: number = NaN;

  private sleep = false;
  scrollObserver?: IntersectionObserver;

  swipeElement?: Element;

  prevElement?: Element;
  nextElement?: Element;

  whenPrev?: () => Promise<void>;
  whenNext?: () => Promise<void>;

  constructor(host: ReactiveControllerHost) {
    host.addController(this);
    this.host = host;
  }

  createObserver(swipeElement: Element) {
    this.scrollObserver?.disconnect();
    this.swipeElement = swipeElement;

    this.scrollObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(async (entry) => {
          if (entry.isIntersecting && !this.sleep) {
            /*console.log(
                            'intersect',
                            entry.intersectionRatio,
                            Boolean(entry.target === this.prevElement && this.whenPrev),
                            Boolean(entry.target === this.nextElement && this.whenNext)
                        )*/

            if (entry.intersectionRatio >= 1) {
              this.sleep = true;

              if (!Number.isNaN(this.delay)) {
                await new Promise((r) => {
                  setTimeout(r, this.delay);
                });
              }

              if (entry.target === this.prevElement && this.whenPrev) {
                await this.whenPrev();
              }

              if (entry.target === this.nextElement && this.whenNext) {
                await this.whenNext();
              }

              await this.host.updateComplete;
            }
          }
        });
      },
      { root: swipeElement, threshold: 1, rootMargin: "0px" }
    );
  }

  observe(prevElement?: Element, nextElement?: Element) {
    if (this.prevElement) {
      this.scrollObserver?.unobserve(this.prevElement);
      this.prevElement = undefined;
    }

    if (this.nextElement) {
      this.scrollObserver?.unobserve(this.nextElement);
      this.nextElement = undefined;
    }

    if (prevElement) {
      this.scrollObserver?.observe(prevElement);
      this.prevElement = prevElement;
    }

    if (nextElement) {
      this.scrollObserver?.observe(nextElement);
      this.nextElement = nextElement;
    }

    this.sleep = false;
  }

  clearObserver() {
    this.prevElement = undefined;
    this.nextElement = undefined;
    this.scrollObserver?.disconnect();
    this.sleep = false;
  }

  hostDisconnected() {
    this.clearObserver();
  }
}
