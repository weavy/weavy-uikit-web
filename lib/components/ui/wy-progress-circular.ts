import { LitElement, html, nothing, svg } from "lit";
import { customElement } from "../../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { ShadowPartsController } from "../../controllers/shadow-parts-controller";
import { partMap } from "../../utils/directives/shadow-part-map";

import rebootCss from "../../scss/reboot.scss";
import progressCss from "../../scss/components/progress.scss";
import progressCircularCss from "../../scss/components/progress-circular.scss";
import hostContentsCss from "../../scss/host-contents.scss";

declare global {
  interface HTMLElementTagNameMap {
    "wy-progress-circular": WyProgressCircular;
  }
}

/**
 * Progress bar with percentage indicator, indeterminate, error and warning states.
 *
 * @csspart wy-progress - Base for progress.
 * @csspart wy-progress-reveal - When in revealing mode.
 * @csspart wy-progress-overlay - When in overlay layer.
 * @csspart wy-progress-padded - When padded.
 * @csspart wy-progress-circular - Progress wrapper.
 * @csspart wy-primary - Modifier for primary color.
 * @csspart wy-progress-indeterminate - When in indeterminate state.
 * @csspart wy-progress-circle - Progress circle.
 * @csspart wy-progress-indeterminate-circle - The circle when in indeterminate state.
 * @csspart wy-progress-remaining - The remainder circle when in progress state.
 * @csspart wy-progress-done - The done circle when in progress state.
 */
@customElement("wy-progress-circular")
export class WyProgressCircular extends LitElement {
  static override styles = [rebootCss, progressCss, progressCircularCss, hostContentsCss];

  protected shadowParts = new ShadowPartsController(this);

  /**
   * The size of the progress in pixels. The pixels are translated to rem size with a base of 16px/rem.
   */
  @property({ type: Number })
  size: number = 24;

  /**
   * Indeterminate state. Whether or not to display indeterminate progress, which gives no indication
   * to how long an activity will take. Overrides progress indication.
   */
  @property({ type: Boolean })
  indeterminate: boolean = false;

  /**
   * Use padding around the progress bar.
   */
  @property({ type: Boolean })
  padded: boolean = false;

  /**
   * Overlayed positioning.
   */
  @property({ type: Boolean })
  overlay: boolean = false;

  /**
   * Progress to display, a fraction between 0 and `max`.
   */
  @property({ type: Number })
  value = 0;

  /**
   * Maximum progress to display, defaults to 1.
   */
  @property({ type: Number })
  max = 1;

  /**
   * Reveals the progress after a delay. This makes the progress stay hidden when it has a rapid completion.
   */
  @property({ type: Boolean })
  reveal: boolean = false;

  override render() {
    const progressParts = {
      "wy-progress": true,
      "wy-progress-reveal": this.reveal,
      "wy-progress-overlay": this.overlay,
      "wy-progress-padded": this.padded,
    };

    const progressCircularParts = {
      "wy-progress-circular": true,
      "wy-primary": !this.indeterminate,
      "wy-progress-indeterminate": this.indeterminate,
    };

    const radius = 10;
    const circumReference = Math.PI * (radius * 2);

    let progress: number | undefined = undefined;

    
    try {
      if (Number.isFinite(this.value) && Number.isFinite(this.max) && this.max > 0) {
        progress = this.value / this.max; 
      }
    } catch (e) {
      console.error(e);
    }

    return html`
      <div part="${partMap(progressParts)}">
        ${this.indeterminate || progress === undefined
          ? svg`
              <svg
                part="${partMap(progressCircularParts)}"
                viewBox="0 0 24 24"
                width=${this.size}
                height=${this.size}
                role="progressbar"
                aria-label="${nothing}"
                aria-valuemin="0"
                aria-valuemax=${this.max}
                aria-valuenow=${nothing}
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle
                  part="wy-progress-circle wy-progress-indeterminate-circle"
                  fill="none"
                  cx="12"
                  cy="12"
                  r=${radius}
                  stroke-linecap="butt"
                  stroke-width="2"
                ></circle>
              </svg>
            `
          : svg`
              <svg
                part="${partMap(progressCircularParts)}"
                viewBox="0 0 24 24"
                width=${this.size}
                height=${this.size}
                transform="rotate(-90)"
                role="progressbar"
                aria-label="${nothing}"
                aria-valuemin="0"
                aria-valuemax=${this.max}
                aria-valuenow=${this.value}
                xmlns="http://www.w3.org/2000/svg"
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
                  stroke-dashoffset=${circumReference * (1 - progress)}
                  stroke-linecap="butt"
                  stroke-width="2"
                  fill="none"
                  stroke="currentColor"
                  path-length="200"
                ></circle>
              </svg>
            `}
      </div>
    `;
  }
}
