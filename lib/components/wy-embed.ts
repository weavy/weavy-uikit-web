import { LitElement, PropertyValues, html, nothing } from "lit";
import { property } from "lit/decorators.js";
import { ifDefined } from "lit/directives/if-defined.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import type { EmbedType } from "../types/embeds.types";
import { customElement } from "../utils/decorators/custom-element";
import { EmbedRemoveEventType, EmbedSwapEventType } from "../types/embeds.events";
import { NamedEvent } from "../types/generic.types";
import { partMap } from "../utils/directives/shadow-part-map";
import { repeat } from "lit/directives/repeat.js";
import { openUrl } from "../utils/urls";
import { WyActionEventDetailType, WyActionEventType } from "../types/action.events";
import { ActionType } from "../types/action.types";
import { clickOnEnterAndConsumeOnSpace, clickOnSpace } from "../utils/keyboard";
import { createRef, ref, Ref } from "lit/directives/ref.js";

import embedCss from "../scss/components/embed.scss";
import hostContentsCss from "../scss/host-contents.scss";

import "./ui/wy-dropdown";
import "./ui/wy-button";
import "./ui/wy-icon";
import "./ui/wy-item";

declare global {
  interface HTMLElementTagNameMap {
    "wy-embed": WyEmbed;
    "wy-embed-select": WyEmbedSelect;
  }
}

/**
 * Embed card for displaying external content (photo, video, link, rich).
 *
 * **Used sub components:**
 *
 * - [`<wy-item>`](./ui/wy-item.ts)
 * - [`<wy-button>`](./ui/wy-button.ts)
 * - [`<wy-icon>`](./ui/wy-icon.ts)
 * - [`<wy-dropdown>`](./ui/wy-dropdown.ts)
 *
 * @slot before - Slot rendered before the embed content (e.g. action buttons)
 *
 * @csspart wy-embed - Root embed container
 * @csspart wy-embed-interactive - Modifier when embed is clickable
 * @csspart wy-disabled - Modifier when embed is disabled
 * @csspart wy-embed-area - Area containing media (video/photo)
 * @csspart wy-embed-content - Content wrapper for video/rich embeds
 * @csspart wy-embed-video - Modifier for video embeds
 * @csspart wy-embed-rich - Modifier for rich embeds
 * @csspart wy-embed-photo - Photo variant container
 * @csspart wy-embed-photo-with-description - Photo variant with text description
 * @csspart wy-embed-image - Image element for photo embeds
 * @csspart wy-embed-icon - Thumbnail/icon element
 * @csspart wy-embed-provider - Provider meta text
 *
 * @fires {WyActionEventType} wy-action - Emitted when an action button is triggered.
 */
@customElement("wy-embed")
export class WyEmbed extends LitElement {
  static override styles = [hostContentsCss, embedCss];

  /** @internal */
  protected exportParts = new ShadowPartsController(this);

  /**
   * Embed data to render inside the card.
   */
  @property({ attribute: false })
  embed!: EmbedType;

  /**
   * Whether the embed is disabled (non-interactive).
   */
  @property({ type: Boolean, reflect: true })
  disabled: boolean = false;

  /**
   * Reference to the embed content container element used for sizing/aspect-ratio adjustments.
   * 
   * @internal
   */
  protected embedContentRef: Ref<HTMLDivElement> = createRef();

  /**
   * Dispatch a wy-action event for this embed.
   *
   * @internal
   * @param {ActionType | string} [action=""] - Action to dispatch.
   * @returns {boolean} True if the event was not canceled.
   */
  private dispatchActionEvent(action: WyActionEventType["detail"]["action"] = ActionType.Default) {
    const event: WyActionEventType = new (CustomEvent as NamedEvent)("wy-action", {
      detail: {
        action,
        embed: this.embed,
      } as WyActionEventDetailType,
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    return this.dispatchEvent(event);
  }

  override render() {
    // Array copy
    const actionList = this.embed.actions ? [...this.embed.actions] : [];

    const primaryAction = actionList.shift();
    const secondaryAction = actionList.length === 1 ? actionList.shift() : undefined;
    const hasDescription = Boolean((this.embed.type === "photo" || this.embed.type === "link") &&
        (this.embed.title || this.embed.description || (this.embed.type === "photo" && this.embed.provider_name)));

    return html`
      <slot name="before"></slot>
      <div
        part="wy-embed ${partMap({
          "wy-embed-interactive": Boolean(this.embed.url),
          "wy-disabled": this.disabled,
        })}"
        title=${this.embed.url ? this.embed.url : this.embed.title || ""}
        @click=${() =>
          this.embed.url && this.dispatchActionEvent(ActionType.Default) && openUrl(this.embed.url, "_blank")}
        @keydown=${clickOnEnterAndConsumeOnSpace}
        @keyup=${clickOnSpace}
      >
        ${(this.embed.type === "video" || this.embed.type === "rich") && this.embed.html
          ? html`
              <div part="wy-embed-area">
                <div
                  ${ref(this.embedContentRef)}
                  part=${partMap({
                    "wy-embed-content": true,
                    "wy-embed-video": this.embed.type === "video",
                    "wy-embed-rich": this.embed.type === "rich",
                  })}
                  data-width=${ifDefined(this.embed.width)}
                  data-height=${ifDefined(this.embed.height)}
                >
                  ${unsafeHTML(this.embed.html)}
                </div>
              </div>
            `
          : nothing}
        ${this.embed.type === "photo" && this.embed.image && this.embed.thumbnail_url
          ? html`
              <div
                part="wy-embed-photo wy-embed-area ${partMap({
                    "wy-embed-photo-with-description": hasDescription
                  })}"
                style="background-image: linear-gradient(var(--wy-shade-invert, rgba(255,255,255,0.15))), url(${this
                  .embed.thumbnail_url}), linear-gradient(var(--wy-shade-opaque, white));"
              >
                <img
                  part="wy-embed-image"
                  src=${this.embed.thumbnail_url}
                  alt=${this.embed.provider_name || this.embed.title || ""}
                  width=${ifDefined(this.embed.image.width)}
                  height=${ifDefined(this.embed.image.height)}
                />
              </div>
            `
          : nothing}
        ${hasDescription
          ? html`
              <wy-item size="auto">
                ${this.embed.type === "link" && this.embed.image && this.embed.thumbnail_url
                  ? html`
                      <img
                        part="wy-embed-icon"
                        slot="image"
                        src=${this.embed.thumbnail_url}
                        alt=${this.embed.provider_name || this.embed.title || ""}
                        width=${ifDefined(this.embed.image.width)}
                        height=${ifDefined(this.embed.image.height)}
                      />
                    `
                  : nothing}
                ${this.embed.provider_name
                  ? html`<span slot="meta" part="wy-embed-provider">${this.embed.provider_name}</span>`
                  : nothing}
                ${this.embed.title ? html`<span slot="title">${this.embed.title}</span>` : nothing}
                ${this.embed.description ? html`<span slot="text">${this.embed.description}</span>` : nothing}
                ${secondaryAction
                  ? html`
                      <wy-button
                        slot="actions"
                        color="variant"
                        @click=${(e: Event) => {
                          e.stopPropagation();
                          this.dispatchActionEvent(secondaryAction);
                        }}
                      >
                        ${secondaryAction}
                      </wy-button>
                    `
                  : nothing}
                ${primaryAction
                  ? html`
                      <wy-button
                        slot="actions"
                        color="primary"
                        @click=${(e: Event) => {
                          e.stopPropagation();
                          this.dispatchActionEvent(primaryAction);
                        }}
                      >
                        ${primaryAction}
                      </wy-button>
                    `
                  : nothing}
                ${actionList.length
                  ? html`
                      <wy-dropdown slot="actions">
                        ${actionList.map(
                          (action) =>
                            html`
                              <wy-dropdown-item
                                @click=${(e: Event) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  this.dispatchActionEvent(action);
                                }}
                              >
                                ${action}
                              </wy-dropdown-item>
                            `
                        )}
                      </wy-dropdown>
                    `
                  : nothing}
              </wy-item>
            `
          : nothing}
      </div>
    `;
  }

  protected override updated(_changedProperties: PropertyValues): void {
    if (this.embedContentRef.value) {
      const embedContent = this.embedContentRef.value.firstElementChild as HTMLElement;
      const {width, height} = this.embedContentRef.value.dataset;
      const parsedHeight = Number(height ?? '');

      // If height is 128-256 use it as min height, otherwise 128 
      const minHeight = parsedHeight > 128  && parsedHeight < 256 ? parsedHeight : 128;
      if (width && height) {
        // Set aspect ratio to get proper resizing
        embedContent.style.aspectRatio = `${width} / ${height}`;
        // Use min of height and --wy-embed-content-max-size (as rendered value)
        embedContent.style.minHeight = `${minHeight}px`;
      }
    }
  }
}

/**
 * Embed selector for multiple embeds (renders `<wy-embed>` instances with per-embed actions).
 *
 * **Used sub components:**
 *
 * - [`<wy-embed>`](./wy-embed.ts)
 * - [`<wy-button>`](./ui/wy-button.ts)
 * - [`<wy-icon>`](./ui/wy-icon.ts)
 *
 * @csspart wy-embed-select - Wrapper for embed selections
 * @csspart wy-embed-actions - Slot for action buttons shown before each embed
 *
 * @fires {EmbedRemoveEventType} embed-remove - Emitted when an embed is removed.
 * @fires {EmbedSwapEventType} embed-swap - Emitted when embeds should be swapped/rotated.
 */
@customElement("wy-embed-select")
export class WyEmbedSelect extends LitElement {
  static override styles = [hostContentsCss, embedCss];

  protected exportParts = new ShadowPartsController(this);

  /**
   * Array of embeds to render in the selector.
   *
   * @type {EmbedType[]}
   */
  @property({ attribute: false })
  embeds!: EmbedType[];

  /**
   * Dispatch a local embed-remove event for the embed with the given id.
  *
   * @internal
   * @param id - Embed id to remove.
   * @returns {boolean} True if the event was not canceled.
   */
  private dispatchRemove(id: number) {
    const event: EmbedRemoveEventType = new (CustomEvent as NamedEvent)("embed-remove", {
      detail: { id: id },
      bubbles: false,
      composed: false,
    });
    return this.dispatchEvent(event);
  }

  /**
   * Dispatch a local embed-swap event to request rotating/swapping embeds.
  *
   * @internal
   * @returns {boolean} True if the event was not canceled.
   */
  private dispatchSwap() {
    const event: EmbedSwapEventType = new (CustomEvent as NamedEvent)("embed-swap", {
      detail: {},
      bubbles: false,
      composed: false,
    });
    return this.dispatchEvent(event);
  }

  override render() {
    return html`
      <div part="wy-embed-select">
        ${repeat(
          this.embeds,
          (embed) => embed.id,
          (embed) => html`
            <wy-embed disabled .embed=${embed}>
              <div part="wy-embed-actions" slot="before">
                ${this.embeds.length > 1
                  ? html`
                      <wy-button kind="icon" @click=${() => this.dispatchSwap()}>
                        <wy-icon name="swap-horizontal"></wy-icon>
                      </wy-button>
                    `
                  : html`<span></span>`}

                <wy-button kind="icon" @click=${() => this.dispatchRemove(embed.id)}
                  ><wy-icon name="close-circle"></wy-icon
                ></wy-button>
              </div>
            </wy-embed>
          `
        )}
      </div>
    `;
  }
}
