import { LitElement, css, html } from "lit";
import { customElement } from "../../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { ifDefined } from "lit/directives/if-defined.js";
import { ShadowPartsController } from "../../controllers/shadow-parts-controller";
import { partMap } from "../../utils/directives/shadow-part-map";

import rebootCss from "../../scss/reboot.scss";
import buttonCss from "../../scss/components/button.scss";
import tabCss from "../../scss/components/tab.scss";
import hostContentsCss from "../../scss/host-contents.scss";

declare global {
  interface HTMLElementTagNameMap {
    'wy-button': WyButton;
    'wy-buttons': WyButtons;
  }
}

/**
 * Button component. Handles both slotted icon and text children. Can be configured with various appearances. 
 * 
 * @slot - Default slot for icons and text.
 * @csspart wy-button
 * @csspart wy-active - When `active` state.
 * @csspart wy-disabled - When `disabled` state.
 * @csspart wy-button-inline - When `kind` is `inline`.
 * @csspart wy-button-icon - When `kind` is `icon`.
 * @csspart wy-button-icon-inline - When `kind` is `icon-inline`.
 * @csspart wy-button-link - When `kind` is `link`.
 * @csspart wy-button-primary - when `color` is `primary`.
 * @csspart wy-button-primary-text - When `color` is `primary-text`.
 * @csspart wy-button-inherit-color - When `color` is `inherit`.
 * @csspart wy-button-no-color - When `color` is `none`.
 * @csspart wy-button-variant - When `color` is `variant`.
 * @csspart wy-button-type-submit - When `type` is `submit`.
 * @csspart wy-button-type-reset" - When `type` is `reset`.
 * @csspart wy-button-state-layer - When the button has a state layer.
 * @csspart wy-button-sm - When the button is small.
 * @csspart wy-tab - When `kind` is `tab`.
 * @csspart wy-tab-sm - When `kind` is `tab` and button is small,
 */
@customElement("wy-button")
export class WyButton extends LitElement {
  static override styles = [
    rebootCss,
    buttonCss,
    tabCss,
    hostContentsCss,
    css`
      :host {
        position: relative;
      }
    `,
  ];

  protected exportParts = new ShadowPartsController(this, false);

  /**
   * Optional type role for use in forms.
   */
  @property()
  type?: "submit" | "reset";

  /**
   * Button kind which sets the appearance.
   */
  @property()
  kind?: "filled" | "inline" | "icon" | "icon-inline" | "link" | "tab" = "filled";

  /**
   * Sets active state of the button.
   */
  @property({ type: Boolean })
  active?: boolean = false;

  /**
   * Color token name.
   */
  @property()
  color?: "primary" | "variant" | "primary-text" | "inherit" | "none";

  /**
   * Smaller size button.
   */
  @property({ type: Boolean })
  small?: boolean = false;

  /**
   * Sets disabled state of the button.
   */
  @property({ type: Boolean, reflect: true })
  disabled?: boolean = false;

  /**
   * Optional href attribute to render the button using `<a>`.
   */
  @property()
  href?: string;

  /**
   * Optional target window when using the `href` attribute.
   */
  @property()
  target?: string;

  /**
   * Optional download attribute when using the `href` attribute.
   */
  @property()
  download?: string;

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

    return this.href ? html`
      <a href=${this.href} target=${ifDefined(this.target)} download=${ifDefined(this.download)} part=${partMap(buttonParts)} aria-disabled=${this.disabled ? "true" : "false"}>
        <slot></slot>
      </a>
    `: html`
      <button part=${partMap(buttonParts)} type=${ifDefined(this.type)} ?disabled=${this.disabled} aria-disabled=${this.disabled ? "true" : "false"}>
        <slot></slot>
      </button>
    `;
  }
}

/**
 * Button group. Provides layout and styling.
 * 
 * @slot - Default slot for buttons.
 * @csspart wy-buttons - Regular button group
 * @csspart wy-buttons-reverse - When button order is reversed.
 * @csspart wy-tabs - Tab style button group.
 * @csspart wy-buttons-floating - Floating positioning of the group.
 * @csspart wy-buttons-sticky - Sticky positioning of the group.
 */
@customElement("wy-buttons")
export class WyButtons extends LitElement {
  static override styles = [
    rebootCss,
    buttonCss,
    tabCss,
    hostContentsCss,
  ];

  protected exportParts = new ShadowPartsController(this);

  /**
   * Display the buttons as tabs.
   */
  @property({ type: Boolean })
  tabs = false;

  /**
   * Button group positioning.
   */
  @property({ type: String })
  position: "normal" | "floating" | "sticky" = "normal";

  /**
   * Reverse the order of the buttons.
   */
  @property({ type: Boolean })
  reverse = false;

  protected override render() {
    const buttonsParts = {
      "wy-buttons": !this.tabs,
      "wy-buttons-reverse": this.reverse,
      "wy-tabs": this.tabs,
      "wy-buttons-floating": this.position === "floating",
      "wy-buttons-sticky": this.position === "sticky"
    };
    return html`<div part=${partMap(buttonsParts)}><slot></slot></div>`;
  }
}
