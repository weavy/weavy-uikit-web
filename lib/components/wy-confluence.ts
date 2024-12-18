import { LitElement, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import type { ExternalBlobType } from "../types/files.types";

import chatCss from "../scss/all.scss";
import type { ConfluencePageProps } from "../types/confluence.types";

import { localized, msg } from "@lit/localize";
import { BlockConsumerMixin } from "../mixins/block-consumer-mixin";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";

import "./wy-dropdown";
import "./wy-icon";
import "./wy-overlay";
import "./wy-confluence-picker";

@customElement("wy-confluence")
@localized()
export default class WyConfluence extends BlockConsumerMixin(LitElement) {
  static override styles = chatCss;

  protected exportParts = new ShadowPartsController(this);

  @property({ type: Boolean })
  dropdown: boolean = false;

  @state()
  showPicker = false;

  constructor() {
    super();
    console.warn("Using <wy-confluence-picker> is deprecated! Please contact support for using Confluence with Weavy.");
  }

  open() {
    this.showPicker = true;
  }

  close() {
    this.showPicker = false;
  }

  private dispatchExternalBlobs(externalBlobs: ExternalBlobType[] | null) {
    const externalBlobsEvent = new CustomEvent("external-blobs", { detail: { externalBlobs } });
    return this.dispatchEvent(externalBlobsEvent);
  }

  private handleUnauthorized() {
    if (!this.user) {
      return;
    }

    window.open(
      `${this.weavy?.confluenceAuthenticationUrl}&state=${this.user.id}`,
      "confluenceAuthWin",
      "height=640,width=480"
    );
  }

  private async handleAddPage({ url, id, title, hostname, spaceKey }: ConfluencePageProps) {
    const blob: ExternalBlobType = {
      provider: "Confluence",
      link: "https://" + hostname + "/wiki" + url,
      name: title,
      size: 0,
      raw: {
        contentId: id,
        hostname: hostname,
        parentProduct: this.weavy?.confluenceProductName,
        spaceKey: spaceKey,
      },
    };
    this.dispatchExternalBlobs([blob]);
    this.close();
  }

  override render() {
    if (!this.weavy?.confluenceAuthenticationUrl) {
      return nothing;
    }

    return html`
      ${this.dropdown
        ? html`
            <wy-dropdown-item @click=${() => this.open()} title=${msg("Confluence Page Picker")}>
              <wy-icon name="confluence" color="native"></wy-icon> Confluence
            </wy-dropdown-item>
          `
        : html`
            <wy-button @click=${() => this.open()} title=${msg("Confluence Page Picker")} kind="icon"
              ><wy-icon name="confluence" color="native"></wy-icon
            ></wy-button>
          `}
      ${this.weavy
        ? html`
            <wy-overlay
              .show=${this.showPicker}
              @close=${() => this.close()}
              @release-focus=${() =>
                this.dispatchEvent(new CustomEvent("release-focus", { bubbles: true, composed: true }))}
            >
              <slot name="header">
                <header class="wy-appbars">
                  <nav class="wy-appbar">
                    <slot name="appbar-buttons" class="wy-appbar-buttons wy-appbar-buttons-first"></slot>
                    <slot name="appbar-text" class="wy-appbar-text">${msg("Confluence Page Picker")}</slot>
                    <wy-button kind="icon" @click=${() => this.close()}>
                      <wy-icon name="close"></wy-icon>
                    </wy-button>
                  </nav>
                </header>
              </slot>
              ${this.showPicker
                ? html`
                    <wy-confluence-picker
                      @submit=${(e: CustomEvent) => this.handleAddPage(e.detail)}
                      @close=${() => this.close()}
                      @unauthorized=${() => this.handleUnauthorized()}
                    ></wy-confluence-picker>
                  `
                : nothing}
            </wy-overlay>
          `
        : nothing}
    `;
  }
}
