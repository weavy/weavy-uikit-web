import { LitElement, html, type PropertyValues, svg } from "lit";
import { customElement } from "../../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import {
  getIconMapping,
  defaultIcon,
  nativeColors,
  getSvgMapping,
  type iconNamesType,
  type svgIconNamesType,
} from "../../utils/icons";
import { toKebabCase } from "../../utils/strings";
import { ifDefined } from "lit/directives/if-defined.js";
import { ShadowPartsController } from "../../controllers/shadow-parts-controller";
import { partMap } from "../../utils/directives/shadow-part-map";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { S4 } from "../../utils/data";

import rebootCss from "../../scss/components/base/reboot.scss";
import iconCss from "../../scss/components/icons.scss";
import hostContentsCss from "../../scss/host-contents.scss";

@customElement("wy-icon")
export default class WyIcon extends LitElement {
  static override styles = [
    rebootCss,
    iconCss,
    hostContentsCss,
  ];

  protected exportParts = new ShadowPartsController(this);

  @property()
  name?: iconNamesType | "";

  @property()
  overlayName?: iconNamesType | "";

  @property()
  svg?: svgIconNamesType | "";

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

  @property({ type: Boolean })
  layer = false;

  @property({ type: Boolean })
  state = false;

  @property({ type: Boolean })
  active = false;

  @state()
  nativeIconColor?: string;

  @state()
  nativeOverlayColor?: string;

  protected uniqueId = `wy-icon-${S4()}`;

  override willUpdate(changedProperties: PropertyValues<this>): void {
    super.willUpdate(changedProperties);
    
    if (changedProperties.has("name") && this.name) {
      this.path = getIconMapping(this.name) || defaultIcon;
      this.overlayPath = getIconMapping(this.overlayName) || this.overlayPath;

      this.nativeIconColor = (this.color === "native" && nativeColors[this.name]) || undefined;
      this.nativeOverlayColor = (this.overlayName && nativeColors[this.overlayName]) || undefined;
    }
  }

  override render() {
    const kind = this.kind ? toKebabCase(this.kind) : this.kind;
    const ext = this.ext?.startsWith(".") ? this.ext.substring(1) : this.ext;

    const iconParts = {
      ["wy-icon"]: true,
      ["wy-icon-current-color"]: Boolean(!kind && !this.color),
      ["wy-kind-" + kind]: Boolean(kind),
      ["wy-ext-" + ext]: Boolean(ext),
      ["wy-icon-color-" + this.color]: Boolean(this.color),
      ["wy-icon-first"]: this.first,
      ["wy-icon-last"]: this.last,
      ["wy-icon-padded"]: this.padded,
      ["wy-icon-inline"]: this.inline,
      ["wy-icon-stack-layer"]: this.layer,
      ["wy-icon-state"]: this.state,
      ["wy-active"]: this.active,
    };

    const hasRemSize = this.size !== 24;
    const remSize = this.size / 16;
    const sizeStyle = hasRemSize
      ? `width: var(--wy-component-icon-width, calc(${remSize} * var(--wy-size, 1rem))); height: var(--wy-component-icon-height, calc(${remSize} * var(--wy-size, 1rem)));`
      : "";

    const svgContent = this.svg && getSvgMapping(this.svg);

    if (this.overlayPath) {
      return [
        html`
          <style>
            .icon-mask-bg {
              width: var(--wy-component-icon-width, calc(${remSize} * var(--wy-size, 1rem)));
              height: var(--wy-component-icon-height, calc(${remSize} * var(--wy-size, 1rem)));
              fill: white;
            }

            .icon-mask {
              width: calc(var(--wy-component-icon-width, calc(${remSize} * var(--wy-size, 1rem))));
              height: calc(var(--wy-component-icon-height, calc(${remSize} * var(--wy-size, 1rem))));
              ry: calc(var(--wy-border-radius-pill, var(--wy-border-radius, 50%)));
              x: calc(var(--wy-component-icon-width, calc(${remSize} * var(--wy-size, 1rem))) / 2);
              y: calc(var(--wy-component-icon-height, calc(${remSize} * var(--wy-size, 1rem))) / 2);
              stroke: black;
              stroke-width: 4px;
              fill: black;
            }
          </style>
        `,
        html`
          <wy-icon-stack style="${sizeStyle}">
            <svg
              part=${partMap(iconParts)}
              viewBox="0 0 24 24"
              width="${this.size}"
              height="${this.size}"
              style="mask-image: url(#${this.uniqueId}-mask); -webkit-mask-image: url(#${this.uniqueId}-mask);"
            >
              <defs>
                <mask id="${this.uniqueId}-mask">
                  <rect class="icon-mask-bg" />
                  <rect class="icon-mask" />
                </mask>
              </defs>
              ${svgContent
                ? unsafeSVG(svgContent)
                : svg`
          <path d="${this.path}" style="fill: ${ifDefined(this.nativeIconColor)}" />
        `}
              <!--rect width="24" height="24" fill="transparent" /-->
            </svg>
            <svg part="wy-icon-stack-overlay" viewBox="0 0 24 24" width="${this.size / 2}" height="${this.size / 2}">
              <path d="${this.overlayPath}" style="fill: ${ifDefined(this.nativeOverlayColor)}" />
              <!--rect width="24" height="24" fill="transparent" /-->
            </svg>
          </wy-icon-stack>
        `,
      ];
    }

    return html`
      <svg
        part=${partMap(iconParts)}
        style="${sizeStyle}"
        viewBox="0 0 24 24"
        width="${this.size}"
        height="${this.size}"
      >
        ${svgContent
          ? unsafeSVG(svgContent)
          : svg`
          <path d="${this.path}" style="fill: ${ifDefined(this.nativeIconColor)}" />
        `}
        <!--rect width="24" height="24" fill="transparent" /-->
      </svg>
    `;
  }
}

@customElement("wy-icon-stack")
export class WyIconStack extends LitElement {
  static override styles = [rebootCss, iconCss];

  protected exportParts = new ShadowPartsController(this);

  protected override render() {
    return html`<slot></slot>`;
  }
}

@customElement("wy-icon-display")
export class WyIconDisplay extends LitElement {
  static override styles = [rebootCss, iconCss];

  protected exportParts = new ShadowPartsController(this);

  protected override render() {
    return html`
      <div part="wy-icon-display-icon">
        <slot></slot>
      </div>
      <div part="wy-icon-display-text">
        <slot name="text"></slot>
      </div>
      <div part="wy-icon-display-meta">
        <slot name="meta"></slot>
      </div>
    `;
  }
}
