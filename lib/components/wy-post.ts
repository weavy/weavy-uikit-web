import { LitElement, html, nothing } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import type { ReactableType } from "../types/reactions.types";
import type { MemberType } from "../types/members.types";
import type { MeetingType } from "../types/meetings.types";
import type { FileType } from "../types/files.types";
import type { EmbedType } from "../types/embeds.types";
import { PollOptionType } from "../types/polls.types";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";

import chatCss from "../scss/all.scss"

import "./wy-post-trashed";
import "./wy-post-view";
import "./wy-post-edit";

@customElement("wy-post")
export default class WyPost extends LitElement {
  
  static override styles = chatCss;

  protected exportParts = new ShadowPartsController(this);

  @property({ type: Number })
  postId!: number;

  // @property({ type: Boolean })
  // temp: boolean = false;

  @property({ attribute: false })
  createdBy!: MemberType;

  @property()
  createdAt: string = "";

  @property()
  modifiedAt: string | undefined = undefined;

  @property({ type: Boolean })
  isSubscribed: boolean = false;

  @property({ type: Boolean })
  isTrashed: boolean = false;

  @property()
  html: string = "";

  @property()
  text: string = "";

  @property()
  plain: string = "";

  @property({ attribute: false })
  attachments?: FileType[] = [];

  @property({ type: Array })
  pollOptions: PollOptionType[] | undefined = [];

  @property({ attribute: false })
  meeting?: MeetingType;

  @property({ attribute: false })
  embed?: EmbedType;

  @property({ type: Array })
  reactions?: ReactableType[] = [];

  @property({ attribute: false })
  commentCount: number = 0;

  @property({ type: Array })
  seenBy: MemberType[] = [];

  @state()
  private editing: boolean = false;

  private dispatchVote(id: number) {
    const event = new CustomEvent("vote", { detail: { id: id, parentId: this.postId, parentType: "posts" } });
    return this.dispatchEvent(event);
  }

  private dispatchSubscribe(subscribe: boolean) {
    const event = new CustomEvent("subscribe", { detail: { id: this.postId, subscribe } });
    return this.dispatchEvent(event);
  }

  private dispatchTrash() {
    const event = new CustomEvent("trash", { detail: { id: this.postId } });
    return this.dispatchEvent(event);
  }

  private dispatchRestore() {
    const event = new CustomEvent("restore", { detail: { id: this.postId } });
    return this.dispatchEvent(event);
  }

  override render() {
    return html`
      ${this.isTrashed
        ? html`<wy-post-trashed
            class="wy-post"
            postId=${this.postId}
            @restore=${() => {
              this.dispatchRestore();
            }}></wy-post-trashed> `
        : nothing}
      ${!this.isTrashed && this.editing
        ? html`<wy-post-edit
            class="wy-post"
            .postId=${this.postId}
            .text=${this.text}
            .embed=${this.embed}
            .pollOptions=${this.pollOptions}
            .attachments=${this.attachments}
            @edit=${(e: CustomEvent) => {
              this.editing = e.detail.edit;
            }}></wy-post-edit> `
        : nothing}
      ${!this.isTrashed && !this.editing
        ? html`<wy-post-view
            id="${this.id}"
            .postId=${this.postId}
            .createdBy=${this.createdBy}
            .createdAt=${this.createdAt}
            .modifiedAt=${this.modifiedAt}
            .isSubscribed=${this.isSubscribed}
            .isTrashed=${this.isTrashed}
            .html=${this.html}
            .text=${this.plain}
            .attachments=${this.attachments ?? []}
            .meeting=${this.meeting}
            .pollOptions=${this.pollOptions}
            .embed=${this.embed}
            .reactions=${this.reactions}
            .commentCount=${this.commentCount}
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
            }}></wy-post-view> `
        : nothing}
    `;
  }
}
