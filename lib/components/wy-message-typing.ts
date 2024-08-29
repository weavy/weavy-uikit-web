import { LitElement, PropertyValueMap, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { TypingController } from "../controllers/typing-controller";
import { consume } from "@lit/context";
import { type WeavyContextType, weavyContextDefinition } from "../contexts/weavy-context";
import { type WeavyContextProps } from "../types/weavy.types";
import { classMap } from "lit/directives/class-map.js";
import { MemberType } from "../types/members.types";
import { TypingUserType } from "../types/users.types";
import { ifDefined } from "lit/directives/if-defined.js";

import rebootCss from "../scss/components/base/reboot.scss";
import messagesCss from "../scss/components/messages.scss";
import bouncerCss from "../scss/components/bouncer.scss";

import "./wy-avatar";

@customElement("wy-message-typing")
export default class WyMessageTyping extends LitElement {
  static override styles = [rebootCss, bouncerCss, messagesCss];

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

  @property({ attribute: false })
  members?: MemberType[];

  @state()
  private typingMembers: TypingUserType[] = [];

  @state()
  private names: string[] = [];

  @state()
  private typingTime?: Date;

  protected override willUpdate(changedProperties: PropertyValueMap<this & WeavyContextProps>): void {
    if (changedProperties.has("conversationId")) {
      this.typing.appId = this.conversationId;
    }

    if (changedProperties.has("userId")) {
      this.typing.userId = this.userId;
    }

    const { typingMembers, names } = this.typing;
    this.typingMembers = typingMembers;
    this.names = names;

    if (typingMembers.length) {
      this.typingTime ||= new Date();
    } else {
      this.typingTime = undefined;
    }
  }

  override render() {
    const members = this.typingMembers.map((typingMember) =>
      this.members?.find((member) => member.id === typingMember.id)
    );

    // Make a readable list
    const typingNames = new Intl.ListFormat(this.weavyContext?.locale, { style: "long", type: "conjunction" }).format(
      this.names
    );

    const dateFull = this.typingTime
      ? new Intl.DateTimeFormat(this.weavyContext?.locale, { dateStyle: "full", timeStyle: "short" }).format(
          this.typingTime
        )
      : "";
    const timeShort = this.typingTime
      ? new Intl.DateTimeFormat(this.weavyContext?.locale, { timeStyle: "short" }).format(this.typingTime)
      : "";

    const bouncer = html`
      <svg part="wy-bouncer" viewBox="0 0 32 16" xmlns="http://www.w3.org/2000/svg">
        <circle part="wy-bouncer-dot wy-bouncer-dot-start" cx="4" cy="10" r="4" />
        <circle part="wy-bouncer-dot wy-bouncer-dot-middle" cx="16" cy="10" r="4" />
        <circle part="wy-bouncer-dot wy-bouncer-dot-end" cx="28" cy="10" r="4" />
      </svg>
    `;

    return members.length
      ? html`
          <div class=${classMap({ "wy-message": true, "wy-message-bot": this.isBot })}>
            <div class="wy-message-author">
              ${members.length > 1
                ? html`
                    <wy-avatar-group
                      .size=${32}
                      .members=${members as MemberType[]}
                      title=${typingNames}
                    ></wy-avatar-group>
                  `
                : html`
                    <wy-avatar
                      .size=${32}
                      .src=${members[0]?.avatar_url}
                      .name=${typingNames}
                      .isBot=${this.isBot}
                    ></wy-avatar>
                  `}
            </div>

            <div class="wy-message-content">
              <div class="wy-message-meta">
                ${this.isPrivateChat
                  ? html`
                      <time datetime=${ifDefined(this.typingTime?.toISOString())} title=${dateFull}>${timeShort}</time>
                    `
                  : typingNames}
              </div>
              <div class="wy-message-bubble"> ${bouncer} </div>
            </div>
          </div>
        `
      : nothing;
  }
}
