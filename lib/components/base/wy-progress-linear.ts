import { LitElement, html, nothing } from "lit";
import { customElement } from "../../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { ShadowPartsController } from "../../controllers/shadow-parts-controller";
import { partMap } from "../../utils/directives/shadow-part-map";
import { styleMap } from "lit/directives/style-map.js";

import rebootCss from "../../scss/components/base/reboot.scss";
import progressLinearCss from "../../scss/components/progress-linear.scss";

@customElement("wy-progress-linear")
export default class WyProgressLinear extends LitElement {
  static override styles = [rebootCss, progressLinearCss];

  protected shadowParts = new ShadowPartsController(this);

  @property({ type: Boolean })
  padded: boolean = false;

  @property({ type: Boolean })
  overlay: boolean = false;

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
   * Whether or not to display indeterminate progress, which gives no indication
   * to how long an activity will take.
   */
  @property({ type: Boolean }) 
  indeterminate = false;

  @property({ type: Boolean }) 
  warning = false;

  @property({ type: Boolean }) 
  error = false;

  override render() {
    const progressStyles = {
      transform: `scaleX(${(this.indeterminate ? 1 : this.value / this.max) * 100}%)`,
    };

    const renderParts = {
      "wy-indeterminate": this.indeterminate,
      "wy-progress-overlay": this.overlay,
      "wy-progress-reveal": this.reveal,
      "wy-progress-warning": this.warning,
      "wy-progress-error": this.error
    };

    return html`
      <div
        part="wy-progress ${partMap(renderParts)}"
        role="progressbar"
        aria-label="${nothing}"
        aria-valuemin="0"
        aria-valuemax=${this.max}
        aria-valuenow=${this.indeterminate ? nothing : this.value}
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
