import { LitElement, PropertyValues, html } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { ref } from "lit/directives/ref.js";
import { ifDefined } from "lit/directives/if-defined.js";
import { codecError, mediaError, mediaLoaded } from "../utils/media";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";

import "./base/wy-spinner";
import "./wy-preview-icon";

import allCss from "../scss/all.scss";
import hostContentsCss from "../scss/host-contents.scss";

@customElement("wy-preview-media")
export class WyPreviewMedia extends LitElement {
  static override styles = [
    allCss,
    hostContentsCss,
  ];

  protected exportParts = new ShadowPartsController(this);

  @property()
  format: string = "";

  @property()
  src!: string;

  @property({ type: Boolean })
  play: boolean = false;

  @property()
  name: string = "";

  @property()
  mediaType?: string;

  mediaElement?: HTMLMediaElement;

  registerLoading(mediaElement: Element | undefined) {
    this.unregisterLoading();

    if (mediaElement) {
      this.mediaElement = mediaElement as HTMLMediaElement;

      mediaElement.classList.add("wy-loading");

      mediaElement.addEventListener("error", mediaError, true); // needs capturing
      mediaElement.addEventListener("loadedmetadata", mediaLoaded, true); // needs capturing
      mediaElement.addEventListener("loadedmetadata", codecError, true); // needs capturing
    }
  }

  unregisterLoading() {
    if (this.mediaElement) {
      // cleanup
      this.mediaElement.pause();
      this.mediaElement.removeAttribute("autoplay");
      this.mediaElement.setAttribute("preload", "none");

      this.mediaElement.removeEventListener("error", mediaError, true); // needs capturing
      this.mediaElement.removeEventListener("loadedmetadata", mediaLoaded, true); // needs capturing
      this.mediaElement.removeEventListener("loadedmetadata", codecError, true); // needs capturing

      this.mediaElement = undefined;
    }
  }

  override render() {
    return this.format === "video"
      ? html`
          <video ${ref((ref) => this.registerLoading(ref))} class="wy-content-video" controls crossorigin="use-credentials">
            <source src=${this.src} type=${ifDefined(this.mediaType)} />
            <wy-preview-icon src=${this.src} icon="file-video"></wy-preview-icon>
          </video>
          <wy-spinner></wy-spinner>
        `
      : html`
          <audio ${ref((ref) => this.registerLoading(ref))} class="wy-content-audio" controls crossorigin="use-credentials">
            <source src=${this.src} type=${ifDefined(this.mediaType)} />
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
