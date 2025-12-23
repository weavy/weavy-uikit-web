import { html, LitElement } from "lit";
import { customElement } from "../../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { ShadowPartsController } from "../../controllers/shadow-parts-controller";
import { partMap } from "../../utils/directives/shadow-part-map";

import containerCss from "../../scss/components/container.scss";
import scrollCss from "../../scss/scroll.scss";
import hostContentsCss from "../../scss/host-contents.scss";

declare global {
  interface HTMLElementTagNameMap {
    "wy-container": WyContainer;
  }
}

/**
 * Container for content.
 * 
 * Can have positioning, scrolling and padding.
 *
 * @slot - Content.
 * 
 * @csspart wy-container - Content wrapper with flex and positioning.
 * @csspart wy-container-padded - Padded content.
 * @csspart wy-container-outer - Using outer styling.
 * @csspart wy-scroll-x - Horizontally scrollable content.
 * @csspart wy-scroll-y - Vertically scrollable content.
 * @csspart wy-scroll-x-y - Both horizontally and vertically scrollable content.
 * @csspart wy-scroll-x-always - Modifier for always showing horizontal scrollbar.
 * @csspart wy-scroll-y-always - Modifier for always showing vertical scrollbar.
 */
@customElement("wy-container")
export class WyContainer extends LitElement {
  static override styles = [scrollCss, hostContentsCss, containerCss];
  protected exportParts = new ShadowPartsController(this);

  /** Whether to scroll horizontally */
  @property({ type: Boolean })
  scrollX: boolean = false;

  /** Whether to scroll vertically */
  @property({ type: Boolean })
  scrollY: boolean = false;

  /** Add padding in the area */
  @property({ type: Boolean })
  padded: boolean = false;

  /** Add outer padding in the area */
  @property({ type: Boolean })
  outer: boolean = false;

  /** Always show scrollbars when scroll is enabled */
  @property({ type: Boolean })
  scrollbars: boolean = false;

  override render() {
    const containerParts = {
      "wy-container": true,
      "wy-container-padded": this.padded,
      "wy-container-outer": this.outer,
      "wy-scroll-x": this.scrollX && !this.scrollY,
      "wy-scroll-y": this.scrollY && !this.scrollX,
      "wy-scroll-x-y": this.scrollX && this.scrollY,
      "wy-scroll-x-always": this.scrollbars && this.scrollX,
      "wy-scroll-y-always": this.scrollbars && this.scrollY,
    };

    return html`
      <div part=${partMap(containerParts)}>
        <slot></slot>
      </div>
    `;
  }
}
