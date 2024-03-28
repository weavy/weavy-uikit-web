import { LitElement, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { type WeavyContextType, weavyContextDefinition } from "../client/context-definition";
import type { ExternalBlobType } from "../types/files.types";

import chatCss from "../scss/all";
import { consume } from "@lit/context";
import type { UserType } from "../types/users.types";
import type { ConfluencePageProps } from "../types/confluence.types";

import { portal } from "lit-modal-portal";
import { localized, msg } from "@lit/localize";

import "./wy-dropdown";
import "./wy-icon";
import "./wy-overlay";
import "./wy-confluence-picker";

@customElement("wy-confluence")
@localized()
export default class WyConfluence extends LitElement {
  static override styles = chatCss;

  @consume({ context: weavyContextDefinition, subscribe: true })
  @state()
  private weavyContext?: WeavyContextType;

  @property({
    attribute: false,
    type: Object
  })
  user?: UserType;

  @property({ type: Boolean })
  dropdown: boolean = false;

  @state()
  showPicker = false;

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
      return
    }

    window.open(
      `${this.weavyContext?.confluenceAuthenticationUrl}&state=${this.user.id}`,
      "confluenceAuthWin",
      "height=640,width=480"
    );
  }

  private async handleAddPage({url, id, title, hostname, spaceKey} : ConfluencePageProps) {
    const blob: ExternalBlobType = {
      provider: "Confluence",
      link: "https://" + hostname + "/wiki" + url,
      name: title,
      size: 0,
      raw: {
        contentId: id,
        hostname: hostname,
        parentProduct: this.weavyContext?.confluenceProductName,
        spaceKey: spaceKey,
      },
    };
    this.dispatchExternalBlobs([blob]);
    this.close();
  }

  override render() {
    if (!this.weavyContext?.confluenceAuthenticationUrl) {
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
      ${portal(
        this.showPicker,
        html`
          <wy-overlay
            @release-focus=${() =>
              this.dispatchEvent(new CustomEvent("release-focus", { bubbles: true, composed: true }))}
          >
            <slot name="header">
              <header class="wy-appbars">
                <nav class="wy-appbar">
                  <slot name="appbar-buttons" class="wy-appbar-buttons"></slot>
                  <slot name="appbar-text" class="wy-appbar-text">${msg("Confluence Page Picker")}</slot>
                  <wy-button kind="icon" @click=${() => this.close()}>
                    <wy-icon name="close"></wy-icon>
                  </wy-button>
                </nav>
              </header>
            </slot>

            <wy-confluence-picker
              @submit=${(e: CustomEvent) => this.handleAddPage(e.detail)}
              @close=${() => this.close()}
              @unauthorized=${() => this.handleUnauthorized()}
            ></wy-confluence-picker>
          </wy-overlay>
        `,
        () => this.close()
      )}
    `;
  }
}
