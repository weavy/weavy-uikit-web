import { LitElement, html, nothing } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import type { EmbedType } from "../types/embeds.types";
import { classMap } from "lit/directives/class-map.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { ifDefined } from "lit/directives/if-defined.js";

import chatCss from "../scss/all.scss";

import "./base/wy-button";
import "./base/wy-icon";
import { EmbedRemoveEventType, EmbedSwapEventType } from "../types/embeds.events";
import { NamedEvent } from "../types/generic.types";

/**
 * @fires {EmbedRemoveEventType} embed-remove
 * @fires {EmbedSwapEventType} embed-swap
 */
@customElement("wy-embed")
export default class WyEmbed extends LitElement {
  
  static override styles = chatCss;

  protected exportParts = new ShadowPartsController(this);

  @property({ attribute: false })
  embed!: EmbedType;

  @property({ type: Boolean, attribute: false })
  enableSwap: boolean = false;

  override createRenderRoot() {
    return this;
  }

  private dispatchRemove(id: number) {
    const event: EmbedRemoveEventType = new (CustomEvent as NamedEvent)("embed-remove", { detail: { id: id } });
    return this.dispatchEvent(event);
  }

  private dispatchSwap() {
    const event: EmbedSwapEventType = new (CustomEvent as NamedEvent)("embed-swap", { detail: {} });
    return this.dispatchEvent(event);
  }

  override render() {
    const giphy = this.embed.type === "photo" && this.embed.provider_name.toLocaleLowerCase() === "giphy";
    const caption = !this.embed.html && !giphy;

    return html`
      <div class="wy-embed-actions">
        ${this.enableSwap
          ? html`<wy-button kind="icon" @click=${() => this.dispatchSwap()}
              ><wy-icon name="swap-horizontal"></wy-icon
            ></wy-button>`
          : html`<wy-button class="wy-embed-cycle"></wy-button>`}

        <wy-button kind="icon" @click=${() => this.dispatchRemove(this.embed.id)}
          ><wy-icon name="close-circle"></wy-icon
        ></wy-button>
      </div>

      ${this.embed.type === "audio" ? html`<div class="wy-embed-audio"></div>` : nothing}
      ${this.embed.type === "video" && this.embed.html
        ? html`<div class="wy-embed-video"><div>${unsafeHTML(this.embed.html)}</div></div>`
        : nothing}
      ${this.embed.type === "rich" ? html`<div class="wy-embed-rich"></div>` : nothing}
      ${this.embed.type === "photo" && this.embed.thumbnail_url
        ? html`
            <div
              class=${classMap({
                "wy-embed-photo": true,
                "wy-embed-photo-sm": (this.embed.thumbnail_width || 0) < 250,
              })}>
              <a href=${this.embed.original_url} target="_blank">
                <img
                  src=${this.embed.thumbnail_url}
                  width=${ifDefined(this.embed.thumbnail_width)}
                  height=${ifDefined(this.embed.thumbnail_height)}
                  alt="" />
              </a>
            </div>
          `
        : nothing}
      ${this.embed.type !== "audio" &&
      this.embed.type !== "video" &&
      this.embed.type !== "rich" &&
      this.embed.type !== "photo" &&
      this.embed.thumbnail_url
        ? html`
            <div
              class=${classMap({
                "wy-embed-photo": true,
                "wy-embed-photo-sm": (this.embed.thumbnail_width || 0) < 250,
              })}>
              <a href=${this.embed.original_url} target="_blank">
                <img
                  src=${this.embed.thumbnail_url}
                  width=${ifDefined(this.embed.thumbnail_width)}
                  height=${ifDefined(this.embed.thumbnail_height)}
                  alt="" />
              </a>
            </div>
          `
        : nothing}
      ${caption
        ? html` <div class="wy-embed-caption">
            <a class="wy-embed-link" href=${this.embed.original_url} target="_blank">${this.embed.host}</a>
            ${this.embed.title ? html`<div class="wy-embed-title">${this.embed.title}</div>` : nothing}
            ${this.embed.description
              ? html`<div class="wy-embed-description">${this.embed.description}</div>`
              : nothing}
          </div>`
        : nothing}
    `;
  }
}
