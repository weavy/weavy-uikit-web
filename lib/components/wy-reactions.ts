import { LitElement, html, nothing, type PropertyValueMap } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { localized, msg } from "@lit/localize";
import { computePosition, autoUpdate, offset, flip, shift, type Placement } from "@floating-ui/dom";
import type { ReactableType, ReactionsResultType } from "../types/reactions.types";
import { reactionMutation, getReactionListOptions } from "../data/reactions";
import { QueryController } from "../controllers/query-controller";
import { WeavySubAppComponent } from "../classes/weavy-sub-app-component";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { partMap } from "../utils/directives/shadow-part-map";
import { clickOnEnterAndConsumeOnSpace, clickOnEnterAndSpace, clickOnSpace } from "../utils/keyboard";
import { isPopoverPolyfilled } from "../utils/dom";
import { ifDefined } from "lit/directives/if-defined.js";
import { CloseEventType } from "../types/ui.events";
import { NamedEvent } from "../types/generic.types";

import rebootCss from "../scss/reboot.scss";
import reactionCss from "../scss/components/reactions.scss";
import emojiCss from "../scss/components/emoji.scss";
import hostContentsCss from "../scss/host-contents.scss";

import "./ui/wy-avatar";
import "./ui/wy-button";
import "./ui/wy-icon";
import "./ui/wy-item";
import "./ui/wy-progress-circular";
import "./ui/wy-overlay";
import "./ui/wy-container";

declare global {
  interface HTMLElementTagNameMap {
    "wy-reactions": WyReactions;
    "wy-reaction-item": WyReactionItem;
  }
}

/**
 * Reaction controls for entities (messages/posts/comments).
 *
 * **Used sub components:**
 *
 * - [`<wy-button>`](./ui/wy-button.ts)
 * - [`<wy-icon>`](./ui/wy-icon.ts)
 * - [`<wy-avatar>`](./ui/wy-avatar.ts)
 * - [`<wy-item>`](./ui/wy-item.ts)
 * - [`<wy-overlay>`](./ui/wy-overlay.ts)
 * - [`<wy-container>`](./ui/wy-container.ts)
 * - [`<wy-reaction-item>`](./wy-reactions.ts)
 *
 * @csspart wy-reactions - Wrapper for reactions display.
 * @csspart wy-reaction-menu - Reaction menu container.
 * @csspart wy-reaction-picker - Reaction picker area.
 * @csspart wy-reaction-menu-button - Button that opens reaction menu.
 * @csspart wy-emoji-icon - Emoji icon wrapper.
 * @csspart wy-reaction-count - Count badge for reactions.
 *
 * @fires {CloseEventType} close - Emitted when the reaction menu is closed.
 */
@customElement("wy-reactions")
@localized()
export class WyReactions extends WeavySubAppComponent {
  static override styles = [rebootCss, reactionCss, emojiCss, hostContentsCss];

  protected exportParts = new ShadowPartsController(this);

  /**
   * Horizontal alignment for the reaction picker.
   */
  @property()
  directionX: "left" | "right" = "left";

  /**
   * Vertical alignment for the reaction picker.
   */
  @property()
  directionY: "up" | "down" = "up";

  /**
   * Renders a compact version of the controls.
   */
  @property({ type: Boolean })
  small = false;

  /**
   * Current reactions applied to the host entity.
   */
  @property({ attribute: false })
  reactions?: ReactableType[] = [];

  /**
   * Space separated list of emojis available in the picker.
   */
  @property({ attribute: false })
  emojis: string = "";

  /**
   * Parent collection that owns the entity.
   */
  @property({ type: String })
  parentType: "posts" | "files" | "apps" = "apps";

  /**
   * Identifier of the parent container.
   */
  @property({ attribute: true, type: Number })
  parentId?: number;

  /**
   * Entity type targeted by the reactions.
   */
  @property({ attribute: true, type: String })
  entityType: "messages" | "posts" | "comments" = "messages";

  /**
   * Identifier of the reactable entity.
   */
  @property({ attribute: true, type: Number })
  entityId!: number;

  /**
   * Displays the picker inline with a line layout.
   */
  @property({ type: Boolean })
  line = false;

  /**
   * Reverses the inline layout order.
   */
  @property({ type: Boolean })
  lineReverse = false;

  /**
   * Positions the inline layout at the bottom edge.
   */
  @property({ type: Boolean })
  lineBottom = false;

  /**
   * Positions the inline layout below the trigger.
   */
  @property({ type: Boolean })
  lineBelow = false;

  /**
   * Floating-ui placement for the picker popover.
   *
   * @internal
   */
  @state()
  private _placement: Placement = "bottom-start";

  /**
   * Emoji currently reacted with by the active user.
   *
   * @internal
   */
  @state()
  reactedEmoji: string | undefined;

  /**
   * Whether the emoji picker popover is visible.
   *
   * @internal
   */
  @state()
  show: boolean = false;

  /**
   * Whether the reaction list sheet is visible.
   *
   * @internal
   */
  @state()
  showSheet: boolean = false;

  /**
   * Reaction menu button element reference.
   *
   * @internal
   */
  private buttonRef: Ref<Element> = createRef();

  /**
   * Popover menu element reference.
   *
   * @internal
   */
  private menuRef: Ref<HTMLSlotElement> = createRef();

  /**
   * Cleanup callback from Floating UI.
   *
   * @internal
   */
  private _computePositionCleanup?: () => void;

  /**
   * Query controller providing the full reaction list.
   *
   * @internal
   */
  reactionListQuery = new QueryController<ReactionsResultType>(this);

  /**
   * Handles outside clicks to close the picker.
   *
   * @internal
   */
  private _documentClickHandler = (e: Event) => {
    if (this.show) {
      e.preventDefault();

      if (!this.menuRef.value?.popover) {
        this.show = false;
      }
    }
  };

  /**
   * Closes the picker when the popover hides.
   *
   * @internal
   */
  private handleClose(e: ToggleEvent) {
    if ((e.type === "toggle" && e.newState === "closed") || e.type === "click") {
      this.show = false;
      const event: CloseEventType = new (CustomEvent as NamedEvent)("close");
      this.dispatchEvent(event);
    }
  }

  /**
   * Toggles the emoji picker visibility.
   *
   * @internal
   */
  private handleClickToggle(e: Event) {
    e.stopPropagation();
    this.show = !this.show;
  }

  /**
   * Adds or removes the supplied reaction for the current user.
   *
   * @internal
   * @param emoji - Emoji to apply, or `undefined` to remove the reaction.
   */
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

  /**
   * Opens the detailed reaction sheet view.
   *
   * @internal
   */
  private handleReactionsClick() {
    void this.reactionListQuery.observer?.refetch();
    this.showSheet = !this.showSheet;
    this.show = false;
  }

  protected override async willUpdate(changedProperties: PropertyValueMap<this>): Promise<void> {
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

    const emojiParts = {
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
                  <span part=${partMap(emojiParts)}>
                    <small part="wy-reaction-count">${this.reactions.length}</small>
                  </span>
                </div>
              </wy-button>`
            : nothing}

          <div>
            <wy-button
              part="wy-reaction-menu-button"
              color="inherit"
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
              <span part=${partMap(emojiParts)} title=${singleReaction}>${singleReaction}</span>
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
                      return html`<span part=${partMap(emojiParts)} title="">${r.content}</span>`;
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
              color="inherit"
              kind="icon"
              ?active=${this.show}
              ?small=${this.small}
              @click=${(e: MouseEvent) => this.handleClickToggle(e)}
              @keydown=${clickOnEnterAndConsumeOnSpace}
              @keyup=${clickOnSpace}
              title=${msg("React", { desc: "Button action to react" })}
            >
              <wy-icon name="emoticon" size=${this.small ? 20 : 24}></wy-icon>
            </wy-button>
          </div>

          <div
            ${ref(this.menuRef)}
            part="wy-reaction-menu"
            @click=${(e: MouseEvent) => this.handleClickToggle(e)}
            @keyup=${clickOnEnterAndSpace}
            ?hidden=${!this.show}
            popover=${ifDefined(isPopoverPolyfilled() ? undefined : "auto")}
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
                      <span part="wy-emoji-icon">${emoji}</span>
                    </wy-button>
                  `
              )}
            </div>
          </div>
        `;

    const reactionSheet = html`
      ${this.weavy && this.showSheet
        ? html`
            <wy-overlay type="sheet" .show=${this.showSheet} @close=${() => (this.showSheet = false)}>
              <span slot="title">${msg("Reactions")}</span>
              <wy-container scrollY padded>
                ${this.showSheet && fullReactionList && !isPending
                  ? html`
                      ${fullReactionList.data?.map(
                        (reaction) => html` <wy-reaction-item .reaction=${reaction}></wy-reaction-item> `
                      )}
                    `
                  : nothing}
              </wy-container>
            </wy-overlay>
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

  protected override firstUpdated(_changedProperties: PropertyValueMap<this>) {
    this.menuRef.value?.addEventListener(this.menuRef.value.popover ? "toggle" : "click", (e: Event) =>
      this.handleClose(e as ToggleEvent)
    );
  }

  override disconnectedCallback(): void {
    this._computePositionCleanup?.();
    super.disconnectedCallback();
  }
}

/**
 * Individual reaction item used inside the reactions sheet.
 *
 * **Used sub components:**
 *
 * - [`<wy-item>`](./ui/wy-item.ts)
 * - [`<wy-avatar>`](./ui/wy-avatar.ts)
 *
 * @csspart wy-emoji-icon - Emoji shown for the reaction item.
 */
@customElement("wy-reaction-item")
export class WyReactionItem extends LitElement {
  static override styles = [rebootCss, emojiCss];
  protected exportParts = new ShadowPartsController(this);

  @property({ attribute: false })
  reaction!: ReactableType;

  override render() {
    return html`
      <wy-item>
        <wy-avatar
          slot="image"
          .src=${this.reaction.created_by?.avatar_url}
          .name=${this.reaction.created_by?.name}
        ></wy-avatar>
        <span slot="title">${this.reaction.created_by?.name}</span>
        <span slot="actions" part="wy-emoji-icon">${this.reaction.content}</span>
      </wy-item>
    `;
  }
}
