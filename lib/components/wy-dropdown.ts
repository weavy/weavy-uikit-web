
import { LitElement, html, css, type PropertyValues } from "lit";
import { customElement, property, queryAssignedElements, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";

import { type Placement as PopperPlacement, type Instance as PopperInstance, createPopper } from "@popperjs/core";
import { clickOnEnterAndConsumeOnSpace, clickOnSpace } from "../utils/keyboard";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";

import rebootStyles from "../scss/wrappers/base/reboot";
import dropdownStyles from "../scss/wrappers/dropdown";
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
  icon: string = "dots-vertical";

  @property({ type: Boolean })
  small: boolean = false;

  @property({ type: Boolean })
  noWrapper: boolean = false;

  @property({ type: Boolean })
  disabled: boolean = false;

  @state()
  private _placement: PopperPlacement = "bottom-start";

  private wasVisible: boolean = false;

  @state()
  visible: boolean = false;

  @queryAssignedElements({ slot: "button" })
  private _slotButton!: Array<HTMLElement>;

  @state()
  private _popper?: PopperInstance;

  private popperReferenceRef: Ref<Element> = createRef();
  private popperElementRef: Ref<HTMLSlotElement> = createRef();

  constructor() {
    super();
    this.addEventListener("click", (e: Event) => {
      e.stopPropagation();
    });
  }

  private _documentClickHandler = (e: Event) => {
    this.wasVisible = this.visible;

    if (this.visible) {
      e.preventDefault();
      this.visible = false;
    } 
  };

  private handleClickToggle(e: Event) {
    if (!e.defaultPrevented || (e.defaultPrevented && !this.wasVisible)) {
      this.visible = !this.visible;
    }
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

    if (changedProperties.has("visible")) {
      if (this.visible) {
        requestAnimationFrame(() => {
          document.addEventListener("click", this._documentClickHandler, { once: true, capture: true });
        });
      } else {
        requestAnimationFrame(() => {
          this.wasVisible = false;
        });
      }

      if (this.visible && !this._popper && this.popperReferenceRef.value && this.popperElementRef.value) {
        this._popper = createPopper(this.popperReferenceRef.value, this.popperElementRef.value);
      } else if (!this.visible && this._popper) {
        this._popper.destroy();
        this._popper = undefined;
      }

      this._popper?.setOptions({
        placement: this._placement,
        //strategy: 'fixed',
        modifiers: [
          {
            name: "offset",
            options: {
              offset: ({ placement }: { placement: PopperPlacement }) => [0, placement.includes("top") ? 9 : 13],
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
  }

  override render() {
    const isIcon =
      this._slotButton.length === 0 || (this._slotButton.length === 1 && this._slotButton[0] instanceof WeavyIcon);

    return html`
      <span @click=${this.handleClickToggle} @keydown=${clickOnEnterAndConsumeOnSpace} @keyup=${clickOnSpace}>
        <span ${ref(this.popperReferenceRef)}>
          <wy-button
            .kind=${isIcon ? "icon" : undefined}
            ?small=${this.small}
            title=${this.title}
            ?active=${this.visible}
            ?disabled=${this.disabled}
          >
            <slot name="button" @slotchange=${() => this.requestUpdate()}>
              <wy-icon name=${this.icon}></wy-icon>
            </slot>
          </wy-button>
        </span>

        <div ${ref(this.popperElementRef)} class="wy-dropdown-menu" ?hidden=${!this.visible}>
          <slot></slot>
        </div>
      </span>
    `;
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
      <div class="wy-dropdown-item wy-option ${classMap({ "wy-active": this.active, "wy-selected": this.selected })}">
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
