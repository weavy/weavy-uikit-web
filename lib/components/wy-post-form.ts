import { localized, msg } from "@lit/localize";
import { type PropertyValueMap, html, nothing } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { MutationController } from "../controllers/mutation-controller";
import { getAddPostMutationOptions } from "../data/posts";
import { PermissionType } from "../types/app.types";
import type { MutatePostProps, PostType, MutatePostTempData } from "../types/posts.types";
import { hasAnyPermission } from "../utils/permission";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { WeavySubAppComponent } from "../classes/weavy-sub-app-component";
import type { MsgEditorSubmitEventType } from "../types/editor.events";
import { property } from "lit/decorators.js";

import postsCss from "../scss/components/post.scss";
import headerCss from "../scss/components/header.scss";
import pagerCss from "../scss/components/pager.scss";
import hostContentsCss from "../scss/host-contents.scss";

import "./wy-editor-msg";
import "./wy-empty";
import "./wy-post";
import "./ui/wy-progress-circular";
import "./wy-context-data";

declare global {
  interface HTMLElementTagNameMap {
    "wy-post-form": WyPostForm;
  }
}

/**
 * List container rendering a post editor and a paginated feed of posts.
 *
 * **Used sub components:**
 *
 * - [`<wy-editor-msg>`](./wy-editor-msg.ts)
 * - [`<wy-dropdown>`](./ui/wy-dropdown.ts)
 * - [`<wy-dropdown-option>`](./ui/wy-dropdown.ts)
 * - [`<wy-icon>`](./ui/wy-icon.ts)
 * - [`<wy-context-data-progress>`](./ui/wy-context-data.ts)
 * 
 * @slot actions - Extra buttons.
 *
 * @csspart wy-posts-header - Root post editor container.
 */
@customElement("wy-post-form")
@localized()
export class WyPostForm extends WeavySubAppComponent {
  static override styles = [postsCss, headerCss, pagerCss, hostContentsCss];

  /** @internal */
  protected exportParts = new ShadowPartsController(this);

  /**
   * Placeholder text shown in the post editor input.
   */
  @property()
  placeholder?: string;

  /**
   * Mutation used when creating new posts.
   *
   * @internal
   */
  private addPostMutation = new MutationController<PostType, Error, MutatePostProps, MutatePostTempData>(this);

  /**
   * Handle editor submissions by dispatching the create-post mutation.
   *
   * @param e - Submitted editor data.
   */
  private async handleSubmit(e: MsgEditorSubmitEventType) {
    const app = await this.whenApp();
    const user = await this.whenUser();

    void this.addPostMutation.mutate({
      app_id: app.id,
      text: e.detail.text,
      meeting_id: e.detail.meetingId,
      blobs: e.detail.blobs,
      poll_options: e.detail.pollOptions,
      embed_id: e.detail.embedId,
      user: user,
      context: e.detail.contextData,
    });
  }

  override async willUpdate(changedProperties: PropertyValueMap<this>): Promise<void> {
    super.willUpdate(changedProperties);

    if (
      (changedProperties.has("weavy") || changedProperties.has("app") || changedProperties.has("componentFeatures")) &&
      this.weavy &&
      this.app &&
      this.app?.id !== changedProperties.get("app")?.id
    ) {
      await this.addPostMutation.trackMutation(getAddPostMutationOptions(this.weavy, ["posts", this.app.id]));
    }
  }

  override render() {
    return html`
      <div part="wy-posts-header">
        <wy-editor-msg
          editorLocation="apps"
          ?disabled=${!hasAnyPermission([PermissionType.Create, PermissionType.Admin], this.app?.permissions)}
          .typing=${false}
          .draft=${true}
          placeholder=${this.placeholder ?? msg("Create a post...")}
          buttonText=${msg("Post")}
          @submit=${(e: MsgEditorSubmitEventType) => this.handleSubmit(e)}
        >
          <slot name="actions" slot="actions"></slot>

          ${this.apps && this.apps.length > 1
            ? html`
                <wy-dropdown slot="inputs">
                  ${this.apps.map(
                    (app) => html`
                      ${app.id === this.apps?.current?.id
                        ? html`<label slot="button-content">${app.name}</label>`
                        : nothing}
                      <wy-dropdown-option
                        ?selected=${app.id === this.apps?.current?.id}
                        @click="${() => {
                          if (this.apps) {
                            this.apps.current = app;
                          }
                        }}"
                        >${app.name}</wy-dropdown-option
                      >
                    `,
                  )}
                  <wy-icon last slot="button-content" name="menu-down"></wy-icon>
                </wy-dropdown>
              `
            : nothing}
        </wy-editor-msg>
        <wy-context-data-progress></wy-context-data-progress>
      </div>
    `;
  }
}
