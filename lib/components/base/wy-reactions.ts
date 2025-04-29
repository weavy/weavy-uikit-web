import { LitElement, html, nothing, type PropertyValueMap, PropertyValues } from "lit";
import { customElement } from "../../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { classMap } from "lit/directives/class-map.js";
import { localized, msg } from "@lit/localize";
import { computePosition, autoUpdate, offset, flip, shift, type Placement } from "@floating-ui/dom";
import type { ReactableType, ReactionsResultType } from "../../types/reactions.types";
import { reactionMutation, getReactionListOptions } from "../../data/reactions";
import { QueryController } from "../../controllers/query-controller";
import { WeavyProps } from "../../types/weavy.types";
import { WeavyComponentConsumerMixin } from "../../classes/weavy-component-consumer-mixin";
import { ShadowPartsController } from "../../controllers/shadow-parts-controller";
import { partMap } from "../../utils/directives/shadow-part-map";
import { clickOnEnterAndConsumeOnSpace, clickOnEnterAndSpace, clickOnSpace } from "../../utils/keyboard";
import { isPopoverPolyfilled } from "../../utils/dom";

import "./wy-spinner";
import "./wy-button";
import "./wy-sheet";
import "./wy-icon";
import "./wy-avatar";

import rebootCss from "../../scss/components/base/reboot.scss";
import reactionCss from "../../scss/components/reactions.scss";
import itemCss from "../../scss/components/item.scss";
import emojiCss from "../../scss/components/emoji.scss";
import hostContentsCss from "../../scss/host-contents.scss";

@customElement("wy-reactions")
@localized()
export default class WyReactions extends WeavyComponentConsumerMixin(LitElement) {
  static override styles = [rebootCss, reactionCss, emojiCss, hostContentsCss];

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
  emojis: string = "";

  @property({ type: String })
  parentType: "posts" | "files" | "apps" = "apps";

  @property({ attribute: true, type: Number })
  parentId?: number;

  @property({ attribute: true, type: String })
  entityType: "messages" | "posts" | "comments" = "messages";

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
  showSheet: boolean = false;

  private buttonRef: Ref<Element> = createRef();
  private menuRef: Ref<HTMLSlotElement> = createRef();

  private _computePositionCleanup?: () => void;

  reactionListQuery = new QueryController<ReactionsResultType>(this);

  private _documentClickHandler = (e: Event) => {
    if (this.show) {
      e.preventDefault();

      if (!this.menuRef.value?.popover) {
        this.show = false;
      }
    }
  };

  private handleClose(e: ToggleEvent) {
    if ((e.type === "toggle" && e.newState === "closed") || e.type === "click") {
      this.show = false;
      this.dispatchEvent(new CustomEvent("close"));
      this.dispatchEvent(new CustomEvent("release-focus", { bubbles: true, composed: true }));
    }
  }

  private handleClickToggle(e: Event) {
    e.stopPropagation();
    this.show = !this.show;
  }

  private handleReaction = async (emoji: string | undefined) => {
    if (!this.weavy || !this.parentId || !this.user) {
      return;
    }

    const mutation = reactionMutation(
      this.weavy,
      this.parentId,
      this.parentType,
      this.entityId,
      this.entityType,
      this.reactedEmoji === emoji ? undefined : emoji,
      this.user
    );
    this.reactedEmoji = emoji;
    await mutation.mutate();

    void this.reactionListQuery.observer?.refetch();
  };

  private handleReactionsClick() {
    void this.reactionListQuery.observer?.refetch();
    this.showSheet = !this.showSheet;
    this.show = false;
  }

  protected override async willUpdate(changedProperties: PropertyValueMap<this & WeavyProps>): Promise<void> {
    super.willUpdate(changedProperties);

    // Start tracking reaction list data when showing the sheet
    if (
      (changedProperties.has("weavy") || changedProperties.has("entityId") || changedProperties.has("showSheet")) &&
      this.weavy &&
      this.entityId &&
      this.showSheet
    ) {
      await this.reactionListQuery.trackQuery(getReactionListOptions(this.weavy, this.entityType, this.entityId));
    }

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
              void computePosition(this.buttonRef.value, this.menuRef.value, {
                placement: this._placement,
                strategy: !this.menuRef.value.popover ? "fixed" : "absolute",
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
                    top: 0,
                    left: 0,
                    position: !this.menuRef.value.popover ? "fixed" : undefined,
                    zIndex: !this.menuRef.value.popover ? 1075 : undefined,
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

      try {
        this.menuRef.value?.showPopover();
      } catch {
        /* No worries */
      }
    } else {
      try {
        this.menuRef.value?.hidePopover();
      } catch {
        /* No worries */
      }
    }

    if (changedProperties.has("settings") && this.settings?.reactions && this.emojis != this.settings.reactions) {
      this.emojis = this.settings.reactions;
    }
  }

  override render() {
    const { data: fullReactionList, isPending } = this.reactionListQuery.result ?? {};

    if (!this.emojis?.length) {
      return nothing;
    }

    const singleReaction = this.emojis?.length === 1 ? this.emojis[0] : "";

    const groupedReactions = [
      ...new Map<string, ReactableType>(this.reactions?.map((item: ReactableType) => [item.content, item])).values(),
    ];

    const emojiClasses = {
      "wy-emoji-icon": true,
      "wy-emoji-icon-sm": this.small,
    };

    const reactionButtons = singleReaction
      ? html`
          ${this.reactions && this.reactions?.length > 1
            ? html`<wy-button
                kind="icon-inline"
                ?active=${this.showSheet}
                ?small=${this.small}
                @click=${() => this.handleReactionsClick()}
              >
                <div part="wy-reactions">
                  <span class=${classMap(emojiClasses)}>
                    <small part="wy-reaction-count">${this.reactions.length}</small>
                  </span>
                </div>
              </wy-button>`
            : nothing}

          <div>
            <wy-button
              part="wy-reaction-menu-button"
              kind="icon"
              ?small=${this.small}
              ?active=${this.reactedEmoji === singleReaction}
              @click=${() => {
                void this.handleReaction(singleReaction);
              }}
              @keydown=${clickOnEnterAndConsumeOnSpace}
              @keyup=${clickOnSpace}
              title=${msg("React", { desc: "Button action to react" })}
            >
              <span class=${classMap(emojiClasses)} title=${singleReaction}>${singleReaction}</span>
            </wy-button>
          </div>
        `
      : html`
          ${groupedReactions.length
            ? html`
                <wy-button
                  kind="icon-inline"
                  ?active=${this.showSheet}
                  ?small=${this.small}
                  @click=${() => this.handleReactionsClick()}
                >
                  <div part="wy-reactions">
                    ${groupedReactions.map((r) => {
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
              ?small=${this.small}
              @click=${(e: MouseEvent) => this.handleClickToggle(e)}
              @keydown=${clickOnEnterAndConsumeOnSpace}
              @keyup=${clickOnSpace}
              title=${msg("React", { desc: "Button action to react" })}
            >
              <wy-icon name="emoticon-plus" size=${this.small ? 18 : 20}></wy-icon>
            </wy-button>
          </div>

          <div
            ${ref(this.menuRef)}
            part="wy-reaction-menu"
            @click=${(e: MouseEvent) => this.handleClickToggle(e)}
            @keyup=${clickOnEnterAndSpace}
            ?hidden=${!this.show}
            ?popover=${!isPopoverPolyfilled()}
          >
            <div part="wy-reaction-picker">
              ${this.emojis.split(" ").map(
                (emoji) =>
                  html`
                    <wy-button
                      kind="icon"
                      color="none"
                      ?active=${this.reactedEmoji === emoji}
                      @click=${() => {
                        void this.handleReaction(emoji);
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
      ${this.weavy && this.showSheet
        ? html`
            <wy-sheet
              .show=${this.showSheet}
              @close=${() => (this.showSheet = false)}
              @release-focus=${() =>
                this.dispatchEvent(new CustomEvent("release-focus", { bubbles: true, composed: true }))}
            >
              <span slot="appbar-text">${msg("Reactions")}</span>
              <!-- <wy-spinner></wy-spinner> -->
              ${this.showSheet && fullReactionList && !isPending
                ? html`
                    ${fullReactionList.data?.map(
                      (reaction) => html` <wy-reaction-item .reaction=${reaction}></wy-reaction-item> `
                    )}
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
    this.menuRef.value?.addEventListener(this.menuRef.value.popover ? "toggle" : "click", (e: Event) =>
      this.handleClose(e as ToggleEvent)
    );
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
      <div class="wy-item wy-list-item">
        <wy-avatar
          .src=${this.reaction.created_by?.avatar_url}
          .name=${this.reaction.created_by?.name}
        ></wy-avatar>
        <div class="wy-item-body">${this.reaction.created_by?.name}</div>
        <span class="wy-emoji-icon">${this.reaction.content}</span>
      </div>
    `;
  }
}
