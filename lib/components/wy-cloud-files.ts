import { LitElement, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { localized, msg } from "@lit/localize";
import { ifDefined } from "lit/directives/if-defined.js";
import WeavyPostal from "../utils/postal-parent";
import type { ExternalBlobType } from "../types/files.types";
import { BlockConsumerMixin } from "../mixins/block-consumer-mixin";

import cloudFilesCss from "../scss/all";

import "./wy-overlay";
import "./wy-spinner";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import WyOverlay from "./wy-overlay";

@customElement("wy-cloud-files")
@localized()
export default class WyCloudFiles extends BlockConsumerMixin(LitElement) {
  static override styles = cloudFilesCss;

  protected exportParts = new ShadowPartsController(this);

  @state()
  src?: URL;

  @state()
  iframeVisible = false;

  @state()
  showOverlay = false;

  private isRegistered = false;

  private iframeElementRef: Ref<HTMLIFrameElement> = createRef();
  private overlayRef: Ref<WyOverlay> = createRef();

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
    } catch {
      /* No worries */
    }

    if (!origin) {
      try {
        origin = window.self.document.location.origin;
      } catch {
        console.error("Filebrowser: Could not read current origin.");
      }
    }

    return origin;
  }

  private handleFiles?: (message: { blobs: ExternalBlobType[] }, e: MessageEvent) => void;
  private handleClose?: (message: unknown, e: MessageEvent) => void;
  private handleGoogleSelected?: (message: unknown, e: MessageEvent) => void;

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
    if (!this.weavyContext) {
      return nothing;
    }

    return html`
      <wy-overlay
        .show=${this.showOverlay}
        ${ref(this.overlayRef)}
        @close=${() => this.close()}
        @release-focus=${() => this.dispatchEvent(new CustomEvent("release-focus", { bubbles: true, composed: true }))}
      >
        ${this.showOverlay
          ? html`
              <wy-spinner overlay ?hidden=${this.iframeVisible}></wy-spinner>
              <iframe
                ${ref(this.iframeElementRef)}
                @load=${() => (this.iframeVisible = true)}
                src=${ifDefined(this.src?.toString())}
                style="flex: 1 1 100%; border: 0;"
                id="weavy-filebrowser"
                name="weavy-filebrowser"
                title=${msg("Cloud File Browser")}
              ></iframe>
            `
          : nothing}
      </wy-overlay>
    `;
  }
}
