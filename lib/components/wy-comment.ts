import { LitElement, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import type { ReactableType } from "../types/reactions.types";
import type { MemberType } from "../types/members.types";
import type { MeetingType } from "../types/meetings.types";
import type { FileType } from "../types/files.types";
import type { EmbedType } from "../types/embeds.types";
import { type FeaturesConfigType, type FeaturesListType } from "../types/features.types";
import { PollOptionType } from "../types/polls.types";

import chatCss from "../scss/all.scss";

import type { AppType } from "../types/app.types";
import type { UserType } from "../types/users.types";

import "./wy-comment-trashed";
import "./wy-comment-view";
import "./wy-comment-edit";

@customElement("wy-comment")
export default class WyComment extends LitElement {
  
  static override styles = chatCss;
  
  @property({ attribute: false })
  app!: AppType;

  @property({ attribute: false })
  user!: UserType;

  @property({ type: Number })
  commentId!: number;

  @property({ type: Number })
  parentId!: number;

  @property({ type: Boolean })
  temp: boolean = false;

  @property({ attribute: false })
  createdBy!: MemberType;

  @property()
  createdAt: string = "";

  @property()
  modifiedAt: string | undefined = undefined;

  @property({ type: Boolean })
  isTrashed: boolean = false;

  @property()
  html: string = "";

  @property()
  text: string = "";

  @property({ attribute: false })
  attachments: FileType[] = [];

  @property({ type: Array })
  pollOptions: PollOptionType[] | undefined = [];

  @property({ attribute: false })
  meeting?: MeetingType;

  @property({ attribute: false })
  embed?: EmbedType;

  @property({ type: Array })
  reactions: ReactableType[] = [];

  @property({ attribute: false })
  commentCount: number = 0;

  @property({ type: Array })
  seenBy: MemberType[] = [];

  @property({ type: Object })
  features?: FeaturesConfigType = {};

  @property({ type: Array })
  availableFeatures?: FeaturesListType;

  @state()
  private editing: boolean = false;


  private dispatchVote(id: number) {
    const event = new CustomEvent("vote", { detail: { id: id, parentId: this.commentId, parentType: "comments" } });
    return this.dispatchEvent(event);
  }

  private dispatchSubscribe(subscribe: boolean) {
    const event = new CustomEvent("subscribe", { detail: { id: this.commentId, subscribe } });
    return this.dispatchEvent(event);
  }

  private dispatchTrash() {
    const event = new CustomEvent("trash", { detail: { id: this.commentId } });
    return this.dispatchEvent(event);
  }

  private dispatchRestore() {
    const event = new CustomEvent("restore", { detail: { id: this.commentId } });
    return this.dispatchEvent(event);
  }

  override render() {
    return html`
      ${this.isTrashed
        ? html`<wy-comment-trashed
            class="wy-comment"
            commentId=${this.commentId}
            @restore=${() => {
              this.dispatchRestore();
            }}></wy-comment-trashed> `
        : nothing}
      ${!this.isTrashed && this.editing
        ? html`<wy-comment-edit
            class="wy-comment"
            .app=${this.app}
            .user=${this.user}
            .commentId=${this.commentId}
            .parentId=${this.parentId}
            .availableFeatures=${this.availableFeatures}
            .features=${this.features}
            .text=${this.text}
            .pollOptions=${this.pollOptions}
            .attachments=${this.attachments}
            .embed=${this.embed}
            @edit=${(e: CustomEvent) => {
              this.editing = e.detail.edit;
            }}></wy-comment-edit> `
        : nothing}
      ${!this.isTrashed && !this.editing
        ? html`<wy-comment-view
            class="wy-comment"
            id="${this.id}"
            .app=${this.app}
            .user=${this.user}
            .commentId=${this.commentId}
            .parentId=${this.parentId}
            .temp=${this.temp}
            .createdBy=${this.createdBy}
            .createdAt=${this.createdAt}
            .modifiedAt=${this.modifiedAt}
            .isTrashed=${this.isTrashed}
            .html=${this.html}
            .attachments=${this.attachments}
            .embed=${this.embed}
            .meeting=${this.meeting}
            .pollOptions=${this.pollOptions}
            .reactions=${this.reactions}
            .availableFeatures=${this.availableFeatures}
            .features=${this.features}
            @edit=${(e: CustomEvent) => {
              this.editing = e.detail.edit;
            }}
            @subscribe=${(e: CustomEvent) => {
              this.dispatchSubscribe(e.detail.subscribe);
            }}
            @trash=${() => {
              this.dispatchTrash();
            }}
            @vote=${(e: CustomEvent) => {
              this.dispatchVote(e.detail.id);
            }}></wy-comment-view> `
        : nothing}
    `;
  }
}
