import { LitElement, PropertyValues, html, nothing } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { localized, msg, str } from "@lit/localize";
import { keyed } from "lit/directives/keyed.js";
import type { ReactableType } from "../types/reactions.types";
import type { MemberType } from "../types/members.types";
import type { MeetingType } from "../types/meetings.types";
import type { FileType } from "../types/files.types";
import type { FileOpenEventType } from "../types/files.events";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import WeavyPreview from "./wy-preview";
import type { EmbedType } from "../types/embeds.types";
import { PollOptionType } from "../types/polls.types";
import { WeavyComponentConsumerMixin } from "../classes/weavy-component-consumer-mixin";
import { type AppType, EntityTypeString} from "../types/app.types";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { isEntityChainMatch } from "../utils/notifications";
import { partMap } from "../utils/directives/shadow-part-map";
import { Feature } from "../types/features.types";
import { PollVoteEventType } from "../types/polls.events";
import { NamedEvent } from "../types/generic.types";

import chatCss from "../scss/all.scss";

import "./base/wy-avatar";
import "./wy-embed";
import "./base/wy-icon";
import "./wy-attachment";
import "./base/wy-image-grid";
import "./wy-attachments-list";
import "./base/wy-reactions";
import "./wy-meeting-card";
import "./base/wy-skeleton";
import "./wy-preview";
import "./wy-poll";

@customElement("wy-message")
@localized()
export default class WyMessage extends WeavyComponentConsumerMixin(LitElement) {
  static override styles = chatCss;

  protected exportParts = new ShadowPartsController(this);

  @property({ attribute: false })
  conversation?: AppType;

  @property({ type: Number })
  messageId!: number;

  @property({ type: Boolean })
  me: boolean = false;

  @property({ type: Boolean })
  isBot: boolean = false;

  @property({ type: Boolean })
  isPrivateChat: boolean = false;

  @property()
  name: string = "";

  @property()
  avatar?: string = "";

  @property()
  createdAt: string = "";

  @property()
  html: string = "";

  @property()
  text: string = "";

  @property({ type: Array })
  attachments?: FileType[] = [];

  @property({ attribute: false })
  meeting?: MeetingType;

  @property({ type: Array })
  pollOptions: PollOptionType[] | undefined = [];

  @property({ attribute: false })
  embed?: EmbedType;

  @property({ type: Array })
  reactions?: ReactableType[] = [];

  @property({ type: Array })
  seenBy: MemberType[] = [];

  @property({ type: Boolean })
  highlight: boolean = false;

  private previewRef: Ref<WeavyPreview> = createRef();
  private highlightRef: Ref<HTMLElement> = createRef();

  private dispatchVote(optionId: number) {
    const event: PollVoteEventType = new (CustomEvent as NamedEvent)("vote", { detail: { optionId, parentId: this.messageId } });
    return this.dispatchEvent(event);
  }

  protected override willUpdate(changedProperties: PropertyValues<this>): void {
    super.willUpdate(changedProperties);
    
    if (changedProperties.has("link")) {
      this.highlight = Boolean(this.link && isEntityChainMatch(this.link, EntityTypeString.Message, { id: this.messageId }));
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

    return html`
      <div
        class=${classMap({ "wy-message": true, "wy-message-me": this.me, "wy-message-bot": this.isBot })}
        part=${partMap({ "wy-highlight": this.highlight })}
        ${ref(this.highlightRef)}
      >
        ${!this.me
          ? html`
              <div class="wy-message-author">
                <wy-avatar
                  .src="${this.avatar}"
                  .size=${32}
                  .name="${this.name}"
                  .isBot=${this.isBot}
                ></wy-avatar>
              </div>
            `
          : ""}

        <div class="wy-message-content">
          <div class="wy-message-meta">
            ${!this.isPrivateChat && !this.me ? html` <span>${this.name} · </span> ` : ""}
            <time datetime=${this.createdAt} title=${dateFull}>${timeShort}</time>
          </div>

          <div class="wy-message-bubble">
            ${this.messageId < 0
              ? html`<wy-skeleton .text=${this.text}></wy-skeleton>`
              : html`
                  <!-- image grid -->
                  ${images && !!images.length
                    ? html`<wy-image-grid
                        class="wy-message-area"
                        .images=${images}
                        @file-open=${(e: FileOpenEventType) => {
                          void this.previewRef.value?.open(e.detail.fileId);
                        }}
                      ></wy-image-grid>`
                    : ``}

                  <!-- embeds -->
                  ${this.componentFeatures?.allowsFeature(Feature.Embeds) && this.embed
                    ? html` <wy-embed class="wy-embed" .embed=${this.embed}></wy-embed> `
                    : nothing}

                  <!-- text -->
                  ${this.html ? html`<div class="wy-content">${unsafeHTML(this.html)}</div>` : ``}

                  <!-- poll -->
                  ${this.pollOptions && this.pollOptions.length > 0
                    ? html`
                        <wy-poll
                          .pollOptions=${this.pollOptions}
                          @vote=${(e: PollVoteEventType) => this.dispatchVote(e.detail.optionId)}
                        ></wy-poll>
                      `
                    : nothing}

                  <!-- meeting -->
                  ${this.meeting ? html`<wy-meeting-card .meeting=${this.meeting}></wy-meeting-card>` : ``}

                  <!-- files -->
                  ${files && !!files.length
                    ? html`<wy-attachments-list
                        class="wy-message-area"
                        .files=${files}
                        @file-open=${(e: FileOpenEventType) => {
                          void this.previewRef.value?.open(e.detail.fileId);
                        }}
                      ></wy-attachments-list>`
                    : ``}

                  <!-- reactions -->
                  ${this.componentFeatures?.allowsFeature(Feature.Reactions) && this.conversation
                    ? html`
                        ${keyed(
                          `reactions-${this.conversation.id}-${this.messageId}`,
                          html`
                            <wy-reactions
                              lineBelow
                              ?lineReverse=${!this.me}
                              small
                              directionX=${this.me ? "right" : "left"}
                              .reactions=${this.reactions}
                              parentId=${this.conversation.id}
                              parentType="apps"
                              entityId=${this.messageId}
                              entityType="messages"
                            ></wy-reactions>
                          `
                        )}
                      `
                    : nothing}
                `}
          </div>
        </div>
      </div>
      ${this.componentFeatures?.allowsFeature(Feature.Receipts)
        ? html`<div class="wy-readby-status">
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
      ${this.attachments
        ? keyed(
            `preview-message-${this.messageId}`,
            html`
              <wy-preview
                ${ref(this.previewRef)}
                .files=${[...images, ...files]}
                .isAttachment=${true}
              ></wy-preview>
            `
          )
        : nothing}
    `;
  }

  protected override updated(changedProperties: PropertyValues<this>) {
      if (changedProperties.has("highlight") && this.highlight) {
        this.highlightRef.value?.scrollIntoView({ block: "nearest" })
      } 
  }
}
