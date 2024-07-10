import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Presence, type PresenceType } from "../types/presence.types";
import { partMap } from "../utils/directives/shadow-part-map";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";

import rebootCss from "../scss/wrappers/base/reboot";
import presenceCss from "../scss/wrappers/presence";

@customElement("wy-presence")
export default class WyPresence extends LitElement {
  static override styles = [
    rebootCss,
    presenceCss,
    css`
      :host {
        display: contents;
      }
    `,
  ];

  protected exportParts = new ShadowPartsController(this);

  @property()
  placement: "avatar" | "text" = "avatar";

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
