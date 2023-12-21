import { LitElement, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { hasFeature } from "../utils/features";
import { localized, msg, str } from "@lit/localize";

import type { ReactableType } from "../types/reactions.types";
import type { MemberType } from "../types/members.types";
import type { MeetingType } from "../types/meetings.types";
import type { FileType } from "../types/files.types";
import { Feature, type FeaturesConfigType, type FeaturesListType } from "../types/features.types";
import { consume } from "@lit/context";
import { type WeavyContext, weavyContextDefinition } from "../client/context-definition";

import chatCss from "../scss/all.scss";
import type { AppType } from "../types/app.types";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import WeavyPreview from "./wy-preview";
import type { EmbedType } from "../types/embeds.types";

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

@customElement("wy-message")
@localized()
export default class WyMessage extends LitElement {
  
  static override styles = chatCss;

  @consume({ context: weavyContextDefinition, subscribe: true })
  @state()
  private weavyContext?: WeavyContext;

  @property({ type: Object })
  app!: AppType;

  @property({ type: Number })
  messageId!: number;

  @property({ type: Boolean })
  me: boolean = false;

  @property({ type: Boolean })
  chatRoom: boolean = false;

  @property({ type: Boolean })
  temp: boolean = false;

  @property({ type: Boolean })
  sent?: boolean | null = null;

  @property({ type: Boolean })
  delivered?: boolean | null = null;

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
  attachments: FileType[] = [];

  @property({ attribute: false })
  meeting?: MeetingType;

  @property({ attribute: false })
  embed?: EmbedType;

  @property({ type: Array })
  reactions: ReactableType[] = [];

  @property({ type: Array })
  seenBy: MemberType[] = [];

  @property({ type: Number })
  userId: number = -1;

  @state()
  availableFeatures?: FeaturesListType;

  @property({ type: Object })
  features?: FeaturesConfigType = {};

  private previewRef: Ref<WeavyPreview> = createRef();

  override render() {
    const images = this.attachments?.filter((a: FileType) => a.kind === "image" && a.thumbnail_url);
    const files = this.attachments?.filter((a: FileType) => a.kind !== "image" || !a.thumbnail_url);

    const dateFull = this.createdAt
      ? new Intl.DateTimeFormat(this.weavyContext?.locale, { dateStyle: "full", timeStyle: "short" }).format(
          new Date(this.createdAt)
        )
      : "";
    const timeShort = this.createdAt
      ? new Intl.DateTimeFormat(this.weavyContext?.locale, { timeStyle: "short" }).format(new Date(this.createdAt))
      : "";

    return html`
      <div class=${classMap({ "wy-message": true, "wy-message-me": this.me })}>
        ${!this.me
          ? html`
              <div class="wy-message-author">
                <wy-avatar .src="${this.avatar}" .size=${32} .name="${this.displayName}"></wy-avatar>
              </div>
            `
          : ""}

        <div class="wy-message-content">
          <div class="wy-message-meta">
            ${this.chatRoom && !this.me ? html` <span>${this.displayName} · </span> ` : ""}
            <time datetime=${this.createdAt} title=${dateFull}>${timeShort}</time>
          </div>

          <div class="wy-message-bubble">
            ${this.temp
              ? html`<wy-skeleton .text=${this.text}></wy-skeleton>`
              : html`
                  <!-- image grid -->
                  ${images && !!images.length
                    ? html`<wy-image-grid
                        .images=${images}
                        @file-open=${(e: CustomEvent) => {
                          this.previewRef.value?.open(e.detail.file);
                        }}></wy-image-grid>`
                    : ``}

                  <!-- embeds -->
                  ${this.embed && hasFeature(this.availableFeatures, Feature.Embeds, this.features?.embeds)
                    ? html` <wy-embed class="wy-embed" .embed=${this.embed}></wy-embed> `
                    : nothing}

                  <!-- text -->
                  ${this.html ? html`<div class="wy-content">${unsafeHTML(this.html)}</div>` : ``}

                  <!-- meeting -->
                  ${this.meeting ? html`<wy-meeting-card .meeting=${this.meeting}></wy-meeting-card>` : ``}

                  <!-- files -->
                  ${files && !!files.length
                    ? html`<wy-attachments-list
                        .files=${files}
                        @file-open=${(e: CustomEvent) => {
                          this.previewRef.value?.open(e.detail.file);
                        }}></wy-attachments-list>`
                    : ``}

                  <!-- reactions -->
                  <div class="wy-reactions-line">
                    <wy-reactions
                      small
                      .hasFeature=${hasFeature(this.availableFeatures, Feature.Reactions, this.features?.reactions)}
                      .reactions=${this.reactions}
                      parentId=${this.app.id}
                      entityId=${this.messageId}
                      messageType="messages"
                      .userId=${this.userId}></wy-reactions>
                  </div>
                `}
          </div>
        </div>
      </div>
      ${hasFeature(this.availableFeatures, Feature.Receipts, this.features?.receipts)
        ? html`<div class="wy-readby-status">
            ${this.seenBy && this.seenBy.length
              ? html`
                  ${this.seenBy.map((member: MemberType) => {
                    const dateSeenFull =
                      member.marked_at
                        ? new Intl.DateTimeFormat(this.weavyContext?.locale, {
                            dateStyle: "full",
                            timeStyle: "short",
                          }).format(new Date(member.marked_at))
                        : "";
                    return html`<wy-avatar
                      title=${msg(str`Seen by ${member.display_name} at ${dateSeenFull}`)}
                      .name=${member.display_name}
                      .src=${member.avatar_url}
                      size=${16}></wy-avatar>`;
                  })}
                `
              : this.delivered === true
              ? html`<wy-icon title="Delivered" class="wy-status-delivered" name="check-circle"></wy-icon>`
              : this.sent === true
              ? html`<wy-icon title="Sent" class="wy-status-sent" name="check-circle-outline"></wy-icon>`
              : this.sent === false
              ? html`<wy-icon title="Pending" class="wy-status-pending" name="circle-outline"></wy-icon>`
              : nothing}
          </div>`
        : nothing}
      ${this.attachments
        ? html`
            <wy-preview
              ${ref(this.previewRef)}
              .uid=${`message-${this.messageId}`}
              .app=${this.app}
              .files=${[...images, ...files]}
              .availableFeatures=${this.availableFeatures}
              .features=${this.features}
              .isAttachment=${true}></wy-preview>
          `
        : nothing}
    `;
  }
}
