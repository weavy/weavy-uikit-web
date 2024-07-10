import { LitElement, html, type PropertyValueMap, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import allStyles from "../scss/all";
import { MemberType } from "../types/members.types";
import { AddConversationMutationType, getAddConversationMutation } from "../data/conversations";
import { localized, msg } from "@lit/localize";
import { WeavyContextProps } from "../types/weavy.types";
import { ConversationTypeString } from "../types/conversations.types";
import { BlockConsumerMixin } from "../mixins/block-consumer-mixin";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";

import "./wy-users-search";
import "./wy-overlay";
import "./wy-button";
import "./wy-icon";

@customElement("wy-conversation-new")
@localized()
export default class WyConversationNew extends BlockConsumerMixin(LitElement) {
  static override styles = [allStyles];

  protected exportParts = new ShadowPartsController(this);

  @property()
  bot?: string;

  @state()
  private show = false;

  private addConversationMutation?: AddConversationMutationType;

  private open() {
    this.show = true;
  }

  private close() {
    this.show = false;
  }

  private async submit(members: MemberType[] = []) {
    const memberOptions = this.bot
      ? { members: [this.bot], type: ConversationTypeString.BotChat }
      : { members: members?.map((m) => m.id) };

    // create conversation
    const conversation = await this.addConversationMutation?.mutate(memberOptions);

    // close modal
    this.close();

    // trigger refetch and select conversation events
    const event = new CustomEvent("refetch", {});
    this.dispatchEvent(event);

    const eventSelect = new CustomEvent("selected", { detail: { id: conversation?.id } });
    return this.dispatchEvent(eventSelect);
  }

  protected override updated(changedProperties: PropertyValueMap<this & WeavyContextProps>) {
    if (changedProperties.has("weavyContext") && this.weavyContext) {
      this.addConversationMutation = getAddConversationMutation(this.weavyContext);
    }
  }

  override render() {
    return html`
      <wy-button kind="icon" @click=${() => (this.bot ? this.submit() : this.open())}>
        <wy-icon name="plus"></wy-icon>
      </wy-button>

      ${!this.bot && this.weavyContext
        ? html`<wy-overlay
            .show=${this.show}
            @close=${() => {
              this.show = false;
            }}
            @release-focus=${() =>
              this.dispatchEvent(new CustomEvent("release-focus", { bubbles: true, composed: true }))}
          >
            <header class="wy-appbars">
              <nav class="wy-appbar">
                <wy-button kind="icon" @click=${() => this.close()}>
                  <wy-icon name="close"></wy-icon>
                </wy-button>
                <div class="wy-appbar-text">${msg("New conversation")}</div>
              </nav>
            </header>
            ${this.show
              ? html` <wy-users-search @submit=${(e: CustomEvent) => this.submit(e.detail.members)}></wy-users-search> `
              : nothing}
          </wy-overlay>`
        : nothing}
    `;
  }
}
