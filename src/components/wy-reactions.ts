import { LitElement, html, nothing, css, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { consume } from "@lit/context";
import { portal } from "lit-modal-portal";
import { type WeavyContext, weavyContextDefinition } from "../client/context-definition";
import { localized, msg, str } from "@lit/localize";

import { type Placement as PopperPlacement, type Instance as PopperInstance, createPopper } from "@popperjs/core";
import type { ReactableType, ReactionsResult } from "../types/reactions.types";
import {
  addReactionMutation,
  getReactionListOptions,
  removeReactionMutation,
  replaceReactionMutation,
} from "../data/reactions";

import chatCss from "../scss/all.scss";
import { QueryController } from "../controllers/query-controller";

import "./wy-spinner";
import "./wy-reaction-item";
import "./wy-button";
import "./wy-sheet";
import "./wy-icon";
import { WeavyContextProps } from "src/types/weavy.types";

@customElement("wy-reactions")
@localized()
export default class WyReactions extends LitElement {
  
  static override styles = [
    chatCss,
    css`
      :host {
        display: contents;
      }
    `,
  ];

  @state()
  reactedEmoji: string | undefined;

  @consume({ context: weavyContextDefinition, subscribe: true })
  @state()
  private weavyContext?: WeavyContext;

  @property()
  directionX: "left" | "right" = "left";

  @property()
  directionY: "up" | "down" = "up";

  @property({ type: Boolean })
  small = false;

  @property({ attribute: false })
  reactions: ReactableType[] = [];

  @state()
  private _placement: PopperPlacement = "bottom-start";

  @property({ attribute: false })
  emojis: string[] = [];

  @property({ attribute: false })
  visible: boolean = false;

  @property({ attribute: false })
  hasFeature: boolean = true;

  @property({ attribute: true, type: String })
  messageType: "messages" | "posts" | "comments" = "messages";

  @property({ attribute: true, type: Number })
  parentId?: number;

  @property({ attribute: true, type: Number })
  entityId!: number;

  @property({ attribute: false, type: Number })
  userId: number = -1;

  @state()
  private showSheet: boolean = false;

  @state()
  private sheetId: string = "";

  /*override createRenderRoot() {
        return this
    }*/

  private popperReferenceRef: Ref<Element> = createRef();
  private popperElementRef: Ref<HTMLSlotElement> = createRef();

  private _popper?: PopperInstance;

  reactionListQuery = new QueryController<ReactionsResult>(this);

  private _documentClickHandler = () => {
    this.visible = false;
  };

  private handleReaction = async (emoji: string) => {
    if (!this.weavyContext || !this.parentId) {
      return;
    }

    if (this.reactedEmoji === emoji) {
      this.reactedEmoji = undefined;
      const mutation = await removeReactionMutation(
        this.weavyContext,
        this.parentId,
        this.entityId,
        this.messageType,
        this.userId
      );
      await mutation.mutate();
      this.reactionListQuery.observer?.refetch();
    } else if (this.reactedEmoji === undefined) {
      this.reactedEmoji = emoji;
      const mutation = await addReactionMutation(
        this.weavyContext,
        this.parentId,
        this.entityId,
        this.messageType,
        emoji,
        this.userId
      );
      await mutation.mutate();
      this.reactionListQuery.observer?.refetch();
    } else {
      this.reactedEmoji = emoji;
      const mutation = await replaceReactionMutation(
        this.weavyContext,
        this.parentId,
        this.entityId,
        this.messageType,
        emoji,
        this.userId
      );
      await mutation.mutate();
      this.reactionListQuery.observer?.refetch();
    }
  };

  private handleReactionsClick() {
    document.dispatchEvent(
      new CustomEvent("wy-global-sheets-remove", {
        bubbles: true,
        composed: true,
        detail: { originSheetId: this.sheetId },
      })
    );
    this.reactionListQuery.observer?.refetch();
    this.showSheet = !this.showSheet;
  }

  protected override willUpdate(changedProperties: PropertyValues<this & WeavyContextProps>) {
    if (changedProperties.has("reactions")) {
      this.reactedEmoji = this.reactions?.find((r) => r.created_by_id === this.userId)?.content;
    }

    if (changedProperties.has("directionX") || changedProperties.has("directionY")) {
      this._placement =
        this.directionX === "right" && this.directionY === "down"
          ? "bottom-start"
          : this.directionX === "left" && this.directionY === "down"
          ? "bottom-end"
          : this.directionX === "right" && this.directionY === "up"
          ? "top-start"
          : "top-end";
    }

    if (changedProperties.has("visible")) {
      if (this.visible) {
        requestAnimationFrame(() => {
          document.addEventListener("click", this._documentClickHandler, { once: true });
        });
      } else {
        document.removeEventListener("click", this._documentClickHandler);
      }

      if (this.visible && !this._popper && this.popperReferenceRef.value && this.popperElementRef.value) {
        this._popper = createPopper(this.popperReferenceRef.value, this.popperElementRef.value);
      } else if (!this.visible && this._popper) {
        this._popper.destroy();
        this._popper = undefined;
      }

      this._popper?.setOptions({
        placement: this._placement,
        modifiers: [
          {
            name: "offset",
            options: {
              offset: [4, 0],
            },
          },
          {
            name: "preventOverflow",
            options: {
              padding: 4,
            },
          },
        ],
      });
    }

    if (
      changedProperties.has("weavyContext") &&
      this.weavyContext?.reactions &&
      this.emojis != this.weavyContext.reactions
    ) {
      this.emojis = this.weavyContext.reactions;
    }
  }

  override render() {
    const { data, isLoading } = this.reactionListQuery.result ?? {};

    if (this.hasFeature) {
      const group = [
        ...new Map<string, ReactableType>(this.reactions?.map((item: ReactableType) => [item.content, item])).values(),
      ];

      return html`
        ${group.length
          ? html`
              <wy-button
                class="wy-reaction-lineup"
                kind="icon-inline"
                ?active=${this.showSheet}
                @click=${this.handleReactionsClick}
                buttonClass="wy-reactions ${this.small ? "wy-reactions-small" : nothing}">
                ${group.map((r) => html`<span class="wy-emoji" title="">${r.content}</span>`)}
                ${this.reactions?.length > 1
                  ? html`<small class="wy-reaction-count">${this.reactions.length}</small>`
                  : nothing}
              </wy-button>
            `
          : nothing}

        <wy-button
          ${ref(this.popperReferenceRef)}
          kind="icon"
          ?active=${this.visible}
          buttonClass="wy-reaction-menu-button"
          @click=${() => {
            this.visible = !this.visible;
          }}
          title=${msg("React", { desc: "Button action to react" })}>
          <wy-icon name="emoticon-plus" size=${this.small ? 18 : 20}></wy-icon>
        </wy-button>

        <div ${ref(this.popperElementRef)} class="wy-reaction-menu wy-dropdown-menu" ?hidden=${!this.visible}>
          <div class="wy-reaction-picker">
            ${this.emojis.map(
              (emoji) =>
                html`
                  <wy-button
                    kind="icon"
                    buttonClass=${"wy-reaction-button"}
                    ?active=${this.reactedEmoji === emoji}
                    @click=${() => {
                      this.handleReaction(emoji);
                    }}>
                    <span class="wy-emoji">${emoji}</span>
                  </wy-button>
                `
            )}
          </div>
        </div>

        ${portal(
          this.showSheet,
          html`
            <wy-sheet
              .show=${this.showSheet}
              .sheetId="${this.sheetId}"
              @release-focus=${() =>
                this.dispatchEvent(new CustomEvent("release-focus", { bubbles: true, composed: true }))}>
              <span slot="appbar-text">${msg("Reactions")}</span>
              <!-- <wy-spinner></wy-spinner> -->
              ${data && !isLoading
                ? html`
                    ${data.data?.map((reaction) => html` <wy-reaction-item .reaction=${reaction}></wy-reaction-item> `)}
                  `
                : nothing}
            </wy-sheet>
          `,
          () => (this.showSheet = false)
        )}
      `;
    } else {
      const like = "👍";

      const reactionLength = this.reactions?.length;
      return html`
        ${this.reactions?.length
          ? html`
              <wy-button
                class="wy-reaction-lineup"
                kind="icon-inline"
                ?active=${this.showSheet}
                @click=${this.handleReactionsClick}>
                <small class="wy-like-count">
                  ${this.reactions?.length === 1 ? msg("1 like") : msg(str`${reactionLength} likes`)}
                </small>
              </wy-button>
            `
          : nothing}

        <wy-button
          kind="icon-inline"
          class="wy-reaction-like-button"
          buttonClass="wy-like-button"
          @click=${() => {
            this.handleReaction(like);
          }}
          title=${msg("Like", { desc: "Button action to like" })}>
          <wy-icon
            ?padded=${this.small}
            name="${this.reactedEmoji === like ? "thumb-up" : "thumb-up-outline"}"
            size=${this.small ? 18 : 20}></wy-icon>
        </wy-button>

        ${portal(
          this.showSheet,
          html`
            <wy-sheet
              .show=${this.showSheet}
              .sheetId="${this.sheetId}"
              @release-focus=${() =>
                this.dispatchEvent(new CustomEvent("release-focus", { bubbles: true, composed: true }))}>
              <span slot="appbar-text">${msg("Likes")}</span>
              <!-- <wy-spinner spin="true"></wy-spinner> -->
              ${data && !isLoading
                ? html`
                    ${data.data?.map((reaction) => html` <wy-reaction-item .reaction=${reaction}></wy-reaction-item> `)}
                  `
                : nothing}
            </wy-sheet>
          `,
          () => (this.showSheet = false)
        )}
      `;
    }
  }

  protected override updated(changedProperties: PropertyValues<this & WeavyContextProps>): void {
    if (changedProperties.has("weavyContext") && this.weavyContext && this.entityId) {
      this.reactionListQuery.trackQuery(getReactionListOptions(this.weavyContext, this.messageType, this.entityId));
      this.sheetId = "sheet-" + this.messageType + "-" + this.entityId;
    }
  }
}
