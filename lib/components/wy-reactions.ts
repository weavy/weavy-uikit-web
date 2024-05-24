import { LitElement, html, nothing, css, type PropertyValueMap } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { classMap } from "lit/directives/class-map.js";
import { portal } from "lit-modal-portal";
import { localized, msg } from "@lit/localize";

import { type Placement as PopperPlacement, type Instance as PopperInstance, createPopper } from "@popperjs/core";
import type { ReactableType, ReactionsResultType } from "../types/reactions.types";
import {
  addReactionMutation,
  getReactionListOptions,
  removeReactionMutation,
  replaceReactionMutation,
} from "../data/reactions";

import { QueryController } from "../controllers/query-controller";
import { WeavyContextProps } from "../types/weavy.types";
import { AppConsumerMixin } from "../mixins/app-consumer-mixin";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { shadowPartMap } from "../utils/directives/shadow-part-map";

import "./wy-spinner";
import "./wy-button";
import "./wy-sheet";
import "./wy-icon";
import "./wy-avatar";

import rebootCss from "../scss/wrappers/base/reboot";
import reactionCss from "../scss/wrappers/reactions";
import itemCss from "../scss/wrappers/item";
import emojiCss from "../scss/wrappers/emoji";

@customElement("wy-reactions")
@localized()
export default class WyReactions extends AppConsumerMixin(LitElement) {
  static override styles = [
    rebootCss,
    reactionCss,
    emojiCss,
    css`
      :host {
        display: contents;
      }
    `,
  ];

  protected exportParts = new ShadowPartsController(this);

  @property()
  directionX: "left" | "right" = "left";

  @property()
  directionY: "up" | "down" = "up";

  @property({ type: Boolean })
  small = false;

  @property({ attribute: false })
  reactions?: ReactableType[] = [];

  @property({ attribute: false })
  emojis: string[] = [];

  @property({ attribute: false })
  visible: boolean = false;

  @property({ attribute: true, type: String })
  messageType: "messages" | "posts" | "comments" = "messages";

  @property({ attribute: true, type: Number })
  parentId?: number;

  @property({ attribute: true, type: Number })
  entityId!: number;

  @property({ type: Boolean })
  line = false;

  @property({ type: Boolean })
  lineReverse = false;

  @property({ type: Boolean })
  lineBottom = false;

  @property({ type: Boolean })
  lineBelow = false;

  @state()
  private _placement: PopperPlacement = "bottom-start";

  @state()
  reactedEmoji: string | undefined;

  @state()
  private showSheet: boolean = false;

  @state()
  private sheetId: string = "";

  private popperReferenceRef: Ref<Element> = createRef();
  private popperElementRef: Ref<HTMLSlotElement> = createRef();

  private _popper?: PopperInstance;

  reactionListQuery = new QueryController<ReactionsResultType>(this);

  private _documentClickHandler = () => {
    this.visible = false;
  };

  private handleReaction = async (emoji: string) => {
    if (!this.weavyContext || !this.parentId || !this.user) {
      return;
    }

    if (this.reactedEmoji === emoji) {
      this.reactedEmoji = undefined;
      const mutation = await removeReactionMutation(
        this.weavyContext,
        this.parentId,
        this.entityId,
        this.messageType,
        this.user
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
        this.user
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
        this.user
      );
      await mutation.mutate();
      this.reactionListQuery.observer?.refetch();
    }
  };

  private handleReactionsClick() {
    this.reactionListQuery.observer?.refetch();
    this.showSheet = !this.showSheet;
  }

  protected override willUpdate(changedProperties: PropertyValueMap<this & WeavyContextProps>) {
    super.willUpdate(changedProperties);

    if ((changedProperties.has("reactions") || changedProperties.has("user")) && this.user) {
      this.reactedEmoji = this.reactions?.find((r) => r.created_by?.id === this.user?.id)?.content;
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
    const { data, isPending } = this.reactionListQuery.result ?? {};

    const group = [
      ...new Map<string, ReactableType>(this.reactions?.map((item: ReactableType) => [item.content, item])).values(),
    ];

    const reactionButtons = html`
      ${group.length
        ? html`
            <wy-button
              kind="icon-inline"
              ?active=${this.showSheet}
              ?small=${this.small}
              @click=${this.handleReactionsClick}
            >
              <div part="wy-reactions">
                ${group.map((r) => {
                  const emojiClasses = {
                    "wy-emoji-icon": true,
                    "wy-emoji-icon-sm": !this.small,
                    "wy-emoji-icon-xs" : this.small,
                  }
                  return html`<span class=${classMap(emojiClasses)} title="">${r.content}</span>`
              })}
                ${this.reactions && this.reactions?.length > 1
                  ? html`<small part="wy-reaction-count">${this.reactions.length}</small>`
                  : nothing}
              </div>
            </wy-button>
          `
        : nothing}

      <div ${ref(this.popperReferenceRef)}>
        <wy-button
          part="wy-reaction-menu-button"
          kind="icon"
          ?active=${this.visible}
          small
          @click=${() => {
            this.visible = !this.visible;
          }}
          title=${msg("React", { desc: "Button action to react" })}
        >
          <wy-icon name="emoticon-plus" size=${this.small ? 18 : 20}></wy-icon>
        </wy-button>
      </div>

      <div ${ref(this.popperElementRef)} part="wy-reaction-menu" ?hidden=${!this.visible}>
        <div part="wy-reaction-picker">
          ${this.emojis.map(
            (emoji) =>
              html`
                <wy-button
                  kind="icon"
                  color="none"
                  ?active=${this.reactedEmoji === emoji}
                  @click=${() => {
                    this.handleReaction(emoji);
                  }}
                >
                  <span class="wy-emoji-icon">${emoji}</span>
                </wy-button>
              `
          )}
        </div>
      </div>
    `;

    const reactionSheet = html`
      ${this.weavyContext && this.settings
        ? portal(
            this.showSheet
              ? html`
                  <wy-sheet
                    .show=${this.showSheet}
                    .sheetId="${this.sheetId}"
                    .contexts=${this.contexts}
                    @close=${() => (this.showSheet = false)}
                    @release-focus=${() =>
                      this.dispatchEvent(new CustomEvent("release-focus", { bubbles: true, composed: true }))}
                  >
                    <span slot="appbar-text">${msg("Reactions")}</span>
                    <!-- <wy-spinner></wy-spinner> -->
                    ${data && !isPending
                      ? html`
                          ${data.data?.map(
                            (reaction) => html` <wy-reaction-item .reaction=${reaction}></wy-reaction-item> `
                          )}
                        `
                      : nothing}
                  </wy-sheet>
                `
              : nothing,
            this.settings.submodals || this.weavyContext.modalRoot === undefined
              ? this.settings.component.renderRoot
              : this.weavyContext.modalRoot
          )
        : nothing}
    `;
    const lineParts = {
      "wy-reactions-line": true,
      "wy-reactions-line-reverse": this.lineReverse,
      "wy-reactions-line-bottom": this.lineBottom,
      "wy-reactions-line-below": this.lineBelow,
    };
    return this.line || this.lineReverse || this.lineBottom || this.lineBelow
      ? html`
          <div part=${shadowPartMap(lineParts)}>${reactionButtons}</div>
          ${reactionSheet}
        `
      : [reactionButtons, reactionSheet];
  }

  protected override updated(changedProperties: PropertyValueMap<this & WeavyContextProps>): void {
    if (
      (changedProperties.has("weavyContext") || changedProperties.has("entityId")) &&
      this.weavyContext &&
      this.entityId
    ) {
      this.reactionListQuery.trackQuery(getReactionListOptions(this.weavyContext, this.messageType, this.entityId));
      this.sheetId = "sheet-" + this.messageType + "-" + this.entityId;
    }
  }
}

@customElement("wy-reaction-item")
export class WyReactionItem extends LitElement {
  static override styles = [
    rebootCss,
    itemCss,
    emojiCss,
  ];
  protected exportParts = new ShadowPartsController(this);

  @property({ attribute: false })
  reaction!: ReactableType;

  override render() {
    return html`
      <div class="wy-item">
        <wy-avatar
          .src=${this.reaction.created_by?.avatar_url}
          .name=${this.reaction.created_by?.display_name}
        ></wy-avatar>
        <div class="wy-item-body">${this.reaction.created_by?.display_name}</div>
        <span class="wy-emoji-icon">${this.reaction.content}</span>
      </div>
    `;
  }
}