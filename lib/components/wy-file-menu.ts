import { LitElement, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { msg, localized, str } from "@lit/localize";

import { getIcon } from "../utils/files";
import { type FileType } from "../types/files.types";
import { Feature, type FeaturesConfigType, type FeaturesListType } from "../types/features.types";
import { hasFeature } from "../utils/features";
import { openUrl } from "../utils/urls";
import { toKebabCase } from "../utils/strings";
import { falsyBoolean } from "../converters/falsy-boolean";

import "./wy-icon";
import "./wy-dropdown";

@customElement("wy-file-menu")
@localized()
export default class WyFileMenu extends LitElement {
  

  @property({ type: Object })
  file?: FileType;

  @property({ type: Array })
  availableFeatures?: FeaturesListType = [];

  @property({ type: Object })
  features?: FeaturesConfigType = {};

  @property({ converter: falsyBoolean })
  noWrapper: boolean = false;

  @property({ type: Object })
  hasEventListener: { [key: string]: boolean } = {
    "edit-name": false,
    subscribe: false,
    trash: false,
    restore: false,
    "delete-forever": false,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  override addEventListener(type: any, listener: any, options?: any): void {
    // Check if any event is listened to

    const propertyName = type as keyof typeof this.hasEventListener;
    if (Object.prototype.hasOwnProperty.call(this.hasEventListener, propertyName)) {
      //console.log(`Setting ${propertyName} to true`)
      Object.assign(this.hasEventListener, {
        [propertyName]: true,
      });
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
    // TODO: Change to webdav-url
    this.file && openUrl(this.file.application_url, "_top", this.file.name);
  }

  private dispatchEditName() {
    const event = new CustomEvent("edit-name", {
      detail: { file: this.file },
    });
    return this.dispatchEvent(event);
  }

  private dispatchSubscribe(subscribe: boolean) {
    const event = new CustomEvent("subscribe", {
      detail: {
        file: this.file,
        subscribe,
      },
    });
    return this.dispatchEvent(event);
  }

  private dispatchTrash() {
    const event = new CustomEvent("trash", {
      detail: { file: this.file },
    });
    return this.dispatchEvent(event);
  }

  private dispatchRestore() {
    const event = new CustomEvent("restore", {
      detail: { file: this.file },
    });
    return this.dispatchEvent(event);
  }

  private dispatchDeleteForever() {
    const event = new CustomEvent("delete-forever", {
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
      <wy-dropdown directionX="left" ?noWrapper=${this.noWrapper}>
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
                    ${this.file.application_url && hasFeature(this.availableFeatures, Feature.WebDAV, this.features?.webDAV)
                      ? html`
                          <wy-dropdown-item @click=${() => this.triggerApplication()}>
                            <wy-icon name=${this.file.provider ? toKebabCase(this.file.provider) : icon}></wy-icon>
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
