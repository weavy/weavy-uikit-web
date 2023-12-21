import { LitElement, html, css, type PropertyValues } from "lit";
import { customElement, state } from "lit/decorators.js";
import { portal } from "lit-modal-portal";
import { consume } from "@lit/context";
import { type WeavyContext, weavyContextDefinition } from "../client/context-definition";

import allStyles from "../scss/all.scss";
import { MemberType } from "../types/members.types";
import { AddConversationMutationType, getAddConversationMutation } from "../data/conversations";
import { localized, msg } from "@lit/localize";

import "./wy-users-search";
import "./wy-overlay";
import "./wy-button";
import "./wy-icon";
import { WeavyContextProps } from "../types/weavy.types";

@customElement("wy-conversation-new")
@localized()
export default class WyConversationNew extends LitElement {
  
  static override styles = [
    allStyles,
    css`
      :host {
        display: contents;
      }
    `,
  ];

  @consume({ context: weavyContextDefinition, subscribe: true })
  @state()
  private weavyContext?: WeavyContext;

  @state()
  private show = false;

  private addConversationMutation?: AddConversationMutationType;

  protected override updated(changedProperties: PropertyValues<this & WeavyContextProps>) {
    if (changedProperties.has("weavyContext") && this.weavyContext) {
      this.addConversationMutation = getAddConversationMutation(this.weavyContext);
    }
  }

  private open() {
    this.show = true;
  }

  private close() {
    this.show = false;
  }

  private async submit(members: MemberType[]) {
    // create conversation
    const conversation = await this.addConversationMutation?.mutate({ members: members.map((m) => m.id) });

    // close modal
    this.close();

    // trigger refetch and select conversation events
    const event = new CustomEvent("refetch", {});
    this.dispatchEvent(event);

    const eventSelect = new CustomEvent("selected", { detail: { id: conversation?.id } });
    return this.dispatchEvent(eventSelect);
  }

  override render() {
    return html`
      <wy-button kind="icon" @click=${this.open}><wy-icon name="plus"></wy-icon></wy-button>

      ${portal(
        this.show,
        html`<wy-overlay
          @release-focus=${() =>
            this.dispatchEvent(new CustomEvent("release-focus", { bubbles: true, composed: true }))}>
          <header class="wy-appbars">
            <nav class="wy-appbar">
              <wy-button kind="icon" @click=${() => this.close()}>
                <wy-icon name="close"></wy-icon>
              </wy-button>
              <div class="wy-appbar-text">${msg("New conversation")}</div>
            </nav>
          </header>

          <wy-users-search @submit=${(e: CustomEvent) => this.submit(e.detail.members)}></wy-users-search>
        </wy-overlay>`,
        () => (this.show = false)
      )}
    `;
  }
}
