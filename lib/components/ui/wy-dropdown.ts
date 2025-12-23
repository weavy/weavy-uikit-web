import { LitElement, html, type PropertyValues } from "lit";
import { customElement } from "../../utils/decorators/custom-element";
import { property, queryAssignedElements, state } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { clickOnEnterAndConsumeOnSpace, clickOnEnterAndSpace, clickOnSpace } from "../../utils/keyboard";
import { ShadowPartsController } from "../../controllers/shadow-parts-controller";
import type { iconNamesType } from "../../utils/icons";
import { computePosition, autoUpdate, offset, flip, shift, type Placement } from "@floating-ui/dom";
import { inOverlay, isPopoverPolyfilled } from "../../utils/dom";
import { ifDefined } from "lit/directives/if-defined.js";
import { partMap } from "../../utils/directives/shadow-part-map";

import rebootCss from "../../scss/reboot.scss";
import dropdownCss from "../../scss/components/dropdown.scss";
import hostContentsCss from "../../scss/host-contents.scss";

import { WyIcon } from "./wy-icon";
import "./wy-button";

declare global {
  interface HTMLElementTagNameMap {
    "wy-dropdown": WyDropdown;
    "wy-dropdown-item": WyDropdownItem;
    "wy-dropdown-option": WyDropdownOption;
    "wy-dropdown-divider": WyDropdownDivider;
  }
}

/**
 * Dropdown button with menu.
 *
 * Uses the native Popover API.
 * See [MDN: Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API).
 *
 * **Used sub components**
 *
 * - [`<wy-button>`](./wy-button.ts)
 * - [`<wy-icon>`](./wy-icon.ts)
 *
 * @slot - Default menu items.
 * @slot button-content - The dropdown button content.
 * @csspart wy-dropdown - Wrapper for the dropdown
 * @csspart wy-dropdown-button-container - Container for the dropdown button.
 * @csspart wy-dropdown-button - The button for the dropdown.
 * @csspart wy-dropdown-button-icon - The icon for the dropdown button.
 * @csspart wy-dropdown-menu - The menu for the dropdown.
 */
@customElement("wy-dropdown")
export class WyDropdown extends LitElement {
  static override styles = [rebootCss, dropdownCss];

  protected exportParts = new ShadowPartsController(this);

  /**
   * Horizontal direction of the menu.
   */
  @property()
  directionX: "left" | "right" = "right";

  /**
   * Vertical direction of the menu.
   */
  @property()
  directionY: "up" | "down" = "down";

  /**
   * Name of the icon for the dropdown button.
   */
  @property()
  icon: iconNamesType = "dots-vertical";

  /**
   * Smaller dropdown button.
   */
  @property({ type: Boolean })
  small: boolean = false;

  /**
   * Set disabled state.
   */
  @property({ type: Boolean })
  disabled: boolean = false;

  /**
   * Floating-ui compatible positioning
   * @internal
   */
  @state()
  private _placement: Placement = "bottom-start";

  /**
   * Is the menu shown?
   */
  @state()
  showMenu: boolean = false;

  /**
   * Any nodes assigned to the `button` slot.
   * @internal
   */
  @queryAssignedElements({ slot: "button-content" })
  private _slotButton!: Array<HTMLElement>;

  /**
   * Cleanup function from Floating-ui.
   * @internal
   */
  @state()
  private computePositionCleanup?: () => void;

  private buttonRef: Ref<Element> = createRef();
  private menuRef: Ref<HTMLSlotElement> = createRef();

  constructor() {
    super();
    this.addEventListener("click", (e: Event) => {
      e.preventDefault();
    });
  }

  private _documentClickHandler = (e: Event) => {
    if (this.showMenu) {
      e.preventDefault();

      // When legacy mode/not popover mode, close manually
      if (!this.menuRef.value?.popover) {
        this.showMenu = false;
      }
    }
  };

  private handleClose(e: ToggleEvent) {
    if ((e.type === "toggle" && e.newState === "closed") || e.type === "click") {
      this.showMenu = false;
      this.dispatchEvent(new CustomEvent("close"));
    }
  }

  private handleClickToggle(e: Event) {
    e.stopPropagation();
    this.showMenu = this.disabled ? false : !this.showMenu;
  }

  protected override willUpdate(changedProperties: PropertyValues<this>): void {
    super.willUpdate(changedProperties);

    if ((changedProperties.has("disabled") || changedProperties.has("showMenu")) && this.disabled && this.showMenu) {
      this.showMenu = false;
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

    if (changedProperties.has("showMenu")) {
      if (this.showMenu && !this.computePositionCleanup && this.buttonRef.value && this.menuRef.value) {
        this.computePositionCleanup = autoUpdate(this.buttonRef.value, this.menuRef.value, () => {
          if (this.buttonRef.value && this.menuRef.value) {
            
            // Fallback to "fixed" when Popover API is not available
            const fallback = !this.menuRef.value.popover;

            // The positioning gets wrong when in top-layer via web components, because there is no good way to detect that the positioning is fixed/modal.
            // We detect this mainly by looking at the tag name (localName).
            const altBoundary = fallback || !inOverlay(this.buttonRef.value);

            void computePosition(this.buttonRef.value, this.menuRef.value, {
              placement: this._placement,
              strategy: fallback ? "fixed" : "absolute",
              middleware: [
                flip(),
                offset(({ placement }) => (placement.includes("top") ? 9 : 13)),
                shift({ mainAxis: true, crossAxis: true, padding: 4, altBoundary }),
              ],
            }).then(({ x, y }) => {
              if (this.menuRef.value) {
                Object.assign(this.menuRef.value.style, {
                  marginLeft: `${x}px`,
                  marginTop: `${y}px`,
                  top: 0,
                  left: 0,
                  position: fallback ? "fixed" : undefined,
                  zIndex: fallback ? 1075 : undefined,
                });
              }
            });
          }
        });
      } else if (!this.showMenu && this.computePositionCleanup) {
        this.computePositionCleanup?.();
        this.computePositionCleanup = undefined;
      }
    }

    if (this.showMenu) {
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
  }

  override render() {
    const isIcon =
      this._slotButton.length === 0 || (this._slotButton.length === 1 && this._slotButton[0] instanceof WyIcon);

    return html`
      <span part="wy-dropdown">
        <span
          ${ref(this.buttonRef)}
          part="wy-dropdown-button-container"
          @click=${(e: MouseEvent) => this.handleClickToggle(e)}
          @keydown=${clickOnEnterAndConsumeOnSpace}
          @keyup=${clickOnSpace}
        >
          <wy-button
            part="wy-dropdown-button"
            .kind=${isIcon ? "icon" : undefined}
            ?small=${this.small}
            title=${this.title}
            ?active=${this.showMenu}
            ?disabled=${this.disabled}
          >
            <slot name="button-content" @slotchange=${() => this.requestUpdate()}>
              <wy-icon part="wy-dropdown-button-icon" name=${this.icon}></wy-icon>
            </slot>
          </wy-button>
        </span>

        <div
          ${ref(this.menuRef)}
          part="wy-dropdown-menu"
          @click=${(e: MouseEvent) => this.handleClickToggle(e)}
          @keyup=${clickOnEnterAndSpace}
          ?hidden=${isPopoverPolyfilled() && !this.showMenu}
          popover=${ifDefined(isPopoverPolyfilled() ? undefined : "auto")}
        >
          <slot></slot>
        </div>
      </span>
    `;
  }

  protected override firstUpdated(_changedProperties: PropertyValues<this>) {
    this.menuRef.value?.addEventListener(this.menuRef.value.popover ? "toggle" : "click", (e: Event) =>
      this.handleClose(e as ToggleEvent)
    );
  }

  override disconnectedCallback(): void {
    this.computePositionCleanup?.();
    super.disconnectedCallback();
  }
}

/**
 * Item with text and optional icon for the dropdown menu.
 *
 * @slot - Default slot for icon and text.
 * @csspart wy-dropdown-item - The container for the dropdown item.
 * @csspart wy-active - Active state for the dropdown item.
 */
@customElement("wy-dropdown-item")
export class WyDropdownItem extends LitElement {
  static override styles = [rebootCss, dropdownCss, hostContentsCss];

  protected exportParts = new ShadowPartsController(this);

  /**
   * Sets the state to active.
   */
  @property({ type: Boolean })
  active: boolean = false;

  override render() {
    return html`<div part="wy-dropdown-item ${partMap({ "wy-active": this.active })}" tabindex="0"><slot></slot></div>`;
  }
}

/**
 * Item with a selected state icon for the dropdown menu.
 *
 * Defaults to a check mark as selected icon.
 *
 * ## Used sub components
 *
 * - [`<wy-icon>`](./wy-icon)
 *
 * @slot - Default slot for text.
 * @slot icon - Slot for selected icon.
 * @csspart wy-dropdown-item - The container for the dropdown item.
 * @csspart wy-dropdown-option - Option styling for the dropdown item.
 * @csspart wy-dropdown-option-icon - The icon for the dropdown option.
 * @csspart wy-active - Active state for the dropdown item.
 * @csspart wy-selected - State when the dropdown item is the currently selected option.
 */
@customElement("wy-dropdown-option")
export class WyDropdownOption extends LitElement {
  static override styles = [rebootCss, dropdownCss, hostContentsCss];

  protected exportParts = new ShadowPartsController(this);

  /**
   * Sets the active state for the item.
   */
  @property({ type: Boolean })
  active: boolean = false;

  /**
   * Sets selected state for the item. This shows the icon.
   */
  @property({ type: Boolean })
  selected: boolean = false;

  override render() {
    const iconStyles = {
      visibility: !this.selected ? "hidden" : null,
    };
    return html`
      <div
        part="wy-dropdown-item wy-dropdown-option ${partMap({
          "wy-active": this.active,
          "wy-selected": this.selected,
        })}"
        tabindex="0"
      >
        <slot name="icon" style=${styleMap(iconStyles)}
          ><wy-icon part="wy-dropdown-option-icon" name="check"></wy-icon
        ></slot>
        <slot></slot>
      </div>
    `;
  }
}

/**
 * Horizontal dropdown item divider.
 *
 * @csspart wy-dropdown-divider - Horizontal ruler.
 */
@customElement("wy-dropdown-divider")
export class WyDropdownDivider extends LitElement {
  static override styles = [rebootCss, dropdownCss, hostContentsCss];

  protected exportParts = new ShadowPartsController(this);

  override render() {
    return html`<hr part="wy-dropdown-divider" />`;
  }
}
