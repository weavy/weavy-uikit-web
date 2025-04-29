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

import "./base/wy-icon";
import "./base/wy-dropdown";

/**
 * @fires {FileEditNameEventType} edit-name
 * @fires {FileSubscribeEventType} subscribe
 * @fires {FileTrashEventType} trash
 * @fires {FileRestoreEventType} restore
 * @fires {FileDeleteForeverEventType} delete-forever
 */
@customElement("wy-file-menu")
@localized()
export default class WyFileMenu extends LitElement {
  protected exportParts = new ShadowPartsController(this);

  @consume({ context: FeaturePolicyContext, subscribe: true })
  @state()
  protected componentFeatures?: ComponentFeaturePolicy | undefined;

  @property({ type: Object })
  file!: FileType;

  @property({ type: Boolean })
  noWrapper: boolean = false;

  @property({ type: Boolean })
  small: boolean = false;

  @property({ type: Object })
  hasEventListener: { [key: string]: boolean } = {
    "edit-name": false,
    subscribe: false,
    trash: false,
    restore: false,
    "delete-forever": false,
  };

  
  override addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void {
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

  private triggerDownload() {
    this.file && openUrl(this.file.download_url, "_top", this.file.name, true);
  }

  private triggerExternal() {
    this.file && openUrl(this.file.external_url, "_blank", this.file.name);
  }

  private triggerApplication() {
    this.file && openUrl(this.file.application_url, "_top", this.file.name);
  }

  private dispatchEditName() {
    const event: FileEditNameEventType = new (CustomEvent as NamedEvent)("edit-name", {
      detail: { file: this.file },
    });
    return this.dispatchEvent(event);
  }

  private dispatchSubscribe(subscribe: boolean) {
    const event: FileSubscribeEventType = new (CustomEvent as NamedEvent)("subscribe", {
      detail: {
        file: this.file,
        subscribe,
      },
    });
    return this.dispatchEvent(event);
  }

  private dispatchTrash() {
    const event: FileTrashEventType = new (CustomEvent as NamedEvent)("trash", {
      detail: { file: this.file },
    });
    return this.dispatchEvent(event);
  }

  private dispatchRestore() {
    const event: FileRestoreEventType = new (CustomEvent as NamedEvent)("restore", {
      detail: { file: this.file },
    });
    return this.dispatchEvent(event);
  }

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
      <wy-dropdown directionX="left" ?noWrapper=${this.noWrapper} ?small=${this.small}>
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
