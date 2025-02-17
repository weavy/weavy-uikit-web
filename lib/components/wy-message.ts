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
import type { FileOpenEventType, FileType } from "../types/files.types";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import WeavyPreview from "./wy-preview";
import type { EmbedType } from "../types/embeds.types";
import { PollOptionType } from "../types/polls.types";
import { WeavyComponentConsumerMixin } from "../classes/weavy-component-consumer-mixin";
import { type AppType, EntityTypeString} from "../types/app.types";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { isEntityChainMatch } from "../utils/notifications";
import { partMap } from "../utils/directives/shadow-part-map";

import chatCss from "../scss/all.scss";

import "./wy-avatar";
import "./wy-embed";
import "./wy-icon";
import "./wy-attachment";
import "./wy-image-grid";
import "./wy-attachments-list";
import "./wy-reactions";
import "./wy-meeting-card";
import "./wy-skeleton";
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
  displayName: string = "";

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

  private dispatchVote(id: number) {
    const event = new CustomEvent("vote", { detail: { id: id, parentId: this.messageId } });
    return this.dispatchEvent(event);
  }

  protected override willUpdate(changedProperties: PropertyValues<this>) {
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
                  .name="${this.displayName}"
                  .isBot=${this.isBot}
                ></wy-avatar>
              </div>
            `
          : ""}

        <div class="wy-message-content">
          <div class="wy-message-meta">
            ${!this.isPrivateChat && !this.me ? html` <span>${this.displayName} · </span> ` : ""}
            <time datetime=${this.createdAt} title=${dateFull}>${timeShort}</time>
          </div>

          <div class="wy-message-bubble">
            ${this.messageId < 0
              ? html`<wy-skeleton .text=${this.text}></wy-skeleton>`
              : html`
                  <!-- image grid -->
                  ${images && !!images.length
                    ? html`<wy-image-grid
                        .images=${images}
                        @file-open=${(e: FileOpenEventType) => {
                          this.previewRef.value?.open(e.detail.fileId);
                        }}
                      ></wy-image-grid>`
                    : ``}

                  <!-- embeds -->
                  ${this.embed && this.hasFeatures?.embeds
                    ? html` <wy-embed class="wy-embed" .embed=${this.embed}></wy-embed> `
                    : nothing}

                  <!-- text -->
                  ${this.html ? html`<div class="wy-content">${unsafeHTML(this.html)}</div>` : ``}

                  <!-- poll -->
                  ${this.pollOptions && this.pollOptions.length > 0
                    ? html`
                        <wy-poll
                          .pollOptions=${this.pollOptions}
                          @vote=${(e: CustomEvent) => this.dispatchVote(e.detail.id)}
                        ></wy-poll>
                      `
                    : nothing}

                  <!-- meeting -->
                  ${this.meeting ? html`<wy-meeting-card .meeting=${this.meeting}></wy-meeting-card>` : ``}

                  <!-- files -->
                  ${files && !!files.length
                    ? html`<wy-attachments-list
                        .files=${files}
                        @file-open=${(e: FileOpenEventType) => {
                          this.previewRef.value?.open(e.detail.fileId);
                        }}
                      ></wy-attachments-list>`
                    : ``}

                  <!-- reactions -->
                  ${this.hasFeatures?.reactions && this.conversation
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
      ${this.hasFeatures?.receipts
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
                      title=${msg(str`Seen by ${member.display_name} at ${dateSeenFull}`)}
                      .name=${member.display_name}
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
