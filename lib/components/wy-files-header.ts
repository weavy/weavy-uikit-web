import { html, nothing } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { localized, msg } from "@lit/localize";
import type { FileOrderType, FileViewType } from "../types/files.types";
import { openUrl } from "../utils/urls";
import { WeavySubAppComponent } from "../classes/weavy-sub-app-component";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import type { NamedEvent } from "../types/generic.types";
import type { OrderEventType, ShowTrashedEventType, ViewEventType } from "../types/lists.events";
import type { SubscribeEventType } from "../types/app.events";
import { normalizeAppearanceMode, type AppearanceModeType } from "../types/ui.types";

import headerCss from "../scss/components/header.scss";
import toolbarCss from "../scss/components/toolbar.scss";
import hostContentsCss from "../scss/host-contents.scss";

import "./ui/wy-button";
import "./ui/wy-dropdown";
import "./ui/wy-icon";
import "./ui/wy-progress-circular";
import "./ui/wy-overlay";
import "./ui/wy-container";
import "./wy-cloud-files";
import "./wy-context-data";
import "./wy-empty";
import "./wy-file-create";

declare global {
  interface HTMLElementTagNameMap {
    "wy-files-header": WyFilesHeader;
  }
}

/**
 * Header toolbar for the files view — actions for uploading, sorting, view options and notifications.
 *
 * **Used sub components:**
 *
 * - [`<wy-button>`](./ui/wy-button.ts)
 * - [`<wy-dropdown>`](./ui/wy-dropdown.ts)
 * - [`<wy-icon>`](./ui/wy-icon.ts)
 * - [`<wy-progress-circular>`](./ui/wy-progress-circular.ts)
 * - [`<wy-overlay>`](./ui/wy-overlay.ts)
 * - [`<wy-container>`](./ui/wy-container.ts)
 * - [`<wy-cloud-files>`](./wy-cloud-files.ts)
 * - [`<wy-context-data-progress>`](./wy-context-data.ts)
 *
 * @slot title - Title placed in the toolbar.
 * @slot actions - Buttons placed in the toolbar.
 *
 * @csspart wy-files-header - Root header container
 * @csspart wy-header - Header area
 * @csspart wy-header-outer - Outer styling for header area.
 * @csspart wy-files-header-toolbar - Toolbar in the header
 * @csspart wy-toolbar - Toolbar container for header actions
 * @csspart wy-toolbar-buttons - Group for toolbar buttons
 * @csspart wy-toolbar-buttons-last - Right aligned toolbar button group
 *
 * @fires {WyActionEventType} wy-action - Emitted when a file is created. Editable files use `edit` and are opened in edit mode, other files use `select` and are selected.
 * @fires {OrderEventType<FileOrderType>} order - Emitted when the user changes sort order.
 * @fires {ViewEventType<FileViewType>} view - Emitted when the user changes the view mode (list/grid).
 * @fires {ShowTrashedEventType} show-trashed - Emitted when the show/hide trashed toggle is changed.
 * @fires {SubscribeEventType} subscribe - Emitted when the app subscribe/unsubscribe action is triggered.
 */
@customElement("wy-files-header")
@localized()
export class WyFilesHeader extends WeavySubAppComponent {
  static override styles = [headerCss, toolbarCss, hostContentsCss];

  /** @internal */
  protected exportParts = new ShadowPartsController(this);

  /**
   * Appearance of the file list header
   * @type {"interactive" | "empty" | "none"}
   * @default "interactive"
   */
  @property()
  header: AppearanceModeType = "interactive";

  /**
   * Active sort order for the list.
   */
  @property({ type: Object })
  order: FileOrderType = { by: "name", descending: false };

  /**
   * Active layout for rendering files.
   */
  @property()
  view: "grid" | "list" = "list";

  /**
   * Show trashed files when enabled.
   */
  @property({ type: Boolean })
  showTrashed: boolean = false;

  /**
   * Emit an `order` event reflecting the chosen sort order.
   *
   * @internal
   * @param order - Order to apply.
   * @returns {boolean} True if the event was not canceled.
   */
  private dispatchOrder(order: FileOrderType) {
    const orderEvent: OrderEventType<FileOrderType> = new (CustomEvent as NamedEvent)("order", { detail: { order } });
    return this.dispatchEvent(orderEvent);
  }

  /**
   * Emit a `view` event for changing layout mode.
   *
   * @internal
   * @param view - Layout to activate.
   * @returns {boolean} True if the event was not canceled.
   */
  private dispatchView(view: typeof this.view) {
    const viewEvent: ViewEventType<FileViewType> = new (CustomEvent as NamedEvent)("view", { detail: { view } });
    return this.dispatchEvent(viewEvent);
  }

  /**
   * Emit a `show-trashed` event to toggle trashed visibility.
   *
   * @internal
   * @param showTrashed - Whether to show trashed files.
   * @returns {boolean} True if the event was not canceled.
   */
  private dispatchShowTrashed(showTrashed: boolean) {
    const showTrashedEvent: ShowTrashedEventType = new (CustomEvent as NamedEvent)("show-trashed", {
      detail: { showTrashed },
    });
    return this.dispatchEvent(showTrashedEvent);
  }

  /**
   * Emit a `subscribe` event to toggle app subscription.
   *
   * @internal
   * @param subscribe - Desired subscription state.
   * @returns {boolean} True if the event was not canceled.
   */
  private dispatchSubscribe(subscribe: boolean) {
    const subscribeEvent: SubscribeEventType = new (CustomEvent as NamedEvent)("subscribe", { detail: { subscribe } });
    return this.dispatchEvent(subscribeEvent);
  }

  override render() {
    const header = normalizeAppearanceMode(this.header);
    if (header === "none") {
      return nothing;
    }

    return html`
      <header part="wy-files-header wy-header wy-header-outer">
        <nav part="wy-files-header-toolbar wy-toolbar">
          <div part="wy-toolbar-buttons">
            <slot name="title"></slot>
            ${header === "interactive"
              ? html`
                  <wy-file-create></wy-file-create>
                `
              : nothing}
          </div>
          <div part="wy-toolbar-buttons wy-toolbar-buttons-last">
            <slot name="actions"></slot>

            ${header === "interactive"
              ? html`
                  <wy-dropdown icon="sort" title="Sort items by" directionX="left">
                    <wy-dropdown-option
                      ?selected=${this.order.by === "name"}
                      @click=${() => this.dispatchOrder({ ...this.order, by: "name" })}
                    >
                      ${msg("Name")}
                    </wy-dropdown-option>
                    <wy-dropdown-option
                      ?selected=${this.order.by === "updated_at"}
                      @click=${() => this.dispatchOrder({ ...this.order, by: "updated_at" })}
                    >
                      ${msg("Modified")}
                    </wy-dropdown-option>
                    <wy-dropdown-option
                      ?selected=${this.order.by === "size"}
                      @click=${() => this.dispatchOrder({ ...this.order, by: "size" })}
                    >
                      ${msg("Size")}
                    </wy-dropdown-option>
                    <wy-dropdown-divider></wy-dropdown-divider>
                    <wy-dropdown-option
                      ?selected=${!this.order.descending}
                      @click=${() => this.dispatchOrder({ ...this.order, descending: false })}
                    >
                      ${msg("Ascending")}
                    </wy-dropdown-option>
                    <wy-dropdown-option
                      ?selected=${this.order.descending}
                      @click=${() => this.dispatchOrder({ ...this.order, descending: true })}
                    >
                      ${msg("Descending")}
                    </wy-dropdown-option>
                  </wy-dropdown>

                  <wy-dropdown
                    icon=${this.view === "grid" ? "view-module-outline" : "view-list-outline"}
                    title="View options"
                    directionX="left"
                  >
                    <wy-dropdown-option ?selected=${this.view === "list"} @click=${() => this.dispatchView("list")}>
                      ${msg("List view")}
                    </wy-dropdown-option>
                    <wy-dropdown-option ?selected=${this.view === "grid"} @click=${() => this.dispatchView("grid")}>
                      ${msg("Grid view")}
                    </wy-dropdown-option>
                    <wy-dropdown-divider></wy-dropdown-divider>
                    <wy-dropdown-option ?selected=${!this.showTrashed} @click=${() => this.dispatchShowTrashed(false)}>
                      ${msg("Hide trashed")}
                    </wy-dropdown-option>
                    <wy-dropdown-option ?selected=${this.showTrashed} @click=${() => this.dispatchShowTrashed(true)}>
                      ${msg("Show trashed")}
                    </wy-dropdown-option>
                  </wy-dropdown>

                  <wy-dropdown directionX="left" ?disabled=${!this.app}>
                    ${this.app?.is_subscribed
                      ? html`<wy-dropdown-item @click=${() => this.dispatchSubscribe(false)}>
                          <wy-icon name="bell-off"></wy-icon>
                          ${msg("Unsubscribe")}
                        </wy-dropdown-item>`
                      : html`<wy-dropdown-item @click=${() => this.dispatchSubscribe(true)}>
                          <wy-icon name="bell"></wy-icon>
                          ${msg("Subscribe")}
                        </wy-dropdown-item>`}
                    ${this.app?.archive_url
                      ? html`<wy-dropdown-item
                          @click=${() =>
                            openUrl(
                              this.app?.archive_url,
                              "_top",
                              `${this.app?.uid ? this.app.uid : `${this.app?.type}-${this.app?.id}`}.zip`,
                              true,
                            )}
                        >
                          <wy-icon name="download"></wy-icon>
                          ${msg("Download files")}
                        </wy-dropdown-item>`
                      : nothing}
                  </wy-dropdown>
                `
              : nothing}
          </div>
        </nav>

        <wy-context-data-progress></wy-context-data-progress>
      </header>
    `;
  }
}
