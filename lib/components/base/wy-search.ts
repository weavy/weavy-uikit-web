import { LitElement, PropertyValueMap, html } from "lit";
import { customElement } from "../../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { localized, msg } from "@lit/localize";
import { ShadowPartsController } from "../../controllers/shadow-parts-controller";
import throttle from "lodash.throttle";
import { inputClearAndBlurOnEscape, inputConsume } from "../../utils/keyboard";
import { createRef, ref, type Ref } from "lit/directives/ref.js";
import { SearchEventType } from "../../types/search.events";
import { NamedEvent } from "../../types/generic.types";

import inputCss from "../../scss/components/input.scss";
import hostContentsCss from "../../scss/host-contents.scss";

import "./wy-icon";
import "./wy-button";
import { classMap } from "lit/directives/class-map.js";

/**
 * Search input component
 * 
 * @fires {SearchEventType} search - Query text when the search is updated. Throttled change as the user is typing.
 */
@customElement("wy-search")
@localized()
export default class WySearch extends LitElement {
  static override styles = [inputCss, hostContentsCss];

  protected exportParts = new ShadowPartsController(this);
  private inputRef: Ref<HTMLInputElement> = createRef();

  @property()
  placeholder?: string;

  @property({ type: Boolean })
  compact: boolean = false;

  @state()
  query: string = "";

  focusInput() {
    this.inputRef.value?.focus()
  }

  private throttledSearch = throttle(
    () => {
      this.query = this.inputRef.value?.value || "";
    },
    250,
    { leading: false, trailing: true }
  );

  private clear() {
    this.query = "";
  }

  protected override willUpdate(changedProperties: PropertyValueMap<this>): void {
    if (changedProperties.has("query")) {
      const searchEvent: SearchEventType = new (CustomEvent as NamedEvent)("search", {
        bubbles: true,
        composed: false,
        detail: { query: this.query },
      });
      this.dispatchEvent(searchEvent);
    }
  }

  override render() {
    const inputMap = {
      "wy-input": true,
      "wy-input-group-input": true,
      "wy-input-filled": true,
      "wy-input-group-input-with-overlay": this.compact
    }

    const buttonMap = {
      "wy-input-group-button-icon": true,
      "wy-input-group-button-icon-overlay": this.compact 
    }

    return html`
      <div class="wy-input-group">
        <input
          class=${classMap(inputMap)}
          name="text"
          .value=${this.query || ""}
          ${ref(this.inputRef)}
          @input=${() => this.throttledSearch()}
          @keydown=${inputClearAndBlurOnEscape}
          @keyup=${inputConsume}
          placeholder=${this.placeholder || msg("Search...")}
          size="4"
        />
        <wy-button type="reset" @click=${() => this.clear()} kind="icon" class=${classMap(buttonMap)}>
          <wy-icon name="close-circle"></wy-icon>
        </wy-button>
        <wy-button kind="icon" class=${classMap(buttonMap)}>
          <wy-icon name="magnify"></wy-icon>
        </wy-button>
      </div>
    `;
  }
}
