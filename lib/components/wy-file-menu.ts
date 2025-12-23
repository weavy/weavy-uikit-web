import { LitElement, html, nothing } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { msg, localized, str } from "@lit/localize";
import { consume } from "@lit/context";
import { getIcon } from "../utils/files";
import { type FileType } from "../types/files.types";
import { openUrl } from "../utils/urls";
import { toKebabCase } from "../utils/strings";
import { type ComponentFeaturePolicy, FeaturePolicyContext } from "../contexts/features-context";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { iconNamesType } from "../utils/icons";
import { Feature } from "../types/features.types";
import {
  FileDeleteForeverEventType,
  FileEditNameEventType,
  FileRestoreEventType,
  FileSubscribeEventType,
  FileTrashEventType,
} from "../types/files.events";
import { NamedEvent } from "../types/generic.types";

import "./ui/wy-icon";
import "./ui/wy-dropdown";

declare global {
  interface HTMLElementTagNameMap {
    "wy-file-menu": WyFileMenu;
  }
}

/**
 * Dropdown menu for file actions (download, open, rename, subscribe, trash etc).
 *
 * **Used sub components:**
 *
 * - [`<wy-dropdown>`](./ui/wy-dropdown.ts)
 * - [`<wy-dropdown-item>`](./ui/wy-dropdown.ts)
 * - [`<wy-dropdown-divider>`](./ui/wy-dropdown.ts)
 * - [`<wy-icon>`](./ui/wy-icon.ts)
 *
 * @slot - Additional file menu items
 *
 * @fires {FileEditNameEventType} edit-name - Emitted when rename mode should be activated.
 * @fires {FileSubscribeEventType} subscribe - Emitted when subscribe/unsubscribe is requested.
 * @fires {FileTrashEventType} trash - Emitted when a file should be moved to trash.
 * @fires {FileRestoreEventType} restore - Emitted when a trashed file should be restored.
 * @fires {FileDeleteForeverEventType} delete-forever - Emitted when a file should be permanently deleted.
 */
@customElement("wy-file-menu")
@localized()
export class WyFileMenu extends LitElement {
  /** @internal */
  protected exportParts = new ShadowPartsController(this);

  /**
   * @internal
   * Consumed feature policy controlling which actions are available.
   */
  @consume({ context: FeaturePolicyContext, subscribe: true })
  @state()
  protected componentFeatures?: ComponentFeaturePolicy | undefined;

  /**
   * File to operate on when rendering menu actions.
   */
  @property({ type: Object })
  file!: FileType;

  /**
   * Render the dropdown using compact button styling.
   */
  @property({ type: Boolean })
  small: boolean = false;

  /**
   * Tracks which action events have listeners attached.
   */
  @property({ type: Object })
  hasEventListener: { [key: string]: boolean } = {
    "edit-name": false,
    subscribe: false,
    trash: false,
    restore: false,
    "delete-forever": false,
  };

  override addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void {
    // Check if any event is listened to

    if (this.hasEventListener) {
      const propertyName = type as keyof typeof this.hasEventListener;
      if (Object.prototype.hasOwnProperty.call(this.hasEventListener, propertyName)) {
        //console.log(`Setting ${propertyName} to true`)
        Object.assign(this.hasEventListener, {
          [propertyName]: true,
        });
      }
    }
    super.addEventListener(type, listener, options);
  }

  /**
   * Open download URL for the current file.
   * @internal
   */
  private triggerDownload() {
    this.file && openUrl(this.file.download_url, "_top", this.file.name, true);
  }

  /**
   * Open external provider URL for the current file.
   * @internal
   */
  private triggerExternal() {
    this.file && openUrl(this.file.external_url, "_blank", this.file.name);
  }

  /**
   * Open application-specific URL for the current file.
   * @internal
   */
  private triggerApplication() {
    this.file && openUrl(this.file.application_url, "_top", this.file.name);
  }

  /**
   * Emit an `edit-name` event for the current file.
   * @internal
   */
  private dispatchEditName() {
    const event: FileEditNameEventType = new (CustomEvent as NamedEvent)("edit-name", {
      detail: { file: this.file },
    });
    return this.dispatchEvent(event);
  }

  /**
   * Emit a `subscribe` event toggling subscription state.
   *
   * @internal
   * @param subscribe - Desired subscription setting.
   */
  private dispatchSubscribe(subscribe: boolean) {
    const event: FileSubscribeEventType = new (CustomEvent as NamedEvent)("subscribe", {
      detail: {
        file: this.file,
        subscribe,
      },
    });
    return this.dispatchEvent(event);
  }

  /**
   * Emit a `trash` event for the current file.
   * @internal
   */
  private dispatchTrash() {
    const event: FileTrashEventType = new (CustomEvent as NamedEvent)("trash", {
      detail: { file: this.file },
    });
    return this.dispatchEvent(event);
  }

  /**
   * Emit a `restore` event for the current file.
   * @internal
   */
  private dispatchRestore() {
    const event: FileRestoreEventType = new (CustomEvent as NamedEvent)("restore", {
      detail: { file: this.file },
    });
    return this.dispatchEvent(event);
  }

  /**
   * Emit a `delete-forever` event for the current file.
   * @internal
   */
  private dispatchDeleteForever() {
    const event: FileDeleteForeverEventType = new (CustomEvent as NamedEvent)("delete-forever", {
      detail: { file: this.file },
    });
    return this.dispatchEvent(event);
  }

  override render() {
    if (!this.file) {
      return nothing;
    }

    const { icon } = getIcon(this.file.name);

    const isNotTemp = this.file.id >= 1;

    const fileProvider = this.file.provider;
    const fileAppProvider = this.file.provider || "app";

    return html`
      <wy-dropdown directionX="left" ?small=${this.small}>
        ${isNotTemp && this.file.is_trashed
          ? html`
              ${this.hasEventListener["restore"]
                ? html`
                    <wy-dropdown-item @click=${() => this.dispatchRestore()}>
                      <wy-icon name="delete-restore"></wy-icon>
                      ${msg("Restore")}
                    </wy-dropdown-item>
                  `
                : nothing}
              ${this.hasEventListener["restore"] && this.hasEventListener["delete-forever"]
                ? html` <wy-dropdown-divider></wy-dropdown-divider> `
                : nothing}
              ${this.hasEventListener["delete-forever"]
                ? html`
                    <wy-dropdown-item @click=${() => this.dispatchDeleteForever()}>
                      <wy-icon name="delete-forever"></wy-icon>
                      ${msg("Delete")}
                    </wy-dropdown-item>
                  `
                : nothing}
            `
          : nothing}
        ${!this.file.is_trashed
          ? html`
              ${this.file.external_url
                ? html`
                    <wy-dropdown-item @click=${() => this.triggerExternal()}>
                      <wy-icon name=${icon}></wy-icon>
                      ${msg(str`Open in ${fileProvider}`)}
                    </wy-dropdown-item>
                  `
                : html`
                    ${this.componentFeatures?.allowsFeature(Feature.WebDAV) && this.file.application_url
                      ? html`
                          <wy-dropdown-item @click=${() => this.triggerApplication()}>
                            <wy-icon
                              name=${this.file.provider ? toKebabCase<iconNamesType>(this.file.provider) : icon}
                            ></wy-icon>
                            ${msg(str`Open in ${fileAppProvider}`)}
                          </wy-dropdown-item>
                        `
                      : nothing}
                    <wy-dropdown-item @click=${() => this.triggerDownload()}>
                      <wy-icon name="download"></wy-icon>
                      ${msg("Download")}
                    </wy-dropdown-item>
                  `}
              ${isNotTemp
                ? html`
                    ${this.hasEventListener["edit-name"]
                      ? html`
                          <wy-dropdown-item @click=${() => this.dispatchEditName()}>
                            <wy-icon name="textbox"></wy-icon>
                            ${msg("Rename")}
                          </wy-dropdown-item>
                        `
                      : nothing}
                    ${this.hasEventListener["subscribe"]
                      ? this.file.is_subscribed
                        ? html`
                            <wy-dropdown-item @click=${() => this.dispatchSubscribe(false)}>
                              <wy-icon name="bell-off"></wy-icon>
                              ${msg("Unsubscribe")}
                            </wy-dropdown-item>
                          `
                        : html`
                            <wy-dropdown-item @click=${() => this.dispatchSubscribe(true)}>
                              <wy-icon name="bell"></wy-icon>
                              ${msg("Subscribe")}
                            </wy-dropdown-item>
                          `
                      : nothing}
                    ${this.hasEventListener["trash"]
                      ? html`
                          <wy-dropdown-divider></wy-dropdown-divider>
                          <wy-dropdown-item @click=${() => this.dispatchTrash()}>
                            <wy-icon name="delete"></wy-icon>
                            ${msg("Trash")}
                          </wy-dropdown-item>
                        `
                      : nothing}
                  `
                : nothing}
            `
          : nothing}
        <slot></slot>
      </wy-dropdown>
    `;
  }
}
