import { LitElement, ReactiveController, ReactiveControllerHost } from "lit";
import { isInShadowDom } from "../utils/dom";

/**
 * Sets exportparts and part on the host when in a shadow dom.
 */
export class ShadowPartsController implements ReactiveController {
  host: ReactiveControllerHost & LitElement & Element;
  shadowParts?: Set<string>;
  addLocalName?: boolean;
  additionalTargets: Set<Element> = new Set();

  constructor(host: ReactiveControllerHost & LitElement & Element, addLocalName?: boolean) {
    host.addController(this);
    this.host = host;
    this.addLocalName = addLocalName;
  }

  addPartsFrom(target?: Element) {
    if (target && !this.additionalTargets.has(target)) {
      this.setExportParts([target]);
      this.observer?.observe(target, {
        attributeFilter: ["part", "exportparts"],
      });
      this.additionalTargets.add(target);
    }
  }

  setExportParts = (mutationTargets: Element[]) => {
    if (!this.host.hasAttribute("exportparts") || this.shadowParts) {
      this.shadowParts ??= new Set();

      mutationTargets.forEach((partElement) => {
        partElement.part.forEach((part) => this.shadowParts?.add(part));

        partElement
          .getAttribute("exportparts")
          ?.split(", ")
          .forEach((part) => this.shadowParts?.add(part));
      });

      if (this.shadowParts.size) {
        //console.log("setting exportparts", this.host, this.shadowParts);
        this.host.setAttribute("exportparts", Array.from(this.shadowParts.values()).join(", "));
      }
    }
  };

  observer?: MutationObserver;

  async hostConnected() {
    await this.host.updateComplete;

    if (isInShadowDom(this.host) && this.host.shadowRoot) {
      // Set initial parts
      const mutationTargets: Element[] = Array.from(this.host.shadowRoot.querySelectorAll("[part], [exportparts]"));

      this.setExportParts(mutationTargets);

      // observe changing parts
      this.observer = new MutationObserver((mutationList) => {
        // get attribute target or added nodes
        const mutationTargets: Element[] = mutationList
          .flatMap((mutation) => (mutation.type === "attributes" ? [mutation.target] : Array.from(mutation.addedNodes)))
          .filter((node) => node instanceof Element);

        this.setExportParts(mutationTargets);
      });

      this.observer.observe(this.host.shadowRoot, {
        subtree: true,
        childList: true,
        attributeFilter: ["part", "exportparts"],
      });
      Array.from(this.additionalTargets).forEach((target) => {
        this.observer?.observe(target, {
          attributeFilter: ["part", "exportparts"],
        });
      });
    }
  }

  hostUpdated() {
    if (isInShadowDom(this.host) && this.addLocalName !== false) {
      if (
        !this.host.part.contains(this.host.localName) &&
        (this.addLocalName || getComputedStyle(this.host).display !== "contents")
      ) {
        this.host.part.add(this.host.localName);
      }
    }
  }

  hostDisconnected(): void {
    this.observer?.disconnect();
  }
}
