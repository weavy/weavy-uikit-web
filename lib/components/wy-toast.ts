import { LitElement, type PropertyValues, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { createRef, ref } from "lit/directives/ref.js";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { whenElementVisible } from "../utils/dom";
import { clickOnEnterAndSpace } from "../utils/keyboard";

import overlayStyles from "../scss/all";

import "./wy-button";
import "./wy-icon";

@customElement("wy-toasts")
export class WyToasts extends LitElement {
  static override styles = [
    overlayStyles,
    css`
      :host {
        display: contents;
      }
    `,
  ];

  protected exportParts = new ShadowPartsController(this);

  @property({ type: Boolean })
  show = false;

  private viewportRef = createRef<HTMLDivElement>();

  close() {
    this.show = false;
    this.viewportRef.value?.hidePopover();
  }

  handleClose(e: ToggleEvent) {
    if (e.newState === "closed") {
      this.show = false;
      this.dispatchEvent(new CustomEvent("hide"));
      this.dispatchEvent(new CustomEvent("release-focus", { bubbles: true, composed: true }));
    }
  }

  override render() {
    return html`
      <div class="wy-toasts" tabindex="0" ${ref(this.viewportRef)} ?hidden=${!this.show} popover>
        <slot></slot>
      </div>
    `;
  }

  override willUpdate(changedProperties: PropertyValues<this>) {
    if (changedProperties.has("show")) {
      if (this.show) {
        this.viewportRef.value?.showPopover();
      } else {
        this.viewportRef.value?.hidePopover();
      }
    }
    if (changedProperties.has("show") && this.show) {
      this.viewportRef.value?.focus();
    }
  }

  protected override firstUpdated(_changedProperties: PropertyValues<this>) {
    this.viewportRef.value?.addEventListener("toggle", (e: Event) => {
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

@customElement("wy-toast")
export class WyToast extends LitElement {
  static override styles = [
    overlayStyles,
    css`
      :host {
        display: contents;
      }
    `,
  ];

  protected exportParts = new ShadowPartsController(this);

  private toastRef = createRef<HTMLDivElement>();

  static defaultDuration = 5000;

  @state()
  show = false;

  @property({ type: Number })
  duration: number = WyToast.defaultDuration;

  private timeout?: number;

  async close(silent: boolean = false) {
    this.show = false;
    await new Promise((r) => requestAnimationFrame(r));

    if (this.toastRef.value) {
      await whenElementVisible(this.toastRef.value, false);
    }
    this.dispatchEvent(new CustomEvent("closed", { detail: { silent }}));
    this.dispatchEvent(new CustomEvent("release-focus", { bubbles: true, composed: true }));
  }

  override async willUpdate(changedProperties: PropertyValues<this>) {
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
        class="wy-toast wy-fade ${this.show ? "wy-show" : ""}"
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
