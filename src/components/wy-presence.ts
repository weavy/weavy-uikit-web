import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import chatCss from "../scss/all.scss";
import { Presence, type PresenceType } from "../types/presence.types";

@customElement("wy-presence")
export default class WyPresence extends LitElement {
  
  static override styles = [
    chatCss,
    css`
      :host {
        display: contents;
      }
    `,
  ];

  @property()
  placement: "avatar" | "text" = "avatar";

  @property()
  status?: PresenceType;

  override render() {
    const presenceClasses = {
      "wy-presence": true,
      "wy-presence-active": this.status === Presence.Active,
      "wy-presence-in-text": this.placement === "text",
    };

    return html` <span class=${classMap(presenceClasses)} data-presence-id=${this.id}></span> `;
  }
}
