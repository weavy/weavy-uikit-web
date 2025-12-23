import { LitElement, type PropertyValues, html } from "lit";
import { customElement } from "../../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { createRef, ref } from "lit/directives/ref.js";
import { ShadowPartsController } from "../../controllers/shadow-parts-controller";
import { whenElementVisible } from "../../utils/dom";
import { clickOnEnterAndSpace } from "../../utils/keyboard";
import { ClosedEventType, HideEventType } from "../../types/ui.events";
import { NamedEvent } from "../../types/generic.types";

import toastCss from "../../scss/components/toast.scss";
import hostContentsCss from "../../scss/host-contents.scss";

import "./wy-button";
import "./wy-icon";

declare global {
  interface HTMLElementTagNameMap {
    "wy-toasts": WyToasts;
    "wy-toast": WyToast;
  }
}

/**
 * Wrapper for displaying and handling toasts as popovers.
 * 
 * @slot - Any `wy-toasts` to show.
 * 
 * @csspart wy-toasts - Popover layer for toasts.
 * 
 * @fires {HideEventType} hide - Fired when the popover layer is hidden.
 */
@customElement("wy-toasts")
export class WyToasts extends LitElement {
  static override styles = [
    toastCss,
    hostContentsCss,
  ];

  protected exportParts = new ShadowPartsController(this);

  /**
   * Whether the popover layer is shown.
   */
  @property({ type: Boolean })
  show = false;

  private viewportRef = createRef<HTMLDivElement>();

  /**
   * Close the popover layer.
   */
  close() {
    this.show = false;
    try {
      this.viewportRef.value?.hidePopover();
    } catch {
      /* No worries */
    }
  }

  /**
   * Handler when popover is toggled.
   * @internal
   */
  handleClose(e: ToggleEvent) {
    if ((e.type === "toggle" && e.newState === "closed") || e.type === "click") {
      this.show = false;
      const event: HideEventType = new (CustomEvent as NamedEvent)("hide")
      this.dispatchEvent(event);
    }
  }

  override render() {
    return html`
      <div part="wy-toasts" tabindex="0" ${ref(this.viewportRef)} ?hidden=${!this.show} popover="auto">
        <slot></slot>
      </div>
    `;
  }

  override willUpdate(changedProperties: PropertyValues<this>): void {
    super.willUpdate(changedProperties);

    if (changedProperties.has("show")) {
      try {
        if (this.show) {
          this.viewportRef.value?.showPopover();
        } else {
          this.viewportRef.value?.hidePopover();
        }
      } catch {
        /* No worries */
      }
    }
    if (changedProperties.has("show") && this.show) {
      this.viewportRef.value?.focus();
    }
  }

  protected override firstUpdated(_changedProperties: PropertyValues<this>) {
    this.viewportRef.value?.addEventListener(this.viewportRef.value.popover ? "toggle" : "click", (e: Event) => {
      this.handleClose(e as ToggleEvent);
    });
    if (this.show) {
      this.viewportRef.value?.showPopover();
    }
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    //this.close();
  }
}

/**
 * Toast for displaying information, messages and alerts. May be handled by `wy-toasts` for popover capability.
 * 
 * @slot - Content for the toast.
 * 
 * @csspart wy-toast - The wrapper for the toast.
 * @csspart wy-fade - State for using fade effects.
 * @csspart wy-show - State when the toast is shown.
 * 
 * @fires {ClosedEventType} closed - When the toast has closed.
 */
@customElement("wy-toast")
export class WyToast extends LitElement {
  static override styles = [
    toastCss,
    hostContentsCss,
  ];

  protected exportParts = new ShadowPartsController(this);

  private toastRef = createRef<HTMLDivElement>();

  static defaultDuration = 5000;

  /**
   * Whether the toast is considered visible.
   * @internal
   */
  @state()
  show = false;

  /**
   * Duration for the toast to show.
   * Defaults to 5000ms.
   */
  @property({ type: Number })
  duration: number = WyToast.defaultDuration;

  private timeout?: number;

  /**
   * Hide the toast.
   */
  hide() {
    this.show = false;
  }

  /**
   * Hide and close the toast.
   * 
   * @param silent - Indicates that the toast should close silently.
   * @fires {ClosedEventType} closed - When the toast has been hidden and closed.
   */
  async close(silent: boolean = false) {
    this.show = false;
    await new Promise((r) => requestAnimationFrame(r));

    if (this.toastRef.value) {
      await whenElementVisible(this.toastRef.value, false);
    }
    const event: ClosedEventType = new (CustomEvent as NamedEvent)("closed", { detail: { silent } });
    this.dispatchEvent(event);
  }

  override willUpdate(changedProperties: PropertyValues<this>): void {
    super.willUpdate(changedProperties);

    if (changedProperties.has("show")) {
      if (this.timeout) {
        window.clearTimeout(this.timeout);
        this.timeout = undefined;
      }

      if (this.show && this.duration > 0 && this.duration < Infinity) {
        this.timeout = window.setTimeout(() => this.close(true), this.duration);
      }
    }
  }

  override render() {
    return html`
      <div
        ${ref(this.toastRef)}
        part="wy-toast wy-fade ${this.show ? "wy-show" : ""}"
        @hide=${(e: HideEventType) => { e.stopPropagation(); this.hide() }}
        @close=${() => this.close()}
        @keyup=${clickOnEnterAndSpace}
      >
        <slot></slot>
      </div>
    `;
  }

  protected override firstUpdated(): void {
    requestAnimationFrame(() => {
      this.show = true;
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.timeout) {
      window.clearTimeout(this.timeout);
      this.timeout = undefined;
    }
  }
}
