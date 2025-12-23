import { LitElement, html, nothing } from "lit";
import { customElement } from "../../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { ShadowPartsController } from "../../controllers/shadow-parts-controller";
import { partMap } from "../../utils/directives/shadow-part-map";
import { styleMap } from "lit/directives/style-map.js";

import rebootCss from "../../scss/reboot.scss";
import progressCss from "../../scss/components/progress.scss";
import progressLinearCss from "../../scss/components/progress-linear.scss";

declare global {
  interface HTMLElementTagNameMap {
    "wy-progress-linear": WyProgressLinear;
  }
}

/**
 * Progress bar with percentage indicator, indeterminate, error and warning states.
 * 
 * @csspart wy-progress - Base for progress.
 * @csspart wy-progress-linear - Progress wrapper.
 * @csspart wy-progress-overlay - When in overlay layer.
 * @csspart wy-progress-padded - When padded.
 * @csspart wy-progress-reveal - When in revealing mode.
 * @csspart wy-progress-indeterminate - When in indeterminate state.
 * @csspart wy-progress-warning - When in warning state.
 * @csspart wy-progress-error - When in error state.
 * @csspart wy-inactive-track - Track background.
 * @csspart wy-bar - Wrapper for a bar.
 * @csspart wy-bar-inner - Inner content of a bar.
 * @csspart wy-primary-bar - First bar, used for progress and indeterminate state.
 * @csspart wy-secondary-bar - Second bar, used for indeterminate state.
 */
@customElement("wy-progress-linear")
export class WyProgressLinear extends LitElement {
  static override styles = [rebootCss, progressCss, progressLinearCss];

  protected shadowParts = new ShadowPartsController(this);

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
   * Reveals the progress after a delay. This makes the progress stay hidden when it has a rapid completion.
   */
  @property({ type: Boolean })
  reveal: boolean = false;

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
   * Indeterminate state. Whether or not to display indeterminate progress, which gives no indication
   * to how long an activity will take. Overrides progress indication.
   */
  @property({ type: Boolean }) 
  indeterminate = false;

  /**
   * Warning state. Overrides normal states.
   */
  @property({ type: Boolean }) 
  warning = false;

  /**
   * Error state. Overrides all states.
   */
  @property({ type: Boolean }) 
  error = false;

  override render() {
    let progress: number | undefined = undefined;

    try {
      if (Number.isFinite(this.value) && Number.isFinite(this.max) && this.max > 0) {
        progress = this.value / this.max; 
      }
    } catch (e) {
      console.error(e);
    }

    const isIndeterminate =  this.indeterminate || progress === undefined;

    const progressStyles = {
      transform: `scaleX(${(isIndeterminate ? 1 : this.value / this.max) * 100}%)`,
    };

    const renderParts = {
      "wy-progress": true,
      "wy-progress-linear": true,
      "wy-progress-indeterminate": isIndeterminate,
      "wy-progress-overlay": this.overlay,
      "wy-progress-padded": this.padded,
      "wy-progress-reveal": this.reveal,
      "wy-progress-warning": this.warning,
      "wy-progress-error": this.error
    };

    return html`
      <div
        part=${partMap(renderParts)}
        role="progressbar"
        aria-label="${nothing}"
        aria-valuemin="0"
        aria-valuemax=${this.max}
        aria-valuenow=${isIndeterminate ? nothing : this.value}
      >
        <div part="wy-inactive-track"></div>
        <div part="wy-bar wy-primary-bar" style=${styleMap(progressStyles)}>
          <div part="wy-bar-inner"></div>
        </div>
        <div part="wy-bar wy-secondary-bar">
          <div part="wy-bar-inner"></div>
        </div>
      </div>
    `;
  }
}
