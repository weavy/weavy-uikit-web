import { html, LitElement, nothing } from "lit";
import { customElement } from "../../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { ShadowPartsController } from "../../controllers/shadow-parts-controller";
import type { BadgeAppearanceType, PositionType } from "../../types/ui.types";
import { partMap } from "../../utils/directives/shadow-part-map";

import badgeCss from "../../scss/components/badge.scss";
import hostContentsCss from "../../scss/host-contents.scss";

declare global {
  interface HTMLElementTagNameMap {
    "wy-badge": WyBadge;
  }
}

/**
 * Small badge component showing a truncated count or dot for any given count.
 *
 * @csspart wy-badge - Root badge container.
 * @csspart wy-badge-reveal - Modifier styles for revealing the badge.
 * @csspart wy-badge-dot - Modifier when dot appearance is used.
 * @csspart wy-badge-positioned - Modifier for using absolute positioning.
 * @csspart wy-badge-top-right - Modifier for positioning in top right corner with `wy-badge-positioned`. 
 * @csspart wy-badge-top-left - Modifier for positioning in top left corner with `wy-badge-positioned`. 
 * @csspart wy-badge-bottom-right - Modifier for positioning in bottom right corner with `wy-badge-positioned`. 
 * @csspart wy-badge-bottom-left - Modifier for positioning in bottom left corner with `wy-badge-positioned`. 
 */
@customElement("wy-badge")
export class WyBadge extends LitElement {
  static override styles = [badgeCss, hostContentsCss];
  protected exportParts = new ShadowPartsController(this);

  /** Display type for the badge  */
  @property({ type: String })
  appearance: BadgeAppearanceType = "count";

  /** Positioning of the badge */
  @property({ type: String })
  position: PositionType = "inline";

  /** Whether to delay showing the badge */
  @property({ type: Boolean })
  reveal: boolean = false;

  /** The number on the badge */
  @property({ type: Number })
  count = NaN;

  /**
   * Limit for truncation. Set to Infinity for no truncation.
   */
  @property({ type: Number })
  limit = 99;

  override render() {
    const truncatedCount = Number.isInteger(this.count)
      ? this.count > this.limit
        ? `${this.limit}+`
        : this.count
      : "";

    const hasPosition = /^(top|bottom)-(right|left)$/.test(this.position)

    const badgeParts = {
      "wy-badge": true,
      "wy-badge-reveal": this.reveal,
      "wy-badge-compact": this.appearance === "compact",
      "wy-badge-dot": this.appearance === "dot",
      "wy-badge-positioned": hasPosition,
      [`wy-badge-${this.position}`]: hasPosition
    };

    return this.appearance !== "none" && truncatedCount
      ? html`<span part=${partMap(badgeParts)} title=${this.count}>${truncatedCount}</span>`
      : nothing;
  }
}
