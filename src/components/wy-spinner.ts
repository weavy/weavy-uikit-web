import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";

@customElement("wy-spinner")
export default class WySpinner extends LitElement {
  @property({ type: Number })
  size: number = 24;

  @property({
    type: Boolean
  })
  nospin: boolean = false;

  @property({ type: Boolean })
  overlay: boolean = false;

  @property({ type: Number })
  progress?: number = NaN;

  protected override createRenderRoot(): HTMLElement | DocumentFragment {
    // Review: needed?
    return this;
  }

  override render() {
    const strokeDashoffset = (this.nospin && this.progress && 100 - this.progress) || undefined;

    if (strokeDashoffset !== undefined) {
      return html`<svg
        viewBox="0 0 24 24"
        width=${this.size}
        height=${this.size}
        transform="rotate(-90)"
        data-icon="progress"
        class="wy-icon wy-icon-primary">
        <circle cx="12" cy="12" r="10" stroke-linecap="butt" stroke-width="2" fill="none" stroke="#eee"></circle>
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke-dasharray="100"
          stroke-dashoffset=${strokeDashoffset}
          stroke-linecap="butt"
          stroke-width="2"
          fill="none"
          stroke="currentColor"
          path-length="100"></circle>
      </svg>`;
    } else {
      const spinnerClassNames = {
        "wy-spin": !this.nospin,
        "wy-spinner-overlay": this.overlay,
      };

      return html`<svg
        class="wy-spinner ${classMap(spinnerClassNames)}"
        width=${this.size}
        height=${this.size}
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg">
        <circle fill="none" cx="12" cy="12" r="11" stroke-linecap="butt" stroke-width="2" />
      </svg>`;
    }
  }
}
