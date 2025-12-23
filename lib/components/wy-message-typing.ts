import { LitElement, PropertyValueMap, html, nothing } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { TypingController } from "../controllers/typing-controller";
import { consume } from "@lit/context";
import { type WeavyType, WeavyContext } from "../contexts/weavy-context";
import { partMap } from "../utils/directives/shadow-part-map";
import { MemberType } from "../types/members.types";
import { TypingUserType } from "../types/users.types";
import { ifDefined } from "lit/directives/if-defined.js";

import rebootCss from "../scss/reboot.scss";
import messagesCss from "../scss/components/messages.scss";
import bouncerCss from "../scss/components/bouncer.scss";

import "./ui/wy-avatar";

declare global {
  interface HTMLElementTagNameMap {
    "wy-message-typing": WyMessageTyping;
  }
}

/**
 * Displays typing indicator for messages in a conversation.
 *
 * **Used sub components:**
 *
 * - [`<wy-avatar-group>`](./ui/wy-avatar.ts)
 * - [`<wy-avatar>`](./ui/wy-avatar.ts)
 *
 * @csspart wy-message-typing - Root container for typing indicator.
 * @csspart wy-message - Message container.
 * @csspart wy-message-agent - Modifier for message container when author is agent .
 * @csspart wy-message-author - Message section for the author avatar.
 * @csspart wy-message-content - Message section for the content.
 * @csspart wy-message-meta - Message content section for author names and time.
 * @csspart wy-message-bubble - Message content section for the text bubble containing the bouncer.
 * @csspart wy-bouncer - SVG bouncing graphic.
 * @csspart wy-bouncer-dot - Dot in the SVG bouncer.
 * @csspart wy-bouncer-dot-start - The first dot.
 * @csspart wy-bouncer-dot-middle - The second dot.
 * @csspart wy-bouncer-dot-end - The last dot.
 *
 * @fires {TypingEventType} typing - Emitted when typing state changes.
 */
@customElement("wy-message-typing")
export class WyMessageTyping extends LitElement {
  static override styles = [rebootCss, bouncerCss, messagesCss];

  /** @internal */
  protected exportParts = new ShadowPartsController(this);

  /**
   * Typing controller emitting `typing` events for the current conversation.
   *
   * @fires {TypingEventType} typing - Count of active typers.
   * @internal
   */
  protected typing = new TypingController(this);

  /**
   * Consumed Weavy context used for locale formatting.
   *
   * @internal
   */
  @consume({ context: WeavyContext, subscribe: true })
  @state()
  private weavy?: WeavyType;

  /**
   * Conversation id to bind typing updates to.
   */
  @property({ attribute: true, type: Number })
  conversationId?: number;

  /**
   * Current user id used to filter typing updates.
   */
  @property({ attribute: true, type: Number })
  userId?: number;

  /**
   * Render the typing indicator using private chat layout.
   */
  @property({ type: Boolean })
  isPrivateChat: boolean = false;

  /**
   * Members participating in the conversation.
   */
  @property({ attribute: false })
  members: MemberType[] = [];

  /**
   * Active members currently typing.
   *
   * @internal
   */
  @state()
  private typingMembers: TypingUserType[] = [];

  /**
   * Names of members currently typing.
   *
   * @internal
   */
  @state()
  private names: string[] = [];

  /**
   * Timestamp when typing started.
   *
   * @internal
   */
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
      this.members.find((member) => member.id === typingMember.id)
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
          <div part=${partMap({ "wy-message": true, "wy-message-agent": Boolean(members[0]?.is_agent) })}>
            <div part="wy-message-author">
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

            <div part="wy-message-content">
              <div part="wy-message-meta">
                ${this.isPrivateChat
                  ? html`
                      <time datetime=${ifDefined(this.typingTime?.toISOString())} title=${dateFull}>${timeShort}</time>
                    `
                  : typingNames}
              </div>
              <div part="wy-message-bubble"> ${bouncer} </div>
            </div>
          </div>
        `
      : nothing;
  }
}
