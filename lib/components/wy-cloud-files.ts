import { css, html, nothing } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { state } from "lit/decorators.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { localized, msg } from "@lit/localize";
import { ifDefined } from "lit/directives/if-defined.js";
import { WeavyPostalParent } from "../utils/postal-parent";
import type { ExternalBlobType } from "../types/files.types";
import { WeavySubComponent } from "../classes/weavy-sub-component";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { ExternalBlobsEventType } from "../types/files.events";
import { NamedEvent } from "../types/generic.types";

import hostContentsCss from "../scss/host-contents.scss";

import { WyOverlay } from "./ui/wy-overlay";
import "./ui/wy-progress-circular";

declare global {
  interface HTMLElementTagNameMap {
    "wy-cloud-files": WyCloudFiles;
  }
}

/**
 * File picker for cloud services. Depends on Weavy filebrowser server to function.
 *
 * **Used sub components**
 *
 * - [`<wy-overlay>`](./ui/wy-overlay.ts)
 * - [`<wy-progress-circular>`](./ui/wy-progress-circular.ts)
 * 
 * @csspart wy-cloud-files-overlay - The overlay modal.
 * @csspart wy-cloud-files-progress - Progress shown when the iframe is loading.
 * @csspart wy-cloud-files-frame - The iframe for the Weavy filebrowser.
 * 
 * @fires {ExternalBlobsEventType} external-blobs
 */
@customElement("wy-cloud-files")
@localized()
export class WyCloudFiles extends WeavySubComponent {
  static override styles = [
    hostContentsCss,
    css`
      [part~="wy-cloud-picker-frame"] {
        flex: 1 1 100%;
        border: 0;
      }
    `,
  ];

  protected exportParts = new ShadowPartsController(this);

  /**
   * URL to the Weavy filebrowser iframe source.
   *
   * @internal
   */
  @state()
  protected src?: URL;

  /**
   * Whether the iframe is visible. It's initially hidden until the filebrowser src has loaded.
   *
   * @internal
   */
  @state()
  protected iframeVisible = false;

  /**
   * Whether the picker overlay is shown.
   *
   * @internal
   */
  @state()
  protected showOverlay = false;

  /**
   * Post-message service used to communicate with the filebrowser iframe.
   *
   * @internal
   */
  private weavyPostal?: WeavyPostalParent;

  /** Whether the content window is registered for post-message communication.
   *
   * @internal
   */
  private isRegistered = false;

  /**
   * Reference to the iframe element.
   *
   * @internal
   */
  private iframeElementRef: Ref<HTMLIFrameElement> = createRef();

  /**
   * Reference to the overlay modal element.
   *
   * @internal
   */
  private overlayRef: Ref<WyOverlay> = createRef();

  /**
   * Open the file picker overlay.
   */
  open() {
    this.showOverlay = true;
  }

  /**
   * Close the file picker overlay.
   */
  close() {
    this.showOverlay = false;
    this.iframeVisible = false;
  }

  /**
   * Returns the topmost available window/frame origin used when building the iframe src.
   *
   * @internal
   */
  protected get origin() {
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

  /**
   * Handler invoked when the iframe posts selected files.
   *
   * @internal
   */
  private handleFiles?: (message: { blobs: ExternalBlobType[] }, e: MessageEvent) => void;

  /**
   * Handler invoked when the iframe requests the file browser to close.
   *
   * @internal
   */
  private handleClose?: (message: unknown, e: MessageEvent) => void;

  /**
   * Handler invoked when a Google selection event is posted from the iframe.
   *
   * @internal
   */
  private handleGoogleSelected?: (message: unknown, e: MessageEvent) => void;

  /**
   * Trigger `external-blobs` event with any selected blobs.
   *
   * @internal
   * @param {ExternalBlobType[] | null} externalBlobs - The externally selected blobs.
   * @returns {boolean} Whether the event was successful.
   */
  private dispatchExternalBlobs(externalBlobs: ExternalBlobType[] | null) {
    const externalBlobsEvent: ExternalBlobsEventType = new (CustomEvent as NamedEvent)("external-blobs", {
      detail: { externalBlobs },
    });
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
      if (e.source === this.iframeElementRef.value?.contentWindow?.self && this.overlayRef.value) {
        //console.log("google-selected");
        this.overlayRef.value.maximized = true;
      }
    };

    if (!this.weavyPostal) {
      this.weavyPostal = new WeavyPostalParent();
    }

    this.weavyPostal.on("add-external-blobs", this.handleFiles);
    this.weavyPostal.on("request:file-browser-close", this.handleClose);
    this.weavyPostal.on("google-selected", this.handleGoogleSelected);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();

    this.weavyPostal?.off("add-external-blobs", this.handleFiles);
    this.weavyPostal?.off("request:file-browser-close", this.handleClose);
    this.weavyPostal?.off("google-selected", this.handleGoogleSelected);
  }

  override updated() {
    if (!this.weavy) {
      return;
    }

    if (this.showOverlay && !this.src) {
      this.src = new URL(
        "?origin=" + this.origin + "&v=X&t=" + Date.now().toString() + "&weavyId=wy-filebrowser",
        this.weavy.cloudFilePickerUrl
      );
    }

    if (this.weavyPostal && !this.isRegistered && this.showOverlay && this.src) {
      if (this.iframeElementRef.value?.contentWindow) {
        this.weavyPostal.registerContentWindow(
          this.iframeElementRef.value?.contentWindow.self,
          "weavy-filebrowser",
          "wy-filebrowser",
          this.src.origin
        );
        this.isRegistered = true;
      }
    } else if (this.weavyPostal && this.isRegistered && !this.showOverlay && this.src) {
      this.weavyPostal.unregisterContentWindow("weavy-filebrowser", "wy-filebrowser");
      this.isRegistered = false;
      this.src = undefined;
    }
  }

  override render() {
    if (!this.weavy) {
      return nothing;
    }

    return html`
      <wy-overlay
        ?noHeader=${this.iframeVisible}
        part="wy-cloud-files-overlay"
        .show=${this.showOverlay}
        ${ref(this.overlayRef)}
        @close=${() => this.close()}
      >
        ${this.showOverlay
          ? html`
              <wy-progress-circular
                part="wy-cloud-files-progress"
                indeterminate
                overlay
                ?hidden=${this.iframeVisible}
              ></wy-progress-circular>
              <iframe
                part="wy-cloud-picker-frame"
                ${ref(this.iframeElementRef)}
                @load=${() => (this.iframeVisible = true)}
                src=${ifDefined(this.src?.toString())}
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
