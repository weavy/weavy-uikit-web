import { LitElement, PropertyValueMap, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { TypingController } from "../controllers/typing-controller";
import { consume } from "@lit/context";
import { type WeavyContextType, weavyContextDefinition } from "../contexts/weavy-context";
import { type WeavyContextProps } from "../types/weavy.types";
import { classMap } from "lit/directives/class-map.js";

import rebootCss from "../scss/wrappers/base/reboot";
import messagesCss from "../scss/wrappers/messages";
import bouncerCss from "../scss/wrappers/bouncer";

import "./wy-avatar";

@customElement("wy-message-typing")
export default class WyTyping extends LitElement {
  static override styles = [
    rebootCss,
    bouncerCss,
    messagesCss
  ];

  protected exportParts = new ShadowPartsController(this);
  protected typing = new TypingController(this);

  @consume({ context: weavyContextDefinition, subscribe: true })
  @state()
  private weavyContext?: WeavyContextType;

  @property({ attribute: true, type: Number })
  conversationId?: number;

  @property({ attribute: true, type: Number })
  userId?: number;

  @property({ type: Boolean })
  isBot: boolean = false;

  @property({ type: Boolean })
  isPrivateChat: boolean = false;

  protected override willUpdate(changedProperties: PropertyValueMap<this & WeavyContextProps>): void {
    if (changedProperties.has("conversationId")) {
      this.typing.appId = this.conversationId;
    }

    if (changedProperties.has("userId")) {
      this.typing.userId = this.userId;
    }
  }

  override render() {
    const { typingMembers, names } = this.typing;

    // Make a readable list
    const typingNames = new Intl.ListFormat(this.weavyContext?.locale, { style: "long", type: "conjunction" }).format(
      names
    );

    const bouncer = html`
    <svg
        part="wy-bouncer"
        viewBox="0 0 32 16"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          part="wy-bouncer-dot wy-bouncer-dot-start"
          cx="4"
          cy="10"
          r="4"
        />
        <circle
          part="wy-bouncer-dot wy-bouncer-dot-middle"
          cx="16"
          cy="10"
          r="4"
        />
        <circle
          part="wy-bouncer-dot wy-bouncer-dot-end"
          cx="28"
          cy="10"
          r="4"
        />
      </svg>
    `;

    return typingMembers.length ? html`
      <div class=${classMap({ "wy-message": true, "wy-message-bot": this.isBot })}>
        <div class="wy-message-author">
          ${ typingMembers.length > 1 ? html`
          <wy-avatar-group .size=${32} .members=${typingMembers} title=${typingNames}></wy-avatar-group>
          ` : html`
          <wy-avatar .size=${32} name=${typingNames} .isBot=${this.isBot}></wy-avatar> ` }
          
        </div>

        <div class="wy-message-content">
          <div class="wy-message-meta"> ${this.isPrivateChat ? nothing : typingNames} </div>
          <div class="wy-message-bubble">
            ${bouncer}
          </div>
        </div>
      </div>
    ` : nothing;
  }
}
