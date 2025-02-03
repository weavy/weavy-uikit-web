import { LitElement, css, html } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { ifDefined } from "lit/directives/if-defined.js";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { partMap } from "../utils/directives/shadow-part-map";

import rebootCss from "../scss/components/base/reboot.scss";
import buttonCss from "../scss/components/button.scss";
import tabCss from "../scss/components/tab.scss";

@customElement("wy-button")
export default class WyButton extends LitElement {
  static override styles = [
    rebootCss,
    buttonCss,
    tabCss,
    css`
      :host {
        display: contents;
        position: relative;
      }
    `,
  ];

  protected exportParts = new ShadowPartsController(this, false);

  @property()
  type?: "submit" | "reset";

  @property()
  kind?: "filled" | "inline" | "icon" | "icon-inline" | "link" | "tab" = "filled";

  @property({ type: Boolean })
  active?: boolean = false;

  @property()
  color?: "primary" | "variant" | "primary-text" | "inherit" | "none";

  @property({ type: Boolean })
  small?: boolean = false;

  @property({ type: Boolean, reflect: true })
  disabled?: boolean = false;

  override render() {
    const buttonParts = {
      "wy-button": true,
      "wy-active": Boolean(this.active),
      "wy-disabled": Boolean(this.disabled),
      "wy-button-inline": this.kind === "inline",
      "wy-button-icon": this.kind === "icon",
      "wy-button-icon-inline": this.kind === "icon-inline",
      "wy-button-link": this.kind === "link",
      "wy-button-primary": this.color === "primary",
      "wy-button-primary-text": this.color === "primary-text",
      "wy-button-inherit-color": this.color === "inherit",
      "wy-button-no-color": this.color === "none",
      "wy-button-variant": this.color === "variant",
      "wy-button-type-submit": this.type === "submit",
      "wy-button-type-reset": this.type === "reset",
      "wy-button-state-layer": this.kind !== "link" && !this.disabled,
      "wy-button-sm": Boolean(this.small),
      "wy-tab": this.kind === "tab",
      "wy-tab-sm": this.kind === "tab" && Boolean(this.small),
    };

    return html`
      <button part=${partMap(buttonParts)} type=${ifDefined(this.type)} ?disabled=${this.disabled}>
        <slot></slot>
      </button>
    `;
  }
}

@customElement("wy-buttons")
export class WyButtons extends LitElement {
  static override styles = [
    rebootCss,
    buttonCss,
    tabCss,
    css`
      :host {
        display: contents;
      }
    `,
  ];

  protected exportParts = new ShadowPartsController(this);

  @property({ type: Boolean })
  tabs = false;

  @property({ type: Boolean })
  floating = false;

  @property({ type: Boolean })
  reverse = false;

  protected override render() {
    const buttonsParts = {
      "wy-buttons": !this.tabs,
      "wy-buttons-reverse": this.reverse,
      "wy-tabs": this.tabs,
      "wy-buttons-floating": this.floating
    };
    return html`<div part=${partMap(buttonsParts)}><slot></slot></div>`;
  }
}
