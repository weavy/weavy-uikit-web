import allStyles from "../scss/all.scss";

import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { ifDefined } from "lit/directives/if-defined.js";

@customElement("wy-button")
export default class WyButton extends LitElement {
  static override styles = [
    allStyles,
    css`
      /*:host {
         display: contents 
      }*/
    `,
  ];

  @property()
  type?: "submit" | "reset";

  @property()
  kind?: "filled" | "inline" | "icon" | "icon-inline" | "link" = "filled";

  @property({ type: Boolean })
  active?: boolean = false;

  @property({ type: String })
  buttonClass?: string = "";

  @property({ type: Boolean, reflect: true })
  disabled?: boolean = false;

  override render() {
    const buttonClassNames = {
      [this.buttonClass?.toString() || '']: true,
      "wy-active": Boolean(this.active),
      "wy-button-inline": this.kind === "inline",
      "wy-button-icon": Boolean(this.kind?.startsWith("icon")),
      "wy-button-icon-inline": this.kind === "icon-inline",
      "wy-button-link": this.kind === "link",
    };

    return html`
      <button
        class="wy-button ${classMap(buttonClassNames)}"
        type=${ifDefined(this.type)}
        ?disabled=${this.disabled}>
        <slot></slot>
      </button>
    `;
  }
}
