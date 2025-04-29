import { LitElement, html, type PropertyValueMap, nothing } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { MemberType } from "../types/members.types";
import { CreateAppMutationType, getCreateAppMutation } from "../data/app";
import { localized, msg } from "@lit/localize";
import { WeavyProps } from "../types/weavy.types";
import { AppTypeString } from "../types/app.types";
import { WeavyComponentConsumerMixin } from "../classes/weavy-component-consumer-mixin";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { MemberSearchSubmitEventType } from "../types/members.events";
import { SelectedEventType } from "../types/app.events";
import { NamedEvent } from "../types/generic.types";

import allStyles from "../scss/all.scss";

import "./wy-users-search";
import "./base/wy-overlay";
import "./base/wy-button";
import "./base/wy-icon";

@customElement("wy-conversation-new")
@localized()
export default class WyConversationNew extends WeavyComponentConsumerMixin(LitElement) {
  static override styles = [allStyles];

  protected exportParts = new ShadowPartsController(this);

  @property()
  bot?: string;

  @state()
  private show = false;

  private addConversationMutation?: CreateAppMutationType;

  private open() {
    this.show = true;
  }

  private close() {
    this.show = false;
  }

  private async submit(members: MemberType[] = []) {
    const memberOptions = this.bot
      ? { members: [this.bot], type: AppTypeString.BotChat }
      : { members: members?.map((m) => m.id), type: members.length === 1 ? AppTypeString.PrivateChat : AppTypeString.ChatRoom };

    // create conversation
    const conversation = await this.addConversationMutation?.mutate(memberOptions);

    // close modal
    this.close();

    const eventSelect: SelectedEventType = new (CustomEvent as NamedEvent)("selected", { detail: { id: conversation?.id } });
    return this.dispatchEvent(eventSelect);
  }

  protected override updated(changedProperties: PropertyValueMap<this & WeavyProps>) {
    if (changedProperties.has("weavy") && this.weavy) {
      this.addConversationMutation = getCreateAppMutation(this.weavy);
    }
  }

  override render() {
    return html`
      <wy-button kind="icon" @click=${() => (this.bot ? this.submit() : this.open())}>
        <wy-icon name="plus"></wy-icon>
      </wy-button>

      ${!this.bot && this.weavy
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
              ? html` <wy-users-search @submit=${(e: MemberSearchSubmitEventType) => this.submit(e.detail.members)}></wy-users-search> `
              : nothing}
          </wy-overlay>`
        : nothing}
    `;
  }
}
