import { LitElement, css, html } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { partMap } from "../utils/directives/shadow-part-map";

import rebootCss from "../scss/components/base/reboot.scss";
import spinnerCss from "../scss/components/spinner.scss";
import progressCss from "../scss/components/progress.scss";

@customElement("wy-spinner")
export default class WySpinner extends LitElement {
  static override styles = [
    rebootCss,
    spinnerCss,
    progressCss,
    css`
      :host {
        display: contents;
      }
    `,
  ];

  protected shadowParts = new ShadowPartsController(this);

  @property({ type: Number })
  size: number = 24;

  @property({ type: Boolean })
  noSpin: boolean = false;

  @property({ type: Boolean })
  padded: boolean = false;

  @property({ type: Boolean })
  overlay: boolean = false;

  @property({ type: Number })
  progress?: number = NaN;

  @property({ type: Boolean })
  reveal: boolean = false;

  override render() {
    const remaining = (this.noSpin && this.progress && 100 - this.progress) || undefined;

    if (remaining !== undefined) {
      const radius = 10;
      const circumReference = Math.PI * (radius * 2);

      const progressParts = {
        "wy-progress": true,
        "wy-primary": true,
        "wy-progress-padded": this.padded,
        "wy-progress-reveal": this.reveal,
      };

      return html`<svg
        part="${partMap(progressParts)}"
        viewBox="0 0 24 24"
        width=${this.size}
        height=${this.size}
        transform="rotate(-90)"
      >
        <circle
          part="wy-progress-circle wy-progress-remaining"
          cx="12"
          cy="12"
          r=${radius}
          stroke-linecap="butt"
          stroke-width="2"
          fill="none"
          stroke="#eee"
        ></circle>
        <circle
          part="wy-progress-circle wy-progress-done"
          cx="12"
          cy="12"
          r=${radius}
          stroke-dasharray=${circumReference}
          stroke-dashoffset=${(circumReference * remaining) / 100}
          stroke-linecap="butt"
          stroke-width="2"
          fill="none"
          stroke="currentColor"
          path-length="200"
        ></circle>
      </svg>`;
    } else {
      const spinnerParts = {
        "wy-spinner": true,
        "wy-spin": !this.noSpin,
        "wy-spinner-overlay": this.overlay,
        "wy-spinner-padded": this.padded,
        "wy-spinner-reveal": this.reveal,
      };

      const spinnerCircleParts = {
        "wy-spinner-circle": true,
        "wy-spin": !this.noSpin,
      };

      return html`<svg
        part="${partMap(spinnerParts)}"
        width=${this.size}
        height=${this.size}
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          part="${partMap(spinnerCircleParts)}"
          fill="none"
          cx="12"
          cy="12"
          r="11"
          stroke-linecap="butt"
          stroke-width="2"
        />
      </svg>`;
    }
  }
}
