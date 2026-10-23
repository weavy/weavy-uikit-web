import { LitElement, PropertyValues, html, nothing } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { ref } from "lit/directives/ref.js";
import { ifDefined } from "lit/directives/if-defined.js";
import { codecError, mediaError, mediaLoaded } from "../utils/media";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import type { NamedEvent } from "../types/generic.types";
import type { FilePreviewLoadedEventType } from "../types/files.events";
import type { FileType } from "../types/files.types";

import contentMediaCss from "../scss/components/content-media.scss";
import hostContentsCss from "../scss/host-contents.scss";

import "./ui/wy-progress-circular";
import "./wy-file-view-icon";

declare global {
  interface HTMLElementTagNameMap {
    "wy-file-view-media": WyFileViewMedia;
  }
}

/**
 * Media preview component for audio/video files.
 *
 * Renders a <video> or <audio> element with fallbacks and loading UI.
 *
 * **Used sub components:**
 *
 * - [`<wy-progress-circular>`](./ui/wy-progress-circular.ts)
 * - [`<wy-file-view-icon>`](./wy-file-view-icon.ts)
 *
 * @csspart wy-content-video - Video element container / element.
 * @csspart wy-content-audio - Audio element container / element.
 * @csspart wy-content-progress - Progress indicator shown while media loads.
 *
 * @fires {FilePreviewLoadedEventType} file-preview-loaded - The file preview is considered loaded.
 */
@customElement("wy-file-view-media")
export class WyFileViewMedia extends LitElement {
  static override styles = [contentMediaCss, hostContentsCss];

  /** @internal */
  protected exportParts = new ShadowPartsController(this);

  /**
   * Source file.
   */
  @property({ attribute: false })
  file?: FileType;

  /**
   * Toggles playback when the preview item is marked as current.
   */
  @property({ type: Boolean })
  play: boolean = false;

  /**
   * Currently registered media element reference.
   *
   * @internal
   */
  mediaElement?: HTMLMediaElement;

  /**
   * Dispatches the `file-preview-loaded` event after the media metadata becomes available.
   *
   * @internal
   * @returns {boolean} `true` if the event was not canceled.
   */
  protected dispatchLoaded() {
    const event: FilePreviewLoadedEventType = new (CustomEvent as NamedEvent)("file-preview-loaded");
    return this.dispatchEvent(event);
  }

  /**
   * Handles the `loadedmetadata` event by signaling that the preview is ready.
   *
   * @internal
   * @param e - Original metadata load event.
   */
  protected handleLoaded = (e: Event) => {
    mediaLoaded(e);
    this.dispatchLoaded();
  };

  /**
   * Registers load and error listeners on the provided media element.
   *
   * @internal
   * @param mediaElement - Media element to observe.
   */
  registerLoading(mediaElement: Element | undefined) {
    this.unregisterLoading();

    if (mediaElement) {
      this.mediaElement = mediaElement as HTMLMediaElement;

      mediaElement.part.add("wy-loading");

      mediaElement.addEventListener("error", mediaError, true); // needs capturing
      mediaElement.addEventListener("loadedmetadata", this.handleLoaded, true); // needs capturing
      mediaElement.addEventListener("loadedmetadata", codecError, true); // needs capturing
    }
  }

  /**
   * Cleans up listeners and state from the previously registered media element.
   *
   * @internal
   */
  unregisterLoading() {
    if (this.mediaElement) {
      // cleanup
      this.mediaElement.pause();
      this.mediaElement.removeAttribute("autoplay");
      this.mediaElement.setAttribute("preload", "none");

      this.mediaElement.removeEventListener("error", mediaError, true); // needs capturing
      this.mediaElement.removeEventListener("loadedmetadata", this.handleLoaded, true); // needs capturing
      this.mediaElement.removeEventListener("loadedmetadata", codecError, true); // needs capturing

      this.mediaElement = undefined;
    }
  }

  override render() {
    const file = this.file;

    if (!file) return nothing;

    const previewSrc = file.preview_url || file.download_url || "";

    return file.preview_format === "video"
      ? html`
          <video
            ${ref((ref) => this.registerLoading(ref))}
            part="wy-content-video"
            controls
            crossorigin="use-credentials"
          >
            <source src=${previewSrc} type=${ifDefined(file.media_type)} />
            <wy-file-view-icon .file=${file}></wy-file-view-icon>
          </video>
          <wy-progress-circular part="wy-content-progress" indeterminate overlay></wy-progress-circular>
        `
      : html`
          <audio
            ${ref((ref) => this.registerLoading(ref))}
            part="wy-content-audio"
            controls
            crossorigin="use-credentials"
          >
            <source src=${previewSrc} type=${ifDefined(file.media_type)} />
          </audio>
        `;
  }

  protected override updated(changedProperties: PropertyValues<this>): void {
    super.updated(changedProperties);

    if (changedProperties.has("play") && this.mediaElement) {
      if (this.play) {
        void this.mediaElement.play();
      } else {
        this.mediaElement.pause();
      }
    }
  }

  override disconnectedCallback() {
    this.unregisterLoading();
    super.disconnectedCallback();
  }
}
