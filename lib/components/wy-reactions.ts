import { LitElement, html, nothing, css, type PropertyValueMap, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { classMap } from "lit/directives/class-map.js";
import { localized, msg } from "@lit/localize";

import { computePosition, autoUpdate, offset, flip, shift, type Placement } from "@floating-ui/dom";
import type { ReactableType, ReactionsResultType } from "../types/reactions.types";
import {
  addReactionMutation,
  getReactionListOptions,
  removeReactionMutation,
  replaceReactionMutation,
} from "../data/reactions";

import { QueryController } from "../controllers/query-controller";
import { WeavyContextProps } from "../types/weavy.types";
import { BlockConsumerMixin } from "../mixins/block-consumer-mixin";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { partMap } from "../utils/directives/shadow-part-map";

import "./wy-spinner";
import "./wy-button";
import "./wy-sheet";
import "./wy-icon";
import "./wy-avatar";

import rebootCss from "../scss/wrappers/base/reboot";
import reactionCss from "../scss/wrappers/reactions";
import itemCss from "../scss/wrappers/item";
import emojiCss from "../scss/wrappers/emoji";
import { clickOnEnterAndConsumeOnSpace, clickOnEnterAndSpace, clickOnSpace } from "../utils/keyboard";

@customElement("wy-reactions")
@localized()
export default class WyReactions extends BlockConsumerMixin(LitElement) {
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
  private _placement: Placement = "bottom-start";

  @state()
  reactedEmoji: string | undefined;


  @state()
  show: boolean = false;

  @state()
  private showSheet: boolean = false;

  private buttonRef: Ref<Element> = createRef();
  private menuRef: Ref<HTMLSlotElement> = createRef();

  private _computePositionCleanup?: () => void;

  reactionListQuery = new QueryController<ReactionsResultType>(this);

  private _documentClickHandler = (e: Event) => {
    if (this.show) {
      e.preventDefault();
    }
  };

  private handleClose(e: ToggleEvent) {
    if (e.newState === "closed") {
      this.show = false;
      this.dispatchEvent(new CustomEvent("close"));
      this.dispatchEvent(new CustomEvent("release-focus", { bubbles: true, composed: true }));
    }
  }

  private handleClickToggle(_e: Event) {
    _e.stopPropagation();
    this.show = !this.show;
  }

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
    this.show = false;
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

    if (changedProperties.has("show")) {
      if (this.show && !this._computePositionCleanup && this.buttonRef.value && this.menuRef.value) {
        this._computePositionCleanup = autoUpdate(this.buttonRef.value, this.menuRef.value, () => {
          requestAnimationFrame(() => {
            if (this.buttonRef.value && this.menuRef.value) {
              computePosition(this.buttonRef.value, this.menuRef.value, {
                placement: this._placement,
                strategy: "absolute",
                middleware: [
                  flip(),
                  offset({ mainAxis: 0, alignmentAxis: -8 }),
                  shift({ mainAxis: true, crossAxis: true, padding: 4, altBoundary: true }),
                ],
              }).then(({ x, y }) => {
                if (this.menuRef.value) {
                  Object.assign(this.menuRef.value.style, {
                    marginLeft: `${x}px`,
                    marginTop: `${y}px`,
                  });
                }
              });
            }
          });
        });
      } else if (!this.show && this._computePositionCleanup) {
        this._computePositionCleanup();
        this._computePositionCleanup = undefined;
      }
    }

    if (this.show) {
      // Catch clicks outside dropdowns
      requestAnimationFrame(() => {
        document.addEventListener("click", this._documentClickHandler, { once: true, capture: true });
      });

      this.menuRef.value?.showPopover();
    } else {
      this.menuRef.value?.hidePopover();
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
                    "wy-emoji-icon-xs": this.small,
                  };
                  return html`<span class=${classMap(emojiClasses)} title="">${r.content}</span>`;
                })}
                ${this.reactions && this.reactions?.length > 1
                  ? html`<small part="wy-reaction-count">${this.reactions.length}</small>`
                  : nothing}
              </div>
            </wy-button>
          `
        : nothing}

      <div ${ref(this.buttonRef)}>
        <wy-button
          part="wy-reaction-menu-button"
          kind="icon"
          ?active=${this.show}
          small
          @click=${this.handleClickToggle}
          @keydown=${clickOnEnterAndConsumeOnSpace}
          @keyup=${clickOnSpace}
          title=${msg("React", { desc: "Button action to react" })}
        >
          <wy-icon name="emoticon-plus" size=${this.small ? 18 : 20}></wy-icon>
        </wy-button>
      </div>

      <div ${ref(this.menuRef)} part="wy-reaction-menu"           @click=${this.handleClickToggle}
      @keyup=${clickOnEnterAndSpace} ?hidden=${!this.show} popover>
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
      ${this.weavyContext
        ? html`
            <wy-sheet
              .show=${this.showSheet}
              @close=${() => (this.showSheet = false)}
              @release-focus=${() =>
                this.dispatchEvent(new CustomEvent("release-focus", { bubbles: true, composed: true }))}
            >
              <span slot="appbar-text">${msg("Reactions")}</span>
              <!-- <wy-spinner></wy-spinner> -->
              ${this.showSheet && data && !isPending
                ? html`
                    ${data.data?.map((reaction) => html` <wy-reaction-item .reaction=${reaction}></wy-reaction-item> `)}
                  `
                : nothing}
            </wy-sheet>
          `
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
          <div part=${partMap(lineParts)}>${reactionButtons}</div>
          ${reactionSheet}
        `
      : [reactionButtons, reactionSheet];
  }

  protected override firstUpdated(_changedProperties: PropertyValues<this>) {
    this.menuRef.value?.addEventListener("toggle", (e: Event) => this.handleClose(e as ToggleEvent));
  }
  
  protected override updated(changedProperties: PropertyValueMap<this & WeavyContextProps>): void {
    if (
      (changedProperties.has("weavyContext") || changedProperties.has("entityId")) &&
      this.weavyContext &&
      this.entityId
    ) {
      this.reactionListQuery.trackQuery(getReactionListOptions(this.weavyContext, this.messageType, this.entityId));
    }
  }

  override disconnectedCallback(): void {
    this._computePositionCleanup?.();
    super.disconnectedCallback();
  }
}

@customElement("wy-reaction-item")
export class WyReactionItem extends LitElement {
  static override styles = [rebootCss, itemCss, emojiCss];
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
