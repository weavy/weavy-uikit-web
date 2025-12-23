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
import type { FileKindType } from "../../types/files.types";

import rebootCss from "../../scss/reboot.scss";
import iconCss from "../../scss/components/icons.scss";
import hostContentsCss from "../../scss/host-contents.scss";

declare global {
  interface HTMLElementTagNameMap {
    "wy-icon": WyIcon;
    "wy-icon-stack": WyIconStack;
    "wy-icon-display": WyIconDisplay;
  }
}

/**
 * Icon provider with optional overlay icon.
 *
 * **Used sub components**
 *
 * - [`<wy-icon-stack>`](./wy-icon.ts)
 *
 * @slot - Any content to display within the icon area.
 *
 * @csspart wy-icon-wrapper - Wrapper around the icon.
 * @csspart wy-icon - SVG icon.
 * @csspart wy-icon-current-color - When using inherited color for fill.
 * @csspart wy-kind-{kind} - Dynamic part set when using `kind` property.
 * @csspart wy-ext-{ext} - Dynamic part set when using `ext` property.
 * @csspart wy-icon-color-{color} - Dynamic part set when using `color` property.
 * @csspart wy-icon-first - When defined as `first`.
 * @csspart wy-icon-last - When defined as `last`.
 * @csspart wy-icon-inline - When defined as `inline`.
 * @csspart wy-icon-stack-layer - When defined with `layer`.
 * @csspart wy-icon-state - When defined with `state`.
 * @csspart wy-active - When defined as active.
 */
@customElement("wy-icon")
export class WyIcon extends LitElement {
  static override styles = [rebootCss, iconCss, hostContentsCss];

  protected exportParts = new ShadowPartsController(this);

  /**
   * Name of the predefined icon to use.
   */
  @property()
  name?: iconNamesType | "";

  /**
   * Name of any overlay icon to use.
   */
  @property()
  overlayName?: iconNamesType | "";

  /**
   * Name of an predefined SVG icon to use.
   */
  @property()
  svg?: svgIconNamesType | "";

  /**
   * Color token name.
   * Set to `native` to use original colors in SVG icons.
   */
  @property()
  color: string = "";

  /**
   * The size of the icon in pixels. The pixels are translated to rem size with a base of 16px/rem.
   */
  @property({ type: Number })
  size: number = 24;

  /**
   * Kind of icon or file type.
   */
  @property()
  kind?: FileKindType | "text-icon";

  /**
   * Any file extension. Sets what color to use for some extensions.
   */
  @property()
  ext?: string;

  /**
   * Path string to use in SVG representation. Automatically set when using `name` property.
   */
  @property({ attribute: false })
  path: string = defaultIcon;

  /**
   * Overlay path string to use in SVG representation. Automatically set when using `overlayName` property.
   */
  @property({ attribute: false })
  overlayPath?: string;

  /**
   * Adjust rendering to fit in inline layout.
   */
  @property({ type: Boolean })
  inline: boolean = false;

  /**
   * Adjust rendering to fit when placed first.
   */
  @property({ type: Boolean })
  first: boolean = false;

  /**
   * Adjust rendering to fit when placed last.
   */
  @property({ type: Boolean })
  last: boolean = false;

  /**
   * Adjust rendering so that the icon is placed in an overlaying layer.
   */
  @property({ type: Boolean })
  layer = false;

  /**
   * Make the icon have a visible state that can be toggled by setting the `active` property.
   */
  @property({ type: Boolean })
  state = false;

  /**
   * Active state of the icon. Makes the icon visible when state mode is enabled.
   */
  @property({ type: Boolean })
  active = false;

  /**
   * Resolved CSS color when using `color=native`.
   * @internal
   */
  @state()
  nativeIconColor?: string;

  /**
   * Resolved overlay CSS color when using `overlayName`.
   * @internal
   */
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

    const wrapperParts = {
      ["wy-icon-wrapper"]: true,
      ["wy-icon-stack-layer"]: this.layer,
    };

    const iconParts = {
      ["wy-icon"]: true,
      ["wy-icon-current-color"]: Boolean(!kind && !this.color),
      ["wy-kind-" + kind]: Boolean(kind),
      ["wy-ext-" + ext]: Boolean(ext),
      ["wy-icon-color-" + this.color]: Boolean(this.color),
      ["wy-icon-first"]: this.first,
      ["wy-icon-last"]: this.last,
      ["wy-icon-inline"]: this.inline,
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
          <div part=${partMap(wrapperParts)}>
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
            <slot></slot>
          </div>
        `,
      ];
    }

    return html`
      <div part=${partMap(wrapperParts)}>
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
        <slot></slot>
      </div>
    `;
  }
}

/**
 * Set of stacked icons. Used for state icons or overlayed icons.
 *
 * @slot - Any icons to stack.
 */
@customElement("wy-icon-stack")
export class WyIconStack extends LitElement {
  static override styles = [rebootCss, iconCss];

  protected exportParts = new ShadowPartsController(this);

  protected override render() {
    return html`<slot></slot>`;
  }
}

/**
 * Displays a large icon with optional text and meta content.
 *
 * @slot - The icon to display.
 * @slot text - Any text to display.
 * @slot meta - Any meta content to display.
 * @csspart wy-icon-display - The icon container.
 * @csspart wy-icon-display-icon - The icon.
 * @csspart wy-icon-display-text - Any text.
 * @csspart wy-icon-display-meta - Any meta content.
 */
@customElement("wy-icon-display")
export class WyIconDisplay extends LitElement {
  static override styles = [rebootCss, iconCss, hostContentsCss];

  protected exportParts = new ShadowPartsController(this);

  /**
   * Fills the flex area.
   */
  @property({ type: Boolean })
  fill: boolean = false;

  protected override render() {
    return html`
      <div part="wy-icon-display ${partMap({ "wy-icon-display-fill": this.fill })}">
        <div part="wy-icon-display-icon">
          <slot></slot>
        </div>
        <div part="wy-icon-display-text">
          <slot name="text"></slot>
        </div>
        <div part="wy-icon-display-meta">
          <slot name="meta"></slot>
        </div>
      </div>
    `;
  }
}
