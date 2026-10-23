import { html, LitElement, nothing } from "lit";
import { customElement } from "../../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { ifDefined } from "lit/directives/if-defined.js";
import { ShadowPartsController } from "../../controllers/shadow-parts-controller";
import type { PositionType } from "../../types/ui.types";
import { partMap } from "../../utils/directives/shadow-part-map";

import badgeCss from "../../scss/components/badge.scss";
import hostContentsCss from "../../scss/host-contents.scss";

declare global {
  interface HTMLElementTagNameMap {
    "wy-badge": WyBadge;
  }
}

/**
 * Small badge component showing a count, a text label or a generic dot indicator.
 *
 * The badge kind is decided from the text content of the element:
 *
 * - Empty, whitespace or `0` renders nothing, so `<wy-badge>${unread}</wy-badge>` hides itself when there is nothing unread.
 * - A whole number renders a count badge, truncated to `limit` (`100` → `99+`).
 * - Any other text renders a text badge, truncated with an ellipsis at `--wy-badge-max-width`.
 * - The `dot` attribute renders a generic dot indicator. The content remains available to assistive technology.
 *
 * Hover text is only shown when an explicit `title` is provided.
 *
 * The `color` attribute picks the color pair. The default is the primary pair, which draws attention, such as an
 * unread count. `variant` is the muted secondary-container pair for a count that is information rather than a call to
 * action, such as the votes on a poll option.
 *
 * @csspart wy-badge - Root badge container.
 * @csspart wy-badge-variant - Modifier for the muted `variant` color.
 * @csspart wy-badge-reveal - Modifier styles for revealing the badge.
 * @csspart wy-badge-reveal-delayed - Modifier styles for delaying the reveal.
 * @csspart wy-badge-count - Modifier when a count is displayed.
 * @csspart wy-badge-text - Modifier when a text label is displayed.
 * @csspart wy-badge-dot - Modifier when the dot indicator is displayed.
 * @csspart wy-badge-label - Visually hidden label inside a dot badge.
 * @csspart wy-badge-positioned - Modifier for using absolute positioning.
 * @csspart wy-badge-top-right - Modifier for positioning in top right corner with `wy-badge-positioned`.
 * @csspart wy-badge-top-left - Modifier for positioning in top left corner with `wy-badge-positioned`.
 * @csspart wy-badge-bottom-right - Modifier for positioning in bottom right corner with `wy-badge-positioned`.
 * @csspart wy-badge-bottom-left - Modifier for positioning in bottom left corner with `wy-badge-positioned`.
 *
 * @example <caption>Count, text and dot badges</caption>
 *
 * ```html
 * <wy-badge>3</wy-badge>
 * <wy-badge>Draft</wy-badge>
 * <wy-badge title="You have a draft">Draft</wy-badge>
 * <wy-badge dot>New messages</wy-badge>
 * <wy-badge color="variant">12</wy-badge>
 * ```
 */
@customElement("wy-badge")
export class WyBadge extends LitElement {
  static override styles = [badgeCss, hostContentsCss];
  protected exportParts = new ShadowPartsController(this);

  /** Show a generic dot indicator instead of the content. */
  @property({ type: Boolean, reflect: true })
  dot: boolean = false;

  /** Positioning of the badge */
  @property({ type: String })
  position: PositionType = "inline";

  /** Color pair of the badge: `primary` (default) or the muted `variant`. */
  @property({ type: String })
  color: "primary" | "variant" = "primary";

  /** Whether to animate showing the badge */
  @property({ type: Boolean })
  reveal: boolean = false;

  /** Whether to delay showing the badge */
  @property({ type: Boolean })
  delayed: boolean = false;

  /**
   * Limit for count truncation. Set to Infinity for no truncation.
   */
  @property({ type: Number })
  limit = 99;

  /** Optional hover text. No tooltip is shown unless explicitly provided. */
  @property()
  override title: string = "";

  /** Trimmed text content of the element. */
  @state()
  protected content = "";

  // The content is light DOM text that is never slotted, since it's transformed before display (100 -> 99+).
  // slotchange doesn't fire without a slot, and not for text edits either, so a MutationObserver
  // is used to pick up changes, including Lit updating a `${count}` text node in place (characterData).
  #observer = new MutationObserver(() => this.#readContent());

  #readContent() {
    this.content = this.textContent?.trim() ?? "";
  }

  override connectedCallback() {
    super.connectedCallback();
    this.#readContent();
    this.#observer.observe(this, { childList: true, characterData: true, subtree: true });
  }

  override disconnectedCallback() {
    this.#observer.disconnect();
    super.disconnectedCallback();
  }

  override render() {
    // Only plain whole numbers are counts. "0" and "" mean nothing to show; "-1", "1.5" or "v2" are text.
    const isNumber = /^\d+$/.test(this.content);
    const count = isNumber ? Number(this.content) : NaN;

    if (!this.content || count === 0) {
      return nothing;
    }

    const display = isNumber && count > this.limit ? `${this.limit}+` : this.content;
    const isCount = isNumber && !this.dot;
    const isText = !isNumber && !this.dot;
    const hasPosition = /^(top|bottom)-(right|left)$/.test(this.position);

    const badgeParts = {
      "wy-badge": true,
      "wy-badge-count": isCount,
      "wy-badge-text": isText,
      "wy-badge-dot": this.dot,
      "wy-badge-variant": this.color === "variant",
      "wy-badge-reveal": this.reveal,
      "wy-badge-reveal-delayed": this.delayed,
      "wy-badge-positioned": hasPosition,
      [`wy-badge-${this.position}`]: hasPosition,
    };

    return html`<span part=${partMap(badgeParts)} title=${ifDefined(this.title || undefined)}
      >${this.dot ? html`<span part="wy-badge-label">${display}</span>` : display}</span
    >`;
  }
}
