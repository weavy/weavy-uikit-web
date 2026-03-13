import { html, nothing } from "lit";
import { customElement } from "../../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { NamedEvent } from "../../types/generic.types";
import { WeavySubAppComponent } from "../../classes/weavy-sub-app-component";
import { ShadowPartsController } from "../../controllers/shadow-parts-controller";
import { WeavySubComponent } from "../../classes/weavy-sub-component";
import { WyActionEventDetailType, WyActionEventType } from "../../types/action.events";

import hostContentCss from "../../scss/host-contents.scss";

import "./wy-icon";
import "./wy-button";
import { ActionType } from "../../types/action.types";

declare global {
  interface HTMLElementTagNameMap {
    "wy-tag": WyTag;
    "wy-tag-list": WyTagList;
  }
}

/**
 * Annotation displayed as a small button.
 *
 * **Used sub components**
 *
 * - [`<wy-button>`](./wy-button.ts)
 * - [`<wy-icon>`](./wy-icon.ts)
 *
 * @fires {FileOpenEventType} file-open - When opening a file in preview is requested
 * @csspart wy-annotation - Annotation button.
 * @csspart wy-annotation-icon - The icon of the annotation button.
 * @csspart wy-annotation-text - The text of the annotation button.
 */
@customElement("wy-tag")
export class WyTag extends WeavySubComponent {
  static override styles = [hostContentCss];

  protected exportParts = new ShadowPartsController(this);

  /**
   * Triggers wy-action event.
   * @internal
   */
  dispatchAction(e: Event) {
    e.preventDefault();
    const event: WyActionEventType = new (CustomEvent as NamedEvent)("wy-action", {
      detail: { action: ActionType.Default } as WyActionEventDetailType,
    });
    return this.dispatchEvent(event);
  }

  override render() {
    return html`
      <wy-button
        part="wy-tag"
        @click=${(e: Event) => {
          !e.defaultPrevented && this.dispatchAction(e);
        }}
        kind="filled"
        small
      >
        <slot name="icon"></slot>
        <slot part="wy-annotation-text"></slot>
      </wy-button>
    `;
  }
}

/**
 * List of annotations. Displayed as inline buttons.
 *
 * **Used sub components**
 *
 * - [`<wy-tag>`](./wy-tag.ts)
 *
 * @fires {FileOpenEventType} file-open - When opening a file in preview is requested
 * @csspart wy-annotations - Wrapper for the annotations.
 */
@customElement("wy-tag-list")
export class WyTagList extends WeavySubAppComponent {
  static override styles = [hostContentCss];

  protected exportParts = new ShadowPartsController(this);

  tags: string[] = [];

  @property({ type: Boolean })
  editable: boolean = false;

  override render() {
    if (this.settings?.annotations === "none") {
      return nothing;
    }

    return html`
      <div part="wy-tags" ?contenteditable=${this.editable}>
        <span> ${this.tags.map((tag: string) => html`<wy-tag>${tag}</wy-tag>`)} </span>
      </div>
    `;
  }
}
