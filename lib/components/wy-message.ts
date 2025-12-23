import { type PropertyValueMap, html, nothing } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { localized, msg, str } from "@lit/localize";
import { keyed } from "lit/directives/keyed.js";
import type { ReactableType } from "../types/reactions.types";
import type { MemberType } from "../types/members.types";
import type { MeetingType } from "../types/meetings.types";
import type { FileType } from "../types/files.types";
import type { FileOpenEventType } from "../types/files.events";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import type { WyPreview } from "./wy-preview";
import type { EmbedType } from "../types/embeds.types";
import { PollOptionType } from "../types/polls.types";
import { WeavySubAppComponent } from "../classes/weavy-sub-app-component";
import { type AppType, EntityTypeString } from "../types/app.types";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { isEntityChainMatch } from "../utils/notifications";
import { partMap } from "../utils/directives/shadow-part-map";
import { Feature } from "../types/features.types";
import { PollVoteEventType } from "../types/polls.events";
import { NamedEvent } from "../types/generic.types";
import { checkOnlyEmojis } from "../utils/strings";

import rebootCss from "../scss/reboot.scss";
import messagesCss from "../scss/components/messages.scss";
import contentCss from "../scss/components/content.scss";
import hostContentsCss from "../scss/host-contents.scss";

import "./ui/wy-avatar";
import "./ui/wy-item";
import "./ui/wy-image-grid";
import "./ui/wy-icon";
import "./ui/wy-button";
import "./ui/wy-dropdown";
import "./ui/wy-skeleton";
import "./wy-attachment";
import "./wy-annotation";
import "./wy-embed";
import "./wy-meeting-card";
import "./wy-poll";
import "./wy-reactions";
import "./wy-preview";


declare global {
  interface HTMLElementTagNameMap {
    "wy-message": WyMessage;
  }
}

/**
 * Displays a single message in a conversation.
 *
 * **Used sub components:**
 *
 * - [`<wy-avatar>`](./ui/wy-avatar.ts)
 * - [`<wy-item>`](./ui/wy-item.ts)
 * - [`<wy-icon>`](./ui/wy-icon.ts)
 * - [`<wy-button>`](./ui/wy-button.ts)
 * - [`<wy-dropdown>`](./ui/wy-dropdown.ts)
 * - [`<wy-skeleton>`](./ui/wy-skeleton.ts)
 * - [`<wy-attachment-list>`](./wy-attachment.ts)
 * - [`<wy-annotation>`](./wy-annotation.ts)
 * - [`<wy-annotation-list>`](./wy-annotation.ts)
 * - [`<wy-embed>`](./wy-embed.ts)
 * - [`<wy-image-grid>`](./ui/wy-image-grid.ts)
 * - [`<wy-meeting-card>`](./wy-meeting-card.ts)
 * - [`<wy-poll>`](./wy-poll.ts)
 * - [`<wy-reactions>`](./wy-reactions.ts)
 * - [`<wy-preview>`](./wy-preview.ts)
 *
 * @csspart wy-message - Root message container.
 * @csspart wy-message-me - Modifier for messages from the current user.
 * @csspart wy-message-agent - Modifier for agent messages.
 * @csspart wy-highlight - Modifier used when a message is highlighted.
 * @csspart wy-message-author - Author/avatar area.
 * @csspart wy-message-content - Content wrapper.
 * @csspart wy-message-meta - Meta area (name/time).
 * @csspart wy-message-bubble - Message bubble.
 * @csspart wy-message-bubble-emoji - Bubble modifier for emoji-only messages.
 * @csspart wy-message-bubble-section - Sections inside the bubble (images, attachments, annotations).
 * @csspart wy-content - HTML/text content area.
 * @csspart wy-content-emoji - Content modifier for emoji-only content.
 * @csspart wy-message-seenby - Seen-by avatars area.
 * @csspart wy-annotations - Wrapper for annotation buttons (from wy-annotation-list).
 * @csspart wy-annotation - Annotation button (from wy-annotation).
 * @csspart wy-annotation-icon - Icon inside an annotation button.
 * @csspart wy-annotation-text - Text inside an annotation button.
 *
 * @fires {PollVoteEventType} vote - Emitted when a poll option is voted.
 * @fires {WyActionEventType} wy-action - Emitted when an embed action button is triggered.
 * @fires {WyPreviewOpenEventType} wy-preview-open - Fired when a preview overlay is about to open.
 * @fires {WyPreviewCloseEventType} wy-preview-close - Fired when a preview overlay is closed.
 */
@customElement("wy-message")
@localized()
export class WyMessage extends WeavySubAppComponent {
  static override styles = [rebootCss, messagesCss, contentCss, hostContentsCss];

  protected exportParts = new ShadowPartsController(this);

  /**
   * App context owning the message.
   */
  @property({ attribute: false })
  conversation?: AppType;

  /**
   * Unique identifier for the rendered message.
   */
  @property({ type: Number })
  messageId!: number;

  /**
   * True when the message was authored by the current user.
   */
  @property({ type: Boolean })
  me: boolean = false;

  /**
   * True when the message was authored by an agent.
   */
  @property({ type: Boolean })
  isAgent: boolean = false;

  /**
   * Render the message using private-conversation layout.
   */
  @property({ type: Boolean })
  isPrivateChat: boolean = false;

  /**
   * Display name for the message author.
   */
  @property()
  name: string = "";

  /**
   * Additional author info shown as tooltip text.
   */
  @property()
  comment?: string = "";

  /**
   * Avatar URL for the message author.
   */
  @property()
  avatar?: string = "";

  /**
   * ISO timestamp when the message was created.
   */
  @property()
  createdAt: string = "";

  /**
   * HTML formatted message content.
   */
  @property()
  html: string = "";

  /**
   * Plain-text message content.
   */
  @property()
  text: string = "";

  /**
   * Annotation files attached to the message.
   */
  @property({ type: Array })
  annotations?: FileType[] = [];

  /**
   * Attachment files associated with the message.
   */
  @property({ type: Array })
  attachments?: FileType[] = [];

  /**
   * Meeting information attached to the message.
   */
  @property({ attribute: false })
  meeting?: MeetingType;

  /**
   * Poll options available on the message.
   */
  @property({ type: Array })
  pollOptions: PollOptionType[] | undefined = [];

  /**
   * Embed metadata attached to the message.
   */
  @property({ attribute: false })
  embed?: EmbedType;

  /**
   * Reactions applied to the message.
   */
  @property({ type: Array })
  reactions?: ReactableType[] = [];

  /**
   * Members who have seen the message.
   */
  @property({ type: Array })
  seenBy: MemberType[] = [];

  /**
   * Highlight the message bubble when true.
   */
  @property({ type: Boolean })
  highlight: boolean = false;

  /**
   * Preview instance used for annotation files.
   * @internal
   */
  private previewAnnotationsRef: Ref<WyPreview> = createRef();

  /**
   * Preview instance used for attachment files.
   * @internal
   */
  private previewAttachmentsRef: Ref<WyPreview> = createRef();

  /**
   * DOM reference used to scroll highlighted messages into view.
   * @internal
   */
  private highlightRef: Ref<HTMLElement> = createRef();

  /**
   * Emit a `vote` event for the specified poll option.
   *
   * @internal
   * @param optionId - Identifier of the selected poll option.
   * @returns {boolean} True if the event was not canceled.
   */
  private dispatchVote(optionId: number) {
    const event: PollVoteEventType = new (CustomEvent as NamedEvent)("vote", {
      detail: { optionId, parentId: this.messageId },
    });
    return this.dispatchEvent(event);
  }

  protected override willUpdate(changedProperties: PropertyValueMap<this>): void {
    super.willUpdate(changedProperties);

    if (changedProperties.has("link")) {
      this.highlight = Boolean(
        this.link && isEntityChainMatch(this.link, EntityTypeString.Message, { id: this.messageId })
      );
    }
  }

  override render() {
    const images = this.attachments?.filter((a: FileType) => a.kind === "image" && a.thumbnail_url) || [];
    const files = this.attachments?.filter((a: FileType) => a.kind !== "image" || !a.thumbnail_url) || [];

    const dateFull = this.createdAt
      ? new Intl.DateTimeFormat(this.weavy?.locale, { dateStyle: "full", timeStyle: "short" }).format(
          new Date(this.createdAt)
        )
      : "";
    const timeShort = this.createdAt
      ? new Intl.DateTimeFormat(this.weavy?.locale, { timeStyle: "short" }).format(new Date(this.createdAt))
      : "";

    const isOnlyEmojis = !this.annotations?.length && !this.attachments?.length && !this.embed && !this.meeting && !this.pollOptions?.length  && checkOnlyEmojis(this.text)

    return html`
      <div
        part=${partMap({ "wy-message": true, "wy-message-me": this.me, "wy-message-agent": this.isAgent, "wy-highlight": this.highlight })}
        ${ref(this.highlightRef)}
      >
        ${!this.me
          ? html`
              <div part="wy-message-author">
                <wy-avatar
                  .src=${this.avatar}
                  .size=${32}
                  .name=${this.name}
                  .description=${this.comment}
                  .isAgent=${this.isAgent}
                ></wy-avatar>
              </div>
            `
          : ""}

        <div part="wy-message-content">
          <div part="wy-message-meta">
            ${!this.isPrivateChat && !this.me ? html` <span>${this.name} · </span> ` : ""}
            <time datetime=${this.createdAt} title=${dateFull}>${timeShort}</time>
          </div>

          <div part=${partMap({"wy-message-bubble": true, "wy-message-bubble-emoji": isOnlyEmojis})}>
            ${this.messageId < 0
              ? html`<wy-skeleton .text=${this.text}></wy-skeleton>`
              : html`
                  ${images && Boolean(images.length)
                    ? html`<wy-image-grid
                        part="wy-message-bubble-section"
                        .images=${images}
                        @file-open=${(e: FileOpenEventType) => {
                          void this.previewAttachmentsRef.value?.open(e.detail.fileId);
                        }}
                      ></wy-image-grid>`
                    : nothing}


                  <!-- text -->
                  ${this.html ? html`<div part=${partMap({"wy-content": true, "wy-message-bubble-section": true, "wy-content-emoji": isOnlyEmojis})}>${unsafeHTML(this.html)}</div>` : nothing}

                  ${this.annotations && Boolean(this.annotations.length)
                    ? html`<wy-annotation-list
                        part="wy-message-bubble-section"
                        .files=${this.annotations}
                        @file-open=${(e: FileOpenEventType) => {
                          void this.previewAnnotationsRef.value?.open(e.detail.fileId);
                        }}
                      ></wy-annotation-list>`
                    : nothing}

                  ${this.pollOptions && Boolean(this.pollOptions.length)
                    ? html`<wy-poll
                        .pollOptions=${this.pollOptions}
                        @vote=${(e: PollVoteEventType) => this.dispatchVote(e.detail.optionId)}
                      ></wy-poll>`
                    : nothing}

                  ${this.componentFeatures?.allowsFeature(Feature.Embeds) && this.embed
                    ? html` <wy-embed .embed=${this.embed}></wy-embed> `
                    : nothing}

                  ${files && Boolean(files.length)
                    ? html`<wy-attachment-list
                        filled
                        part="wy-message-bubble-section"
                        .files=${files}
                        @file-open=${(e: FileOpenEventType) => {
                          void this.previewAttachmentsRef.value?.open(e.detail.fileId);
                        }}
                      ></wy-attachment-list>`
                    : nothing}

                  ${this.meeting ? html`<wy-meeting-card .meeting=${this.meeting}></wy-meeting-card>` : nothing}

                  ${this.componentFeatures?.allowsFeature(Feature.Reactions) && this.conversation
                    ? html`
                        ${keyed(
                          `reactions-${this.conversation.id}-${this.messageId}`,
                          html`<wy-reactions
                            lineBelow
                            ?lineReverse=${!this.me}
                            small
                            directionX=${this.me ? "right" : "left"}
                            .reactions=${this.reactions}
                            parentId=${this.conversation.id}
                            parentType="apps"
                            entityId=${this.messageId}
                            entityType="messages"
                          ></wy-reactions>`
                        )}
                      `
                    : nothing}
                `}
          </div>
        </div>
      </div>
      ${this.componentFeatures?.allowsFeature(Feature.Receipts)
        ? html`<div part="wy-message-seenby">
            ${this.seenBy && this.seenBy.length
              ? html`
                  ${this.seenBy.map((member: MemberType) => {
                    const dateSeenFull = member.marked_at
                      ? new Intl.DateTimeFormat(this.weavy?.locale, {
                          dateStyle: "full",
                          timeStyle: "short",
                        }).format(new Date(member.marked_at))
                      : "";
                    return html`<wy-avatar
                      title=${msg(str`Seen by ${member.name} at ${dateSeenFull}`)}
                      .name=${member.name}
                      .src=${member.avatar_url}
                      size=${18}
                    ></wy-avatar>`;
                  })}
                `
              : nothing}
          </div>`
        : nothing}
      ${this.annotations
        ? keyed(
            `annotation-preview-message-${this.messageId}`,
            html`
              <wy-preview
                ${ref(this.previewAnnotationsRef)}
                .files=${this.annotations}
                .isAttachment=${true}
              ></wy-preview>
            `
          )
        : nothing}
      ${this.attachments
        ? keyed(
            `preview-message-${this.messageId}`,
            html`
              <wy-preview
                ${ref(this.previewAttachmentsRef)}
                .files=${[...images, ...files]}
                .isAttachment=${true}
              ></wy-preview>
            `
          )
        : nothing}
    `;
  }

  protected override updated(changedProperties: PropertyValueMap<this>) {
    if (changedProperties.has("highlight") && this.highlight) {
      this.highlightRef.value?.scrollIntoView({ block: "nearest" });
    }
  }
}
