import { LitElement, html, nothing } from "lit";
import { customElement } from "../../utils/decorators/custom-element";
import { partMap } from "../../utils/directives/shadow-part-map";
import { ShadowPartsController } from "../../controllers/shadow-parts-controller";
import { property, queryAssignedElements } from "lit/decorators.js";

import itemCss from "../../scss/components/item.scss";
import textCss from "../../scss/components/text.scss";
import rebootCss from "../../scss/reboot.scss";
import hostContentsCss from "../../scss/host-contents.scss";
import { isModifiedClick } from "../../utils/dom";

declare global {
  interface HTMLElementTagNameMap {
    "wy-item": WyItem;
    "wy-item-list": WyItemList;
  }
}

/**
 * Item with image, content and actions.
 * May be multi-row and interactive.
 *
 * @slot image - The image in the start of the item. Typically an icon or avatar.
 * @slot content - The full content body. Contains `title`, `meta` and `text`.
 * @slot title - Title of the item. Placed in top row in `content`.
 * @slot meta - Meta text for the item. Placed in the end of the top row in. `content`.
 * @slot text - Secondary text. Placed in the bottom row in `content`.
 * @slot actions - Actions. Typically icons, buttons or dropdowns.
 * @csspart wy-item - The component itself.
 * @csspart wy-item-inner - Inner wrapper for the item.
 * @csspart wy-item-inner-no-padding - Inner wrapper without padding.
 * @csspart wy-item-rounded - When the item wrapper is rounded.
 * @csspart wy-item-rounded-outer - When the item wrapper is using outer roundness.
 * @csspart wy-item-interactive - When the item wrapper is using interactive hover states.
 * @csspart wy-item-sm - When the item wrapper is `sm` size.
 * @csspart wy-item-md - When the item wrapper is `md` size.
 * @csspart wy-item-lg - When the  item wrapper id `lg` size.
 * @csspart wy-item-top - When the item wrapper content has `top` alignment.
 * @csspart wy-item-middle - When the item wrapper content has `middle` alignment.
 * @csspart wy-item-bottom - When the item wrapper content has `bottom` alignment.
 * @csspart wy-read - When the item wrapper has `read` status.
 * @csspart wy-unread - When the item wrapper has `unread` status.
 * @csspart wy-selected - When the item wrapper has `selected` state.
 * @csspart wy-disabled - When the item wrapper has `disabled` state.
 * @csspart wy-item-image - The image content section of the item wrapper. Containing the `image` slot.
 * @csspart wy-item-body - The main content section of the item wrapper. Containing the `content` slot.
 * @csspart wy-item-rows - Row layout wrapper of the item body. Contains 1-2 layout rows.
 * @csspart wy-item-row - Layout row in the row layout wrapper.
 * @csspart wy-item-row-first - The first (top-most) layout row.
 * @csspart wy-item-row-second - Any optional second (bottom-most) layout row.
 * @csspart wy-item-title - The title section of the first layout row. Contains the `title` slot.
 * @csspart wy-item-left - Left aligned sections of a layout row.
 * @csspart wy-item-meta - Meta section in the end of the first layout row. Contains the `meta` slot.
 * @csspart wy-meta - Meta styled content in the meta section.
 * @csspart wy-meta-sm - Smaller meta styled content in the meta section.
 * @csspart wy-item-text - Text content section of the second layout row. Contains the `text` slot.
 * @csspart wy-item-text-sm - More compact styling of the text content section used when size is `auto`.
 * @csspart wy-item-actions - Section for any actions. May be after the item body or in the end of the second layout row. Contains the `actions` slot.
 * @csspart wy-item-actions-bottom - The actions section when placed in the second layout row.
 * @csspart wy-item-actions-top - The actions sections whe align is `top`ot action align is `top`.
 */
@customElement("wy-item")
export class WyItem extends LitElement {
  static override styles = [rebootCss, itemCss, textCss];

  protected exportParts = new ShadowPartsController(this);

  /**
   * Size of the item.
   * - `auto` is dynamic height.
   * - `sm` is fixed for 1 line.
   * - `md` is fixed for 1-2 lines.
   * - `lg` is fixed for 2-3 lines.
   */
  @property()
  size: "auto" | "sm" | "md" | "lg" = "auto";

  /**
   * How to align the image/content/actions.
   */
  @property()
  align: "top" | "middle" | "bottom" = "middle";

  /**
   * How to position the actions.
   * - `end` is in the middle end of the item.
   * - `bottom` is in the end of the bottom line.
   * - `top` is in the top end corner.
   */
  @property()
  actionsPosition: "end" | "bottom" | "top" = "end";

  /**
   * Display the item with roundness.
   */
  @property({ type: Boolean, reflect: true })
  rounded: boolean = false;

  /**
   * Display the item without padding.
   */
  @property({ type: Boolean, reflect: true })
  noPadding: boolean = false;

  /**
   * Display the item using outer roundness, when placed as the outermost component.
   */
  @property({ type: Boolean, reflect: true })
  outer: boolean = false;

  /**
   * Add interactive hover states, for use when the item is clickable.
   */
  @property({ type: Boolean, reflect: true })
  interactive: boolean = false;

  /**
   * Set the item in a selected state.
   */
  @property({ type: Boolean, reflect: true })
  selected: boolean = false;

  /**
   * Set the item in a disabled state and prevent interaction.
   */
  @property({ type: Boolean, reflect: true })
  disabled: boolean = false;
  /**
   * Link URL for the item.
   */
  @property({ reflect: true })
  url: string | undefined = undefined;

  /**
   * Display the item in a state indicating that it has been trashed.
   */
  @property({ type: Boolean, reflect: true })
  trashed: boolean = false;

  /**
   * Set the read status of the item.
   */
  @property()
  status?: "read" | "unread";

  /**
   * Any nodes assigned to the `actions` slot.
   * @internal
   */
  @queryAssignedElements({ slot: "actions" })
  private _slotActions!: Array<HTMLElement>;

  /**
   * Any nodes assigned to the `meta` slot.
   * @internal
   */
  @queryAssignedElements({ slot: "meta" })
  private _slotMeta!: Array<HTMLElement>;

  /**
   * Any nodes assigned to the `text` slot.
   * @internal
   */
  @queryAssignedElements({ slot: "text" })
  private _slotText!: Array<HTMLElement>;

  /**
   * If it has an url; handles ctrl click event for the item.
   * @param event MouseEvent
   */
  private handleLinkClick(e: MouseEvent) {
    if (this.disabled) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // check for ctrl, meta or middle click
    if (isModifiedClick(e)) {
      e.stopPropagation();
    }    
  }

  override render() {
    const hasActions = Boolean(this._slotActions.length);
    const hasMeta = Boolean(this._slotMeta.length);
    const hasText = Boolean(this._slotText.length);
    const hasSecondRow = hasText || (this.actionsPosition === "bottom" && hasActions);

    /* Link item */
    return html`
      <div
        part=${partMap({
          "wy-item-rounded": this.rounded,
          "wy-item-rounded-outer": this.outer,
          "wy-item-inner": true,
          "wy-item-inner-no-padding": this.noPadding,
          "wy-item-interactive": this.interactive,
          "wy-item-sm": this.size === "sm",
          "wy-item-md": this.size === "md",
          "wy-item-lg": this.size === "lg",
          "wy-item-top": this.align === "top",
          "wy-item-middle": this.align === "middle",
          "wy-item-bottom": this.align === "bottom",
          "wy-read": this.status === "read",
          "wy-unread": this.status === "unread",
          "wy-selected": this.selected,
          "wy-disabled": this.disabled,
        })}
      >
        <div part="wy-item-image"><slot name="image"></slot></div>
        <div part="wy-item-body">
          <slot name="content">
            <div part="wy-item-rows">
              <div part="wy-item-row wy-item-row-first">
                <div part="wy-item-title wy-item-left">
                  ${this.url
                    ? html`<a href=${this.url} @click=${(e: MouseEvent) => this.handleLinkClick(e)}><slot name="title"></slot></a>`
                    : html`<slot name="title"></slot>`}
                </div>
                <div part="wy-item-meta wy-meta wy-meta-sm" ?hidden=${!hasMeta}
                  ><slot name="meta" @slotchange=${() => this.requestUpdate()}></slot
                ></div>
              </div>
              <div part="wy-item-row wy-item-row-second" ?hidden=${!hasSecondRow}>
                <div part="wy-item-text wy-item-left ${partMap({ "wy-item-text-sm": this.size === "auto" })}"
                  ><slot name="text" @slotchange=${() => this.requestUpdate()}></slot
                ></div>
                ${this.actionsPosition === "bottom"
                  ? html`
                      <div part="wy-item-actions wy-item-actions-bottom"
                        ><slot name="actions" @slotchange=${() => this.requestUpdate()}></slot
                      ></div>
                    `
                  : nothing}
              </div>
            </div>
          </slot>
        </div>
        ${this.actionsPosition !== "bottom"
          ? html`
              <div
                part="wy-item-actions ${partMap({
                  "wy-item-actions-top": this.align === "top" || this.actionsPosition === "top",
                })}"
                ?hidden=${!hasActions}
                ><slot name="actions" @slotchange=${() => this.requestUpdate()}></slot
              ></div>
            `
          : nothing}
      </div>
    `;
  }
}

/**
 * Item list. Provides list layout and styling for items.
 *
 * @slot - Default slot for items.
 * @csspart wy-item-list - Regular item list.
 * @csspart wy-item-list-bordered - Border styling.
 * @csspart wy-item-list-rounded - Rounded styling.
 * @csspart wy-item-list-outer - Using outer rounded styling.
 * @csspart wy-item-list-filled - Using filled background.
 */
@customElement("wy-item-list")
export class WyItemList extends LitElement {
  static override styles = [itemCss, hostContentsCss];

  protected exportParts = new ShadowPartsController(this);

  /**
   * Add outer roundness to the list when the component is placed as outermost component.
   */
  @property({ type: Boolean })
  outer = false;

  /**
   * Add border to the list.
   */
  @property({ type: Boolean })
  bordered = false;

  /**
   * Add roundness to the list.
   */
  @property({ type: Boolean })
  rounded = false;

  /**
   * Filled background.
   */
  @property({ type: Boolean })
  filled = false;

  protected override render() {
    const itemListParts = {
      "wy-item-list": true,
      "wy-item-list-bordered": this.bordered,
      "wy-item-list-rounded": this.rounded,
      "wy-item-list-outer": this.outer,
      "wy-item-list-filled": this.filled,
    };
    return html`<div part=${partMap(itemListParts)}><slot></slot></div>`;
  }
}
