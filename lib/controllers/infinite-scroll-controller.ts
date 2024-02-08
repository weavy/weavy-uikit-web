import { ReactiveController, ReactiveControllerHost } from "lit";
import { createScroller } from "../utils/infinte-scroll";
import { type InfiniteQueryObserverResult } from "@tanstack/query-core";

export class InfiniteScrollController implements ReactiveController {
  host: ReactiveControllerHost;
  reverse: boolean = false;

  scroller?: IntersectionObserver;

  private isObservePending = false;

  constructor(host: ReactiveControllerHost, reverse: boolean = false) {
    host.addController(this);
    this.host = host;
    this.reverse = reverse;
  }

  observe(infiniteQueryResult?: InfiniteQueryObserverResult, loadMoreRefElement?: Element) {
    if (infiniteQueryResult && loadMoreRefElement) {
      if (!infiniteQueryResult.isLoading && !this.isObservePending) {
        this.isObservePending = true;

        requestAnimationFrame(() => {
          this.scroller?.disconnect();
          this.scroller = createScroller(
            loadMoreRefElement,
            async () => {
              if (infiniteQueryResult.hasNextPage && !infiniteQueryResult.isFetching) {
                //console.log("infinite scroll fetch", { ...infiniteQueryResult});
                await infiniteQueryResult.fetchNextPage({ cancelRefetch: false });

                // Wait for effects and trigger render before resolving
                if (this.reverse) {
                  await this.host.updateComplete;
                  //console.log("infinte scroll fetch done")
                }
              }
            },
            this.reverse
          );

          this.isObservePending = false;
        });
      }
    }
  }

  hostDisconnected() {
    this.scroller?.disconnect();
  }
}

export class ReverseInfiniteScrollController extends InfiniteScrollController {
  constructor(host: ReactiveControllerHost) {
    super(host, true);
  }
}
