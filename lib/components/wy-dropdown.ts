import { LitElement, html, css, type PropertyValues } from "lit";
import { customElement, property, queryAssignedElements, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { clickOnEnterAndConsumeOnSpace, clickOnEnterAndSpace, clickOnSpace } from "../utils/keyboard";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import type { iconNamesType } from "../utils/icons";
import { computePosition, autoUpdate, offset, flip, shift, type Placement } from "@floating-ui/dom";

import rebootStyles from "../scss/components/base/reboot.scss";
import dropdownStyles from "../scss/components/dropdown.scss";
import WeavyIcon from "./wy-icon";
import "./wy-button";

@customElement("wy-dropdown")
export default class WyDropdown extends LitElement {
  static override styles = [
    rebootStyles,
    dropdownStyles,
    css`
      /*:host {
        position: relative;
      }*/
    `,
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
  show: boolean = false;

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

  protected override willUpdate(changedProperties: PropertyValues<this>): void {
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
      if (this.show && !this.computePositionCleanup && this.buttonRef.value && this.menuRef.value) {
        this.computePositionCleanup = autoUpdate(this.buttonRef.value, this.menuRef.value, () => {
          if (this.buttonRef.value && this.menuRef.value) {
            computePosition(this.buttonRef.value, this.menuRef.value, {
              placement: this._placement,
              strategy: "absolute",
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
                });
              }
            });
          }
        });
      } else if (!this.show && this.computePositionCleanup) {
        this.computePositionCleanup();
        this.computePositionCleanup = undefined;
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
  }

  override render() {
    const isIcon =
      this._slotButton.length === 0 || (this._slotButton.length === 1 && this._slotButton[0] instanceof WeavyIcon);

    return html`
      <span>
        <span
          ${ref(this.buttonRef)}
          @click=${this.handleClickToggle}
          @keydown=${clickOnEnterAndConsumeOnSpace}
          @keyup=${clickOnSpace}
        >
          <wy-button
            .kind=${isIcon ? "icon" : undefined}
            ?small=${this.small}
            title=${this.title}
            ?active=${this.show}
            ?disabled=${this.disabled}
          >
            <slot name="button" @slotchange=${() => this.requestUpdate()}>
              <wy-icon name=${this.icon}></wy-icon>
            </slot>
          </wy-button>
        </span>

        <div
          ${ref(this.menuRef)}
          @click=${this.handleClickToggle}
          @keyup=${clickOnEnterAndSpace}
          class="wy-dropdown-menu"
          ?hidden=${!this.show}
          popover
        >
          <slot></slot>
        </div>
      </span>
    `;
  }

  protected override firstUpdated(_changedProperties: PropertyValues<this>) {
    this.menuRef.value?.addEventListener("toggle", (e: Event) => this.handleClose(e as ToggleEvent));
  }

  override disconnectedCallback(): void {
    this.computePositionCleanup?.();
    super.disconnectedCallback();
  }
}

@customElement("wy-dropdown-item")
export class WyDropdownItem extends LitElement {
  static override styles = [
    rebootStyles,
    dropdownStyles,
    css`
      :host {
        display: contents;
      }
    `,
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
    rebootStyles,
    dropdownStyles,
    css`
      :host {
        display: contents;
      }
    `,
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
    rebootStyles,
    dropdownStyles,
    css`
      :host {
        display: contents;
      }
    `,
  ];

  protected exportParts = new ShadowPartsController(this);

  override render() {
    return html`<hr class="wy-dropdown-divider" />`;
  }
}
