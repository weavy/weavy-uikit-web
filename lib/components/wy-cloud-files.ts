import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { localized, msg } from "@lit/localize";

import { type WeavyContext, weavyContextDefinition } from "../client/context-definition";
import WeavyPostal from "../utils/postal-parent";

import cloudFilesCss from "../scss/all.scss";
import { portal } from "lit-modal-portal";

import "./wy-overlay";
import "./wy-spinner";
import { ExternalBlobType } from "../types/files.types";
import type WeavyOverlay from "./wy-overlay";
import { ifDefined } from "lit/directives/if-defined.js";

@customElement("wy-cloud-files")
@localized()
export default class WyCloudFiles extends LitElement {
  static override styles = cloudFilesCss;

  @consume({ context: weavyContextDefinition, subscribe: true })
  @state()
  private weavyContext?: WeavyContext;

  @state()
  src?: URL;

  @state()
  iframeVisible = false;

  @state()
  showOverlay = false;

  private isRegistered = false;

  private iframeElementRef: Ref<HTMLIFrameElement> = createRef();
  private overlayRef: Ref<WeavyOverlay> = createRef();

  open() {
    this.showOverlay = true;
  }

  close() {
    this.showOverlay = false;
    this.iframeVisible = false;
  }

  get origin() {
    let origin = "";

    // Get top origin
    try {
      if (window.location.ancestorOrigins && 0 < window.location.ancestorOrigins.length) {
        // Not available in FF, but Google APIs use this
        origin = window.location.ancestorOrigins[window.location.ancestorOrigins.length - 1];
      } else if (window.top) {
        // This may fail due to cors
        origin = window.top.document.location.origin;
      }
    } catch (e) {
      /* No worries */
    }

    if (!origin) {
      try {
        origin = window.self.document.location.origin;
      } catch (e) {
        console.error("Filebrowser: Could not read current origin.");
      }
    }

    return origin;
  }

  private handleFiles?: Function;
  private handleClose?: Function;
  private handleGoogleSelected?: Function;

  private dispatchExternalBlobs(externalBlobs: ExternalBlobType[] | null) {
    const externalBlobsEvent = new CustomEvent("external-blobs", { detail: { externalBlobs } });
    return this.dispatchEvent(externalBlobsEvent);
  }

  override connectedCallback(): void {
    super.connectedCallback();

    this.handleFiles = (message: { blobs: ExternalBlobType[] }, e: MessageEvent) => {
      if (e.source === this.iframeElementRef.value?.contentWindow?.self) {
        this.dispatchExternalBlobs(message.blobs);
        this.close();
      }
    };

    this.handleClose = (_message: unknown, e: MessageEvent) => {
      if (e.source === this.iframeElementRef.value?.contentWindow?.self) {
        this.close();
      }
    };

    this.handleGoogleSelected = (_message: unknown, e: MessageEvent) => {
      if (e.source === this.iframeElementRef.value?.contentWindow?.self) {
        //console.log("google-selected");
        this.overlayRef.value!.maximized = true;
      }
    };

    WeavyPostal.on("add-external-blobs", this.handleFiles);
    WeavyPostal.on("request:file-browser-close", this.handleClose);
    WeavyPostal.on("google-selected", this.handleGoogleSelected);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();

    WeavyPostal.off("add-external-blobs", this.handleFiles);
    WeavyPostal.off("request:file-browser-close", this.handleClose);
    WeavyPostal.off("google-selected", this.handleGoogleSelected);
  }

  override updated() {
    if (!this.weavyContext) {
      return;
    }

    if (this.showOverlay && !this.src) {
      this.src = new URL(
        "?origin=" + this.origin + "&v=X&t=" + Date.now().toString() + "&weavyId=wy-filebrowser",
        this.weavyContext.cloudFilePickerUrl
      );
    }

    if (!this.isRegistered && this.showOverlay && this.src) {
      if (this.iframeElementRef.value?.contentWindow) {
        WeavyPostal.registerContentWindow(
          this.iframeElementRef.value?.contentWindow.self,
          "weavy-filebrowser",
          "wy-filebrowser",
          this.src.origin
        );
        this.isRegistered = true;
      }
    } else if (this.isRegistered && !this.showOverlay && this.src) {
      WeavyPostal.unregisterContentWindow("weavy-filebrowser", "wy-filebrowser");
      this.isRegistered = false;
      this.src = undefined;
    }
  }

  override render() {
    return portal(
      this.showOverlay,
      html`
        <wy-overlay
          ${ref(this.overlayRef)}
          @release-focus=${() =>
            this.dispatchEvent(new CustomEvent("release-focus", { bubbles: true, composed: true }))}>
          <wy-spinner overlay ?hidden=${this.iframeVisible}></wy-spinner>
          <iframe
            ${ref(this.iframeElementRef)}
            @load=${() => (this.iframeVisible = true)}
            src=${ifDefined(this.src?.toString())}
            style="flex: 1 1 100%; border: 0;"
            id="weavy-filebrowser"
            name="weavy-filebrowser"
            title=${msg("Cloud File Browser")}></iframe>
        </wy-overlay>
      `,
      () => (this.showOverlay = false)
    );
  }
}
