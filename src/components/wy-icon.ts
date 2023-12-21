import { LitElement, html, type PropertyValues, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { getIconName, getIconMapping, defaultIcon, nativeColors } from "../utils/icons";
import { classMap } from "lit/directives/class-map.js";
import { toKebabCase } from "../utils/strings";
import { ifDefined } from "lit/directives/if-defined.js";

import allStyles from "../scss/all.scss";

@customElement("wy-icon")
export default class WyIcon extends LitElement {
  
  static override styles = [
    allStyles,
    css`
      :host {
        display: contents;
      }
    `,
  ];

  @property()
  name?: string;

  @property()
  color: string = "";

  @property({ type: Number })
  size: number = 24;

  @property()
  kind?: string;

  @property()
  ext?: string;

  @property({ attribute: false })
  path: string = defaultIcon;

  @property({ attribute: false })
  overlayPath?: string;

  @property({ type: Boolean })
  inline: boolean = false;

  @property({ type: Boolean })
  first: boolean = false;

  @property({ type: Boolean })
  last: boolean = false;

  @property({ type: Boolean })
  padded: boolean = false;

  @state()
  nativeIconColor?: string;

  @state()
  nativeOverlayColor?: string;

  override willUpdate(changedProperties: PropertyValues<this>) {
    if (changedProperties.has("name") && this.name) {
      const [iconName, overlayName] = getIconName(this.name);
      this.path = getIconMapping(iconName) || defaultIcon;
      this.overlayPath = getIconMapping(overlayName) || this.overlayPath;

      this.nativeIconColor = this.color === "native" && nativeColors[iconName] || undefined;
      this.nativeOverlayColor = overlayName && nativeColors[overlayName] || undefined;  
    }
  }

  override render() {
    const kind = this.kind ? toKebabCase(this.kind) : this.kind;
    const ext = this.ext?.startsWith(".") ? this.ext.substring(1) : this.ext;

    const iconClasses = {
      ["wy-kind-" + kind]: Boolean(kind),
      ["wy-ext-" + ext]: Boolean(ext),
      ["wy-icon-color-" + this.color]: Boolean(this.color),
      ["wy-icon-first"]: this.first,
      ["wy-icon-last"]: this.last,
      ["wy-icon-padded"]: this.padded,
      ["wy-icon-inline"]: this.inline,
    };

    if (this.overlayPath) {
      const remSize = this.size / 16;
      const sizeStyle = remSize ? `width: var(--wy-component-icon-width, ${remSize}rem); height: var(--wy-component-icon-height, ${remSize}rem);` : "";

      return html`
        <span class="wy-icon-stack" style="${sizeStyle}">
          <svg class="wy-icon ${classMap(iconClasses)}" viewBox="0 0 24 24" width="${this.size}" height="${this.size}">
            <path d="${this.path}" style="fill: ${ifDefined(this.nativeIconColor)}" />
            <!--rect width="24" height="24" fill="transparent" /-->
          </svg>
          <svg viewBox="0 0 24 24" width="${this.size/2}" height="${this.size/2}">
            <path d="${this.overlayPath}" style="fill: ${ifDefined(this.nativeOverlayColor)}" />
            <!--rect width="24" height="24" fill="transparent" /-->
          </svg>
        </span>
      `;
    }

    return html`
      <svg class="wy-icon ${classMap(iconClasses)}" viewBox="0 0 24 24" width="${this.size}" height="${this.size}">
        <path d="${this.path}" style="fill: ${ifDefined(this.nativeIconColor)}" />
        <!--rect width="24" height="24" fill="transparent" /-->
      </svg>
    `;
  }
}
