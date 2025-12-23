import { LitElement, html } from "lit";
import { customElement } from "../../utils/decorators/custom-element";
import { ShadowPartsController } from "../../controllers/shadow-parts-controller";
import { partMap } from "../../utils/directives/shadow-part-map";
import { property } from "lit/decorators.js";

import headerCss from "../../scss/components/header.scss";
import titlebarCss from "../../scss/components/titlebar.scss";
import hostContentsCss from "../../scss/host-contents.scss";

declare global {
  interface HTMLElementTagNameMap {
    "wy-titlebar": WyTitlebar;
    "wy-titlebar-text": WyTitlebarText;
  }
}

/**
 * Header title bar for dialogs.
 *
 * @slot first - The first section, which contains `icon`.
 * @slot middle - The middle section, which contains `title`.
 * @slot last - The last section, which contains `actions`.
 * @slot icon - Icon, avatar or button in the `first` section.
 * @slot title-section - Title in the `middle` section.
 * @slot title - Text in the `title`.
 * @slot actions - Action buttons in the `last`section.
 *
 * @csspart wy-titlebar - Wrapper for the titlebar.
 * @csspart wy-titlebar-lg - Wrapper when size is `lg`.
 * @csspart wy-titlebar-icon - The icon in the first section.
 * @csspart wy-titlebar-title - The title text in the middle section.
 * @csspart wy-titlebar-actions - The actions in the last section.
 * @csspart wy-titlebar-section - Normal section; the middle section.
 * @csspart wy-titlebar-buttons - Sections with buttons; the icon section and the actions section.
 * @csspart wy-titlebar-buttons-first - Button section placed in the first section.
 * @csspart wy-titlebar-buttons-last - Button section placed in the last section.
 * @csspart wy-header - Outer wrapper when titlebar is defined as header.
 * @csspart wy-header-floating - Applies floating positioning to wy-header.
 * @csspart wy-header-outer - Applies outer paddings for wy-header.
 */
@customElement("wy-titlebar")
export class WyTitlebar extends LitElement {
  static override styles = [headerCss, titlebarCss, hostContentsCss];

  protected exportParts = new ShadowPartsController(this);

  /**
   * Whether the titlebar is wrapped in a header.
   */
  @property({ type: Boolean })
  header: boolean = false;

  /** Whether the wrapped header titlebar is floating. */
  @property({ type: Boolean })
  floating: boolean = false;

  /** Whether the wrapped header titlebar should be treated with outer padding and outer border radius. */
  @property({ type: Boolean })
  outer: boolean = false;

  /**
   * Use trashed visual style for the titlebar text.
   */
  @property({ type: Boolean })
  trashed: boolean = false;

  /**
   * Size of the titlebar. Defaults to `md`.
   */
  @property()
  size: "md" | "lg" = "md";

  /**
   * render function for the inner titlebar.
   * @internal
   * @returns
   */
  renderTitlebar() {
    return html`
      <nav part="wy-titlebar ${partMap({ "wy-titlebar-lg": this.size === "lg" })}">
        <slot name="first">
          <div part="wy-titlebar-icon wy-titlebar-buttons wy-titlebar-buttons-first">
            <slot name="icon"></slot>
          </div>
        </slot>
        <slot name="middle">
          <div part="wy-titlebar-title wy-titlebar-section">
            <slot name="title-section">
              <wy-titlebar-text ?trashed=${this.trashed}><slot name="title"></slot></wy-titlebar-text>
            </slot>
          </div>
        </slot>
        <slot name="last">
          <div part="wy-titlebar-actions wy-titlebar-buttons wy-titlebar-buttons-last">
            <slot name="actions"></slot>
          </div>
        </slot>
      </nav>
    `;
  }

  override render() {
    return this.header
      ? html`<header part="wy-header ${partMap({ "wy-header-floating": this.floating, "wy-header-outer": this.outer })}"
          >${this.renderTitlebar()}</header
        >`
      : this.renderTitlebar();
  }
}

/**
 * Title text for title bar.
 *
 * @slot - Text for the title.
 *
 * @csspart wy-titlebar-text - Truncated title text.
 * @csspart wy-titlebar-text-trashed - State text style when title is trashed.
 */
@customElement("wy-titlebar-text")
export class WyTitlebarText extends LitElement {
  static override styles = [titlebarCss, hostContentsCss];

  protected exportParts = new ShadowPartsController(this);

  @property({ type: Boolean })
  trashed: boolean = false;

  override render() {
    const headerTextParts = {
      "wy-titlebar-text-trashed": this.trashed,
    };

    return html` <slot part="wy-titlebar-text ${partMap(headerTextParts)}"></slot> `;
  }
}
