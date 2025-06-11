import { LitElement, html, type PropertyValues } from "lit";
import { customElement } from "../../utils/decorators/custom-element";
import { property, queryAssignedElements, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { clickOnEnterAndConsumeOnSpace, clickOnEnterAndSpace, clickOnSpace } from "../../utils/keyboard";
import { ShadowPartsController } from "../../controllers/shadow-parts-controller";
import type { iconNamesType } from "../../utils/icons";
import { computePosition, autoUpdate, offset, flip, shift, type Placement } from "@floating-ui/dom";
import { isPopoverPolyfilled } from "../../utils/dom";

import rebootCss from "../../scss/components/base/reboot.scss";
import dropdownCss from "../../scss/components/dropdown.scss";
import hostContentsCss from "../../scss/host-contents.scss";

import WeavyIcon from "./wy-icon";
import "./wy-button";
import { ifDefined } from "lit/directives/if-defined.js";

@customElement("wy-dropdown")
export default class WyDropdown extends LitElement {
  static override styles = [
    rebootCss,
    dropdownCss,
  ];

  protected exportParts = new ShadowPartsController(this);

  @property()
  directionX: "left" | "right" = "right";

  @property()
  directionY: "up" | "down" = "down";

  @property()
  icon: iconNamesType = "dots-vertical";

  @property({ type: Boolean })
  small: boolean = false;

  @property({ type: Boolean })
  noWrapper: boolean = false;

  @property({ type: Boolean })
  disabled: boolean = false;

  @state()
  private _placement: Placement = "bottom-start";

  @state()
  showMenu: boolean = false;

  @queryAssignedElements({ slot: "button" })
  private _slotButton!: Array<HTMLElement>;

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
        this.showMenu = false
      }
    }
  };

  private handleClose(e: ToggleEvent) {
    if (e.type === "toggle" && e.newState === "closed" || e.type === "click") {
      this.showMenu = false;
      this.dispatchEvent(new CustomEvent("close"));
      this.dispatchEvent(new CustomEvent("release-focus", { bubbles: true, composed: true }));
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
            void computePosition(this.buttonRef.value, this.menuRef.value, {
              placement: this._placement,
              strategy: !this.menuRef.value.popover ? "fixed" : "absolute",
              middleware: [
                flip(),
                offset(({ placement }) => (placement.includes("top") ? 9 : 13)),
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
                  zIndex: !this.menuRef.value.popover ? 1075 : undefined
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
      this._slotButton.length === 0 || (this._slotButton.length === 1 && this._slotButton[0] instanceof WeavyIcon);

    return html`
      <span>
        <span
          ${ref(this.buttonRef)}
          @click=${(e: MouseEvent) => this.handleClickToggle(e)}
          @keydown=${clickOnEnterAndConsumeOnSpace}
          @keyup=${clickOnSpace}
        >
          <wy-button
            .kind=${isIcon ? "icon" : undefined}
            ?small=${this.small}
            title=${this.title}
            ?active=${this.showMenu}
            ?disabled=${this.disabled}
          >
            <slot name="button" @slotchange=${() => this.requestUpdate()}>
              <wy-icon name=${this.icon}></wy-icon>
            </slot>
          </wy-button>
        </span>

        <div
          ${ref(this.menuRef)}
          @click=${(e: MouseEvent) => this.handleClickToggle(e)}
          @keyup=${clickOnEnterAndSpace}
          class="wy-dropdown-menu"
          ?hidden=${isPopoverPolyfilled() && !this.showMenu}
          popover=${ifDefined(isPopoverPolyfilled() ? undefined : "auto")}
        >
          <slot></slot>
        </div>
      </span>
    `;
  }

  protected override firstUpdated(_changedProperties: PropertyValues<this>) {
    this.menuRef.value?.addEventListener(this.menuRef.value.popover ? "toggle" : "click", (e: Event) => this.handleClose(e as ToggleEvent));
  }

  override disconnectedCallback(): void {
    this.computePositionCleanup?.();
    super.disconnectedCallback();
  }
}

@customElement("wy-dropdown-item")
export class WyDropdownItem extends LitElement {
  static override styles = [
    rebootCss,
    dropdownCss,
    hostContentsCss,
  ];

  protected exportParts = new ShadowPartsController(this);

  @property({ type: Boolean })
  active: boolean = false;

  override render() {
    return html`<div class="wy-dropdown-item ${classMap({ "wy-active": this.active })}" tabindex="0"
      ><slot></slot
    ></div>`;
  }
}

@customElement("wy-dropdown-option")
export class WyDropdownOption extends LitElement {
  static override styles = [
    rebootCss,
    dropdownCss,
    hostContentsCss,
  ];

  protected exportParts = new ShadowPartsController(this);

  @property({ type: Boolean })
  active: boolean = false;

  @property({ type: Boolean })
  selected: boolean = false;

  override render() {
    const iconStyles = {
      visibility: !this.selected ? "hidden" : null,
    };
    return html`
      <div
        class="wy-dropdown-item wy-option ${classMap({ "wy-active": this.active, "wy-selected": this.selected })}"
        tabindex="0"
      >
        <slot name="icon" style=${styleMap(iconStyles)}><wy-icon name="check"></wy-icon></slot>
        <slot></slot>
      </div>
    `;
  }
}

@customElement("wy-dropdown-divider")
export class WyDropdownDivider extends LitElement {
  static override styles = [
    rebootCss,
    dropdownCss,
    hostContentsCss,
  ];

  protected exportParts = new ShadowPartsController(this);

  override render() {
    return html`<hr class="wy-dropdown-divider" />`;
  }
}
