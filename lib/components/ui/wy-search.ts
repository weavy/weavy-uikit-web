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
import { partMap } from "../../utils/directives/shadow-part-map";

import inputCss from "../../scss/components/input.scss";
import hostContentsCss from "../../scss/host-contents.scss";

import "./wy-icon";
import "./wy-button";

declare global {
  interface HTMLElementTagNameMap {
    "wy-search": WySearch;
  }
}

/**
 * Search input component.
 * 
 * **Used sub components**
 *
 * - [`<wy-button>`](./wy-button.ts)
 * - [`<wy-icon>`](./wy-icon.ts)
 *
 * @fires {SearchEventType} search - Query text when the search is updated. Throttled change as the user is typing.
 * 
 * @csspart wy-input - Input field.
 * @csspart wy-input-group - Wrapper for the inputs.
 * @csspart wy-input-group-input - Input field part of an input group.
 * @csspart wy-input-filled - Filled appearance of the input field.
 * @csspart wy-input-group-input-with-overlay - Input field when input and button are combined.
 * @csspart wy-input-group-button-icon - Button part of an input group.
 * @csspart wy-input-group-button-icon-overlay - Button  when input and button are combined.
 */
@customElement("wy-search")
@localized()
export class WySearch extends LitElement {
  static override styles = [inputCss, hostContentsCss];

  protected exportParts = new ShadowPartsController(this);
  private inputRef: Ref<HTMLInputElement> = createRef();

  /**
   * Text for the input placeholder. 
   */
  @property()
  placeholder?: string;

  /**
   * Whether the component should combine input field and button.
   */
  @property({ type: Boolean })
  compact: boolean = false;

  @state()
  query: string = "";

  /**
   * Put focus on the input field.
   */
  focusInput() {
    this.inputRef.value?.focus();
  }

  /**
   * Clear the input field.
   */
  clear() {
    this.query = "";
  }

  private throttledSearch = throttle(
    () => {
      this.query = this.inputRef.value?.value || "";
    },
    250,
    { leading: false, trailing: true }
  );

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
      "wy-input-group-input-with-overlay": this.compact,
    };

    const buttonMap = {
      "wy-input-group-button-icon": true,
      "wy-input-group-button-icon-overlay": this.compact,
    };

    return html`
      <div part="wy-input-group">
        <input
          part=${partMap(inputMap)}
          name="text"
          .value=${this.query || ""}
          ${ref(this.inputRef)}
          @input=${() => this.throttledSearch()}
          @keydown=${inputClearAndBlurOnEscape}
          @keyup=${inputConsume}
          placeholder=${this.placeholder || msg("Search...")}
          size="4"
        />
        <wy-button type="reset" @click=${() => this.clear()} kind="icon" part=${partMap(buttonMap)}>
          <wy-icon name="close-circle"></wy-icon>
        </wy-button>
        <wy-button kind="icon" part=${partMap(buttonMap)}>
          <wy-icon name="magnify"></wy-icon>
        </wy-button>
      </div>
    `;
  }
}
