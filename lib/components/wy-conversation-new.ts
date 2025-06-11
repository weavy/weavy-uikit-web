import { html, type PropertyValueMap, nothing } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, queryAssignedElements, state } from "lit/decorators.js";
import { CreateAppMutationType, getCreateAppMutation } from "../data/app";
import { localized, msg } from "@lit/localize";
import { AppTypeString } from "../types/app.types";
import { WeavySubComponent } from "../classes/weavy-sub-component";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { MemberSearchSubmitEventType } from "../types/members.events";
import { SelectedEventType } from "../types/app.events";
import { NamedEvent } from "../types/generic.types";

import allStyles from "../scss/all.scss";
import hostContentsCss from "../scss/host-contents.scss";

import "./wy-users-search";
import "./base/wy-overlay";
import "./base/wy-button";
import "./base/wy-icon";

/**
 *
 * @cssPart {WyButton} wy-conversation-new-button - The button for creating a new conversation.
 */
@customElement("wy-conversation-new")
@localized()
export default class WyConversationNew extends WeavySubComponent {
  static override styles = [allStyles, hostContentsCss];

  protected exportParts = new ShadowPartsController(this);

  @property()
  agent?: string;

  @state()
  private show = false;

  private addConversationMutation?: CreateAppMutationType;

  @queryAssignedElements({ flatten: true})
  private slotElements!: Array<HTMLElement>;

  async create(members?: (number|string)[]) {
    if (this.agent) {
      await this.submit() 
    } if (members) {
      await this.submit(members) 
    } else {
      this.open()
    }
  }

  private open() {
    this.show = true;
  }

  private close() {
    this.show = false;
  }

  private async submit(members: (number|string)[] = []) {
    const memberOptions = this.agent
      ? { members: [this.agent], type: AppTypeString.AgentChat }
      : { members, type: members.length === 1 ? AppTypeString.PrivateChat : AppTypeString.ChatRoom };

    // create conversation
    const conversation = await this.addConversationMutation?.mutate(memberOptions);

    // close modal
    this.close();

    const eventSelect: SelectedEventType = new (CustomEvent as NamedEvent)("selected", { detail: { id: conversation?.id } });
    return this.dispatchEvent(eventSelect);
  }

  protected override updated(changedProperties: PropertyValueMap<this>) {
    if (changedProperties.has("weavy") && this.weavy) {
      this.addConversationMutation = getCreateAppMutation(this.weavy);
    }
  }

  override render() {
    return html`
      ${ this.slotElements.length ? nothing : html`
        <wy-button part="wy-conversation-new-button" kind="icon" @click=${() => this.create()}>
          <wy-icon name="plus"></wy-icon>
        </wy-button>
      `}
      <slot></slot>

      ${!this.agent && this.weavy
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
              ? html` <wy-users-search @submit=${(e: MemberSearchSubmitEventType) => this.submit(e.detail.members.map((m) => m.id))}></wy-users-search> `
              : nothing}
          </wy-overlay>`
        : nothing}
    `;
  }
}
