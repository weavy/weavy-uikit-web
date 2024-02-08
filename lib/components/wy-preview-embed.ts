import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ref } from "lit/directives/ref.js";
import { localized, msg } from "@lit/localize";
import { ifDefined } from "lit/directives/if-defined.js";

import "./wy-spinner";
import "./wy-preview-icon";

import allCss from "../scss/all.scss";

@customElement("wy-preview-embed")
@localized()
export class WyPreviewEmbed extends LitElement {
  
  static override styles = [
    allCss,
    css`
      :host {
        display: contents;
      }
    `,
  ];

  @property()
  src!: string;

  @property()
  name!: string;

  @property()
  icon!: string;

  @property()
  provider?: string;

  embedElement?: Element;

  unregisterLoading?: () => void;

  registerLoading(embedElement: Element | undefined) {
    this.unregisterLoading?.();

    if (embedElement) {
      this.embedElement = embedElement;

      //console.log("register loading", embedElement);

      embedElement.classList.add("wy-loading");

      const embedFallbackTimeout = window.setTimeout(() => {
        //console.log("fallback");
        embedElement.classList.add("wy-fallback");
      }, 2500);

      const embedLoaded = (event: Event) => {
        const obj = event.target as Element;
        if (obj.tagName === "OBJECT" && obj.classList.contains("wy-loading") && !obj.classList.contains("wy-loaded")) {
          //console.log("loaded");
          obj.classList.add("wy-loaded");
          window.clearTimeout(embedFallbackTimeout);
        }
      };

      embedElement.addEventListener("load", embedLoaded, true); // needs capturing

      this.unregisterLoading = () => {
        // cleanup
        if (this.embedElement) {
          embedElement.removeEventListener("load", embedLoaded, true); // needs capturing
          window.clearTimeout(embedFallbackTimeout);
          this.embedElement = undefined;
        }
      };
    }
  }

  override render() {
    /* iframe needs to be object to not render error pages when content is blocked */
    return html`
      <object title=${msg("Preview")} ${ref(this.registerLoading)} class="wy-content-iframe" data=${this.src}></object>
      <wy-spinner overlay></wy-spinner>
      <wy-preview-icon
        src=${this.src}
        icon=${this.icon}
        provider=${ifDefined(this.provider)}
        class="wy-content-iframe-fallback"></wy-preview-icon>
    `;
  }

  override disconnectedCallback() {
    this.unregisterLoading?.();
    super.disconnectedCallback();
  }
}
