import { LitElement, html } from "lit";
import { customElement } from "../../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { Presence, type PresenceType } from "../../types/presence.types";
import { partMap } from "../../utils/directives/shadow-part-map";
import { ShadowPartsController } from "../../controllers/shadow-parts-controller";

import rebootCss from "../../scss/reboot.scss";
import presenceCss from "../../scss/components/presence.scss";
import hostContentsCss from "../../scss/host-contents.scss";

declare global {
  interface HTMLElementTagNameMap {
    "wy-presence": WyPresence;
  }
}

/**
 * Presence indicator for avatars or text.
 * 
 * @csspart wy-presence
 * @csspart wy-presence-active - When presence status is `active`.
 * @csspart wy-presence-in-text - When placement is in text.
 */
@customElement("wy-presence")
export class WyPresence extends LitElement {
  static override styles = [
    rebootCss,
    presenceCss,
    hostContentsCss,
  ];

  protected exportParts = new ShadowPartsController(this);

  /**
   * Where the indicator should be placed relative to.
   */
  @property()
  placement: "avatar" | "text" = "avatar";

  /**
   * Sets the current status of the presence indicator.
   */
  @property()
  status?: PresenceType;

  override render() {
    const presenceParts = {
      "wy-presence": true,
      "wy-presence-active": this.status === Presence.Active,
      "wy-presence-in-text": this.placement === "text",
    };

    return html` <span part=${partMap(presenceParts)} data-presence-id=${this.id}></span> `;
  }
}
