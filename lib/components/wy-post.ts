import { PropertyValueMap, html, nothing } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import {
  PostEditEventType,
  PostRestoreEventType,
  PostSubscribeEventType,
  PostTrashEventType,
} from "../types/posts.events";
import { PollVoteEventType } from "../types/polls.events";
import { NamedEvent } from "../types/generic.types";
import type { PostType } from "../types/posts.types";
import { AppContext, type AppType } from "../contexts/apps-context";
import { provide } from "@lit/context";
import { toIntOrString } from "../converters/string";
import { WeavySubTypeComponent } from "../classes/weavy-sub-type-component";
import { QueryController } from "../controllers/query-controller";
import { getAppOptions } from "../data/app";
import { RealtimeController } from "../controllers/realtime-controller";
import { getRealtimePostOptions } from "../data/posts";

import rebootCss from "../scss/reboot.scss";

import "./wy-post-trashed";
import "./wy-post-view";
import "./wy-post-edit";

declare global {
  interface HTMLElementTagNameMap {
    "wy-post": WyPost;
  }
}

/**
 * Wrapper component for a single post, delegating rendering to view/edit/trashed subcomponents.
 *
 * **Used sub components:**
 *
 * - [`<wy-post-trashed>`](./wy-post-trashed.ts)
 * - [`<wy-post-edit>`](./wy-post-edit.ts)
 * - [`<wy-post-view>`](./wy-post-view.ts)
 *
 * @fires {PollVoteEventType} vote - Emitted when a poll option is voted.
 * @fires {PostSubscribeEventType} subscribe - Emitted when subscribe/unsubscribe is requested.
 * @fires {PostTrashEventType} trash - Emitted when the post should be trashed.
 * @fires {PostRestoreEventType} restore - Emitted when the post should be restored.
 * @fires {WyActionEventType} wy-action - Emitted when an embed action button is triggered.
 * @fires {WyPreviewOpenEventType} wy-preview-open - Fired when a preview overlay is about to open.
 * @fires {WyPreviewCloseEventType} wy-preview-close - Fired when a preview overlay is closed.
 */
@customElement("wy-post")
export class WyPost extends WeavySubTypeComponent {
  static override styles = [rebootCss];

  /** @internal */
  protected exportParts = new ShadowPartsController(this);

  /**
   * Realtime controller, used when post is out of app context.
   *
   * @internal
   */
  protected postRealtime = new RealtimeController(this);

  /**
   * Post data
   */
  @property({ attribute: false })
  post!: PostType;

  /**
   * The app data. Must be directly specified or by using the `uid` property.
   *
   * @type {AppType | undefined}
   */
  @provide({ context: AppContext })
  @state()
  app: AppType | undefined;

  /** Optional appId to specify post specific app context */
  @property({ converter: toIntOrString })
  uid?: number | string | null;

  /**
   * Placeholder text for the comment editor input.
   */
  @property()
  placeholder?: string;

  /**
   * Resolves when app data is available.
   *
   * @returns {Promise<AppType>}
   */
  async whenApp() {
    return await this.#whenApp;
  }
  #resolveApp?: (app: AppType) => void;
  #whenApp = new Promise<AppType>((r) => {
    this.#resolveApp = r;
  });

  #appQuery = new QueryController<AppType>(this);

  /**
   * True while the post is displayed in edit mode.
   *
   * @internal
   */
  @state()
  private editing: boolean = false;

  /**
   * Emit a `vote` event scoped to the post.
   *
   * @internal
   * @param optionId - Identifier of the selected poll option.
   * @returns {boolean} True if the event was not canceled.
   */
  private dispatchVote(optionId: number) {
    const event: PollVoteEventType = new (CustomEvent as NamedEvent)("vote", {
      detail: { optionId, parentId: this.post.id, parentType: "posts" },
    });
    return this.dispatchEvent(event);
  }

  /**
   * Emit a `subscribe` event toggling post subscription.
   *
   * @internal
   * @param subscribe - Desired subscription state.
   * @returns {boolean} True if the event was not canceled.
   */
  private dispatchSubscribe(subscribe: boolean) {
    const event: PostSubscribeEventType = new (CustomEvent as NamedEvent)("subscribe", {
      detail: { id: this.post.id, subscribe },
    });
    return this.dispatchEvent(event);
  }

  /**
   * Emit a `trash` event requesting the post to be trashed.
   *
   * @internal
   * @returns {boolean} True if the event was not canceled.
   */
  private dispatchTrash() {
    const event: PostTrashEventType = new (CustomEvent as NamedEvent)("trash", { detail: { id: this.post.id } });
    return this.dispatchEvent(event);
  }

  /**
   * Emit a `restore` event requesting the post to be restored.
   *
   * @internal
   * @returns {boolean} True if the event was not canceled.
   */
  private dispatchRestore() {
    const event: PostRestoreEventType = new (CustomEvent as NamedEvent)("restore", { detail: { id: this.post.id } });
    return this.dispatchEvent(event);
  }

  protected override willUpdate(changedProperties: PropertyValueMap<this>) {
    if (changedProperties.has("uid") || changedProperties.has("weavy")) {
      if (this.uid && this.weavy) {
        void this.#appQuery.trackQuery(getAppOptions(this.weavy, this.uid));
      } else {
        this.#appQuery.untrackQuery();
      }
    }

    if (!this.#appQuery.result?.isPending) {
      this.app = this.#appQuery.result?.data;
    }

    if (changedProperties.has("app") && this.app) {
      if (changedProperties.get("app")) {
        // reset promise
        this.#whenApp = new Promise<AppType>((r) => {
          this.#resolveApp = r;
        });
      }
      this.#resolveApp?.(this.app);
    }
  }

  override render() {
    return html`
      ${this.post.is_trashed
        ? html`<wy-post-trashed
            id=${`post-trashed-${this.post.id}`}
            .post=${this.post}
            @restore=${() => {
              this.dispatchRestore();
            }}
          ></wy-post-trashed> `
        : nothing}
      ${!this.post.is_trashed && this.editing
        ? html`<wy-post-edit
            id=${`post-edit-${this.post.id}`}
            .post=${this.post}
            @edit=${(e: PostEditEventType) => {
              this.editing = e.detail.edit;
            }}
          ></wy-post-edit> `
        : nothing}
      ${!this.post.is_trashed && !this.editing
        ? html`<wy-post-view
            id=${`post-view-${this.post.id}`}
            .placeholder=${this.placeholder}
            .post=${this.post}
            @edit=${(e: PostEditEventType) => {
              this.editing = e.detail.edit;
            }}
            @subscribe=${(e: PostSubscribeEventType) => {
              this.dispatchSubscribe(e.detail.subscribe);
            }}
            @trash=${() => {
              this.dispatchTrash();
            }}
            @vote=${(e: PollVoteEventType) => {
              this.dispatchVote(e.detail.optionId);
            }}
          ></wy-post-view> `
        : nothing}
    `;
  }

  protected override updated(changedProperties: PropertyValueMap<this>): void {
    // Only enabled when `uid` is set
    if (
      (changedProperties.has("weavy") ||
        changedProperties.has("app") ||
        changedProperties.has("uid") ||
        changedProperties.has("componentFeatures") ||
        changedProperties.has("user")) &&
      this.weavy &&
      this.uid &&
      this.app &&
      this.app?.id !== changedProperties.get("app")?.id &&
      this.componentFeatures &&
      this.user
    ) {
      void this.postRealtime.track(
        getRealtimePostOptions(this.weavy, this.componentFeatures, this.app, this.user, this.post),
      );
    }
  }
}
