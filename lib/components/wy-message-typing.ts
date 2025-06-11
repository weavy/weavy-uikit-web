import { LitElement, PropertyValueMap, html, nothing } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { TypingController } from "../controllers/typing-controller";
import { consume } from "@lit/context";
import { type WeavyType, WeavyContext } from "../contexts/weavy-context";
import { classMap } from "lit/directives/class-map.js";
import { MemberType } from "../types/members.types";
import { TypingUserType } from "../types/users.types";
import { ifDefined } from "lit/directives/if-defined.js";

import rebootCss from "../scss/components/base/reboot.scss";
import messagesCss from "../scss/components/messages.scss";
import bouncerCss from "../scss/components/bouncer.scss";

import "./base/wy-avatar";

/**
 * Shows a typing message whenever a member is typing
 * 
   * @fires {TypingEventType} typing - Count of typers when someone is typing
 */
@customElement("wy-message-typing")
export default class WyMessageTyping extends LitElement {
  static override styles = [rebootCss, bouncerCss, messagesCss];

  protected exportParts = new ShadowPartsController(this);

  /**
   * @fires {TypingEventType} typing - Count of typers when someone is typing
   */
  protected typing = new TypingController(this);

  @consume({ context: WeavyContext, subscribe: true })
  @state()
  private weavy?: WeavyType;

  @property({ attribute: true, type: Number })
  conversationId?: number;

  @property({ attribute: true, type: Number })
  userId?: number;

  @property({ type: Boolean })
  isPrivateChat: boolean = false;

  @property({ attribute: false })
  members?: MemberType[];

  @property({ attribute: false })
  agents?: MemberType[];

  @state()
  private typingMembers: TypingUserType[] = [];

  @state()
  private names: string[] = [];

  @state()
  private typingTime?: Date;

  protected override willUpdate(changedProperties: PropertyValueMap<this>): void {
    super.willUpdate(changedProperties);
    
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
      [...(this.members ?? []), ...(this.agents ?? [])].find((member) => member.id === typingMember.id)
    ).filter((x) => x);

    // Make a readable list
    const typingNames = new Intl.ListFormat(this.weavy?.locale, { style: "long", type: "conjunction" }).format(
      this.names
    );

    const dateFull = this.typingTime
      ? new Intl.DateTimeFormat(this.weavy?.locale, { dateStyle: "full", timeStyle: "short" }).format(this.typingTime)
      : "";
    const timeShort = this.typingTime
      ? new Intl.DateTimeFormat(this.weavy?.locale, { timeStyle: "short" }).format(this.typingTime)
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
          <div class=${classMap({ "wy-message": true, "wy-message-agent": Boolean(members[0]?.is_agent) })}>
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
                      .description=${members[0]?.comment}
                      .name=${typingNames}
                      .isAgent=${members[0]?.is_agent}
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
