import { type PropertyValueMap, html, nothing } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { localized, msg, str } from "@lit/localize";
import { keyed } from "lit/directives/keyed.js";
import type { ReactableType } from "../types/reactions.types";
import type { MemberDetailType } from "../types/members.types";
import type { MeetingType } from "../types/meetings.types";
import type { FileType } from "../types/files.types";
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
import type { UserOrAgentType } from "../types/users.types";
import { WyActionEventType } from "../types/action.events";
import { ActionType } from "../types/action.types";
import { MutationController } from "../controllers/mutation-controller";
import { getReportMutationOptions, MutateReportProps } from "../data/reports";
import { clickOnEnterAndConsumeOnSpace, clickOnSpace } from "../utils/keyboard";
import { ifDefined } from "lit/directives/if-defined.js";

import messagesCss from "../scss/components/messages.scss";
import contentCss from "../scss/components/content.scss";
import hostContentsCss from "../scss/host-contents.scss";
import rebootCss from "../scss/reboot.scss";

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
 * @csspart wy-message-blocked - Modifier for a message whose blocked author's content is held back.
 * @csspart wy-message-report - The report flag in the meta row.
 * @csspart wy-message-report-reported - Modifier once the reader has reported it, carrying no action of its own.
 * @csspart wy-content - HTML/text content area.
 * @csspart wy-content-emoji - Content modifier for emoji-only content.
 * @csspart wy-message-seenby - Seen-by avatars area.
 * @csspart wy-annotations - Wrapper for annotation buttons (from wy-annotation-list).
 * @csspart wy-annotation - Annotation button (from wy-annotation).
 * @csspart wy-annotation-icon - Icon inside an annotation button.
 * @csspart wy-annotation-text - Text inside an annotation button.
 *
 * @fires {PollVoteEventType} vote - Emitted when a poll option is voted.
 * @fires {WyActionEventType} wy-action - Emitted when an entity action is triggered.
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
  @property({ attribute: false, type: Object })
  conversation?: AppType;

  /**
   * Unique identifier for the rendered message.
   */
  @property({ type: Number })
  messageId!: number;

  /**
   * The author of the message.
   */
  @property({ type: Object })
  author!: UserOrAgentType;

  /**
   * True when the message was authored by the current user.
   */
  get me() {
    return this.author.id === this.user?.id;
  }

  /**
   * Render the message using private-conversation layout.
   */
  @property({ type: Boolean })
  isPrivateChat: boolean = false;

  /**
   * True when the viewer has blocked the author of this message.
   *
   * Passed in rather than read from `author.is_blocked`, because a message author never carries that flag -- authors
   * are mapped minimally, and the same payload is broadcast over realtime after being mapped once in the sender's
   * request, so caller-relative fields are left out of it. wy-conversation answers from the viewer's own block list
   * and, where the app has one, its member list.
   */
  @property({ type: Boolean })
  authorIsBlocked: boolean = false;

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
  seenBy: MemberDetailType[] = [];

  /**
   * Highlight the message bubble when true.
   */
  @property({ type: Boolean })
  highlight: boolean = false;

  /**
   * Whether the authenticated user has already reported this message.
   *
   * Kept visible rather than hidden once set: the flag is the only record the reporter ever sees, since weavy stores no
   * report history and exposes no read API. Hosts that would rather reporting be fire-and-forget can hide it with
   * `::part(wy-message-report-reported)` -- shown by default, opt out per integration.
   */
  @property({ type: Boolean })
  reported: boolean = false;

  /**
   * When the authenticated user reported this message, used for the title on the report flag.
   */
  @property()
  reportedAt?: string;

  /**
   * Whether the content of a blocked author's message has been revealed by the reader.
   *
   * Per message and not persisted -- revealing one message says nothing about the next one, and the block itself is
   * unchanged either way.
   *
   * @internal
   */
  @state()
  private revealBlocked: boolean = false;

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
   * @internal
   */
  #reportMutation = new MutationController<void, Error, MutateReportProps, void>(this);

  /**
   * Confirm and report the message for moderation.
   *
   * Uses the native confirm rather than an in-app dialog: reporting cannot be undone and there is no report to look up
   * afterwards, so the interruption is the point.
   *
   * @internal
   */
  private confirmReport() {
    const confirmed = window.confirm(
      msg("Report this message for review? The author is not notified, and reporting cannot be undone."),
    );

    if (confirmed) {
      void this.#reportMutation.mutate({
        entityType: "messages",
        entityId: this.messageId,
        appId: this.conversation?.id,
      });
    }
  }

  /**
   * Emit a `vote` event for the specified poll option.
   *
   * @internal
   * @param optionId - Identifier of the selected poll option.
   * @returns {boolean} True if the event was not canceled.
   */
  private dispatchVote(optionId: number) {
    const event: PollVoteEventType = new (CustomEvent as NamedEvent)("vote", {
      detail: { optionId, parentId: this.messageId, parentType: "messages" },
    });
    return this.dispatchEvent(event);
  }

  protected override willUpdate(changedProperties: PropertyValueMap<this>): void {
    super.willUpdate(changedProperties);

    if (changedProperties.has("link")) {
      this.highlight = Boolean(
        this.link && isEntityChainMatch(this.link, EntityTypeString.Message, { id: this.messageId }),
      );
    }

    if (changedProperties.has("weavy") && this.weavy) {
      void this.#reportMutation.trackMutation(getReportMutationOptions(this.weavy));
    }

    // a fresh block holds the message back again, even if the reader revealed it during an earlier one
    if (changedProperties.has("authorIsBlocked") && this.authorIsBlocked) {
      this.revealBlocked = false;
    }
  }

  override render() {
    const images = this.attachments?.filter((a: FileType) => a.kind === "image" && a.thumbnail_url) || [];
    const files = this.attachments?.filter((a: FileType) => a.kind !== "image" || !a.thumbnail_url) || [];

    const dateFull = this.createdAt
      ? new Intl.DateTimeFormat(this.weavy?.locale, { dateStyle: "full", timeStyle: "short" }).format(
          new Date(this.createdAt),
        )
      : "";
    const timeShort = this.createdAt
      ? new Intl.DateTimeFormat(this.weavy?.locale, { timeStyle: "short" }).format(new Date(this.createdAt))
      : "";

    // same format as the timestamp title beside it, which every other date tooltip in the kit also uses.
    const reportedAtFull = this.reportedAt
      ? new Intl.DateTimeFormat(this.weavy?.locale, { dateStyle: "full", timeStyle: "short" }).format(
          new Date(this.reportedAt),
        )
      : "";
    // "by you" because the flag is caller-relative: it says this reader reported the message, never that anyone else
    // did. Weavy keeps no report counts, so the bare wording would overstate what is known.
    //
    // Falls back to the label without a date when the server sent no timestamp, which is the case for a report patched
    // into the cache by the mutation before the next fetch brings the real one.
    const reportedTitle = this.reportedAt ? msg(str`Reported by you on ${reportedAtFull}`) : msg("Reported by you");

    // Reporting your own message is rejected by the server, and there is nothing to moderate about it anyway.
    // Skeleton messages (negative id) are not on the server yet, so there is nothing to report either.
    const canReport = Boolean(this.componentFeatures?.allowsFeature(Feature.Report) && !this.me && this.messageId > 0);

    // Messages from a blocked user keep their place in a group conversation but hold back what the author wrote, the
    // way Discord and Google Chat do it: hiding the row outright leaves replies pointing at nothing. The message keeps
    // its author, avatar and timestamp; only what the blocked person wrote is held back, so the group stays readable
    // and replies to them still have something to point at.
    //
    // Only in group conversations -- a blocked private chat is held back as a whole, by wy-conversation.
    //
    // Deliberately not gated on Feature.Block: the flag governs whether a block can be *created*, not whether an
    // existing one is honoured. A block that is real server-side -- notifications really are being suppressed --
    // should not become invisible because a host turned the action off.
    const hideBlockedContent = !this.isPrivateChat && this.authorIsBlocked && !this.revealBlocked;

    const isOnlyEmojis =
      !this.annotations?.length &&
      !this.attachments?.length &&
      !this.embed &&
      !this.meeting &&
      !this.pollOptions?.length &&
      checkOnlyEmojis(this.text);

    return html`
      <div
        part=${partMap({
          "wy-message": true,
          "wy-message-me": this.me,
          "wy-message-agent": Boolean(this.author.is_agent),
          "wy-message-blocked": hideBlockedContent,
          "wy-highlight": this.highlight,
        })}
        ${ref(this.highlightRef)}
      >
        ${!this.me
          ? html`
              <div part="wy-message-author">
                <wy-avatar
                  .src=${this.author.avatar_url}
                  .size=${32}
                  .name=${this.author.name}
                  .description=${this.author.comment}
                  .isAgent=${this.author.is_agent}
                  @click=${() => this.dispatchAction({ action: ActionType.Preview, user: this.author })}
                  role="button"
                  title="${this.author.name} ${this.author.comment}"
                ></wy-avatar>
              </div>
            `
          : ""}

        <div part="wy-message-content">
          <div part="wy-message-meta">
            ${!this.isPrivateChat && !this.me
              ? html`<span
                  ><wy-button
                    kind="link"
                    @click=${() => this.dispatchAction({ action: ActionType.Preview, user: this.author })}
                    >${this.author.name}</wy-button
                  >
                  ·
                </span> `
              : ""}
            <time datetime=${this.createdAt} title=${dateFull}>${timeShort}</time>
            <!-- both icons in this row are sized down from the text-icon default, which is scaled for wy-item-text -->
            ${canReport || this.reported
              ? html`
                  <span
                    part=${partMap({
                      "wy-message-report": true,
                      "wy-message-report-reported": this.reported,
                    })}
                    title=${this.reported ? reportedTitle : msg("Report message")}
                    role=${ifDefined(this.reported ? undefined : "button")}
                    tabindex=${ifDefined(this.reported ? undefined : 0)}
                    @click=${() => !this.reported && this.confirmReport()}
                    @keydown=${clickOnEnterAndConsumeOnSpace}
                    @keyup=${clickOnSpace}
                  >
                    <wy-icon inline name=${this.reported ? "flag" : "flag-outline"} size=${14}></wy-icon>
                  </span>
                `
              : nothing}
          </div>

          <div part=${partMap({ "wy-message-bubble": true, "wy-message-bubble-emoji": isOnlyEmojis })}>
            ${this.messageId < 0
              ? html`<wy-skeleton .text=${this.text}></wy-skeleton>`
              : hideBlockedContent
                ? html`
                    <div part="wy-message-bubble-section">
                      <wy-button kind="link" color="variant" @click=${() => (this.revealBlocked = true)}>${msg("Show message from blocked user.")}</wy-button>
                    </div>
                  `
                : html`
                    ${images && Boolean(images.length)
                      ? html`<wy-image-grid
                          part="wy-message-bubble-section"
                          .images=${images}
                          @wy-action=${(e: WyActionEventType) => {
                            if (e.detail.action === ActionType.Preview && e.detail.file) {
                              void this.previewAttachmentsRef.value?.open(e.detail.file.id);
                            }
                          }}
                        ></wy-image-grid>`
                      : nothing}

                    <!-- text -->
                    ${this.html
                      ? html`<div
                          part=${partMap({
                            "wy-content": true,
                            "wy-message-bubble-section": true,
                            "wy-content-emoji": isOnlyEmojis,
                          })}
                          @click=${(e: MouseEvent) => {
                            if (
                              e.target instanceof HTMLElement &&
                              e.target.matches('.wy-mention, [part~="wy-mention"]')
                            ) {
                              const uid =
                                e.target.dataset.eid?.startsWith("u") && parseInt(e.target.dataset.eid.substring(1));
                              if (uid) {
                                this.dispatchAction({
                                  action: ActionType.Preview,
                                  user: { id: uid, name: e.target.innerText },
                                });
                              }
                            }
                          }}
                          >${
                            // eslint-disable-next-line lit-a11y/click-events-have-key-events
                            unsafeHTML(this.html)
                          }</div
                        >`
                      : nothing}
                    ${this.annotations && Boolean(this.annotations.length)
                      ? html`<wy-annotation-list
                          part="wy-message-bubble-section"
                          .files=${this.annotations}
                          @wy-action=${(e: WyActionEventType) => {
                            if (e.detail.action === ActionType.Preview && e.detail.file) {
                              void this.previewAnnotationsRef.value?.open(e.detail.file.id);
                            }
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
                          @wy-action=${(e: WyActionEventType) => {
                            if (e.detail.action === ActionType.Preview && e.detail.file) {
                              void this.previewAttachmentsRef.value?.open(e.detail.file.id);
                            }
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
                            ></wy-reactions>`,
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
                  ${this.seenBy.map((member: MemberDetailType) => {
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
            `,
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
            `,
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
