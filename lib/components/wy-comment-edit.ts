import { LitElement, html, type PropertyValueMap } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { type WeavyType, WeavyContext } from "../contexts/weavy-context";
import { localized, msg } from "@lit/localize";
import { MutationController } from "../controllers/mutation-controller";
import { getUpdateCommentMutationOptions } from "../data/comments";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";

import type { FileType } from "../types/files.types";
import type { EmbedType } from "../types/embeds.types";
import type { PollOptionType } from "../types/polls.types";
import type { CommentType, MutateCommentProps } from "../types/comments.types";
import type { WeavyProps } from "../types/weavy.types";

import "./base/wy-button";
import "./base/wy-icon";
import "./wy-editor";

import chatCss from "../scss/all.scss"

@customElement("wy-comment-edit")
@localized()
export default class WyCommentEdit extends LitElement {
  
  static override styles = chatCss;

  protected exportParts = new ShadowPartsController(this);

  @consume({ context: WeavyContext, subscribe: true })
  @state()
  private weavy?: WeavyType;

  @property({ type: Number })
  parentId!: number;

  @property({ attribute: false })
  location: "posts" | "files" | "apps" = "apps";

  @property({ type: Number })
  commentId!: number;

  @property()
  text: string = "";

  @property({ type: Array })
  attachments?: FileType[] = [];

  @property({ type: Array })
  pollOptions: PollOptionType[] | undefined = [];

  @property({ attribute: false })
  embed?: EmbedType;

  private updateCommentMutation = new MutationController<
    CommentType,
    Error,
    MutateCommentProps,
    unknown
  >(this);


  private dispatchEdit(edit: boolean) {
    const event = new CustomEvent("edit", { detail: { edit: edit } });
    return this.dispatchEvent(event);
  }

  private handleSubmit(e: CustomEvent) {
    this.updateCommentMutation.mutate({
      id: this.commentId,
      type: this.location,
      parentId: this.parentId,
      text: e.detail.text,
      meetingId: e.detail.meetingId,
      blobs: e.detail.blobs,
      attachments: e.detail.attachments,
      pollOptions: e.detail.pollOptions,
      embedId: e.detail.embed,
    });

    this.dispatchEdit(false);
  }

  override async willUpdate(changedProperties: PropertyValueMap<this & WeavyProps>) {
    if ((changedProperties.has("parentId") || changedProperties.has("weavy")) && this.parentId && this.weavy) {
      this.updateCommentMutation.trackMutation(
        getUpdateCommentMutationOptions(this.weavy, [this.location, this.parentId, "comments"])
      );
    }
  }

  override render() {
    return html`
      <nav class="wy-item">
        <div class="wy-item-body">
          <div class="wy-item-title">${msg("Edit comment")}</div>
        </div>

        <wy-button @click=${() => this.dispatchEdit(false)} kind="icon">
          <wy-icon name="close"></wy-icon>
        </wy-button>
      </nav>
      <wy-editor
        editorLocation=${this.location}
        .text=${this.text}
        .embed=${this.embed}
        .options=${this.pollOptions}
        .attachments=${this.attachments ?? []}
        .parentId=${this.commentId}
        .typing=${false}
        .draft=${false}
        placeholder=${msg("Edit comment...")}
        buttonText=${msg("Update", { desc: "Button action to update" })}
        @submit=${(e: CustomEvent) => this.handleSubmit(e)}></wy-editor>
    `;
  }
}
