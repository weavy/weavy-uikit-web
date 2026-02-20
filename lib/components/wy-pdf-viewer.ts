import { LitElement, html, type PropertyValueMap } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { localized, msg } from "@lit/localize";
import { type WeavyType, WeavyContext } from "../contexts/weavy-context";
import { inputBlurOnEscape, inputConsume } from "../utils/keyboard";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { environmentUrl } from "../utils/urls";
import type { FilePreviewLoadedEventType } from "../types/files.events";
import type { NamedEvent } from "../types/generic.types";

//import * as type pdfjsLibType from "pdfjs-dist";
import type { OnProgressParameters, PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";
import type { EventBus, GenericL10n, PDFHistory, PDFLinkService, PDFViewer } from "pdfjs-dist/web/pdf_viewer.mjs";
//import type * as pdfjsViewerType from "pdfjs-dist/web/pdf_viewer.mjs";

type pdfjsLibType = typeof import("pdfjs-dist");
type pdfjsViewerType = typeof import("pdfjs-dist/web/pdf_viewer.mjs");

import pdfCss from "../scss/components/preview-pdf.scss";
import toolbarCss from "../scss/components/toolbar.scss";
import inputCss from "../scss/components/input.scss";
import hostContentsCss from "../scss/host-contents.scss";

import "./ui/wy-button";
import "./ui/wy-icon";

declare global {
  interface HTMLElementTagNameMap {
    "wy-pdf-viewer": WyPdfViewer;
  }
}

/**
 * PDF Viewer component based on pdf.js examples.
 *
 * @see https://github.com/mozilla/pdf.js/blob/master/examples/mobile-viewer
 * @see https://github.com/mozilla/pdf.js/blob/master/examples/components/
 * 
 * **Used sub components:**
 *
 * - [`<wy-button>`](./ui/wy-button.ts)
 * - [`<wy-icon>`](./ui/wy-icon.ts)
 *
 * @csspart wy-toolbars-bottom - Bottom toolbar wrapper.
 * @csspart wy-toolbar - Toolbar container.
 * @csspart wy-toolbar-center - Centered toolbar area.
 * @csspart wy-toolbar-buttons - Button group inside toolbar.
 * @csspart wy-input - Inputs in toolbars (page number / zoom).
 * @csspart wy-toolbar-center-text - Centered text in toolbar.
 * @csspart wy-toolbar-text - Text elements in the toolbar.
 * @csspart wy-pdf-container - Viewer container for PDF pages.
 * 
 * @fires {FilePreviewLoadedEventType} file-preview-loaded - The file preview is considered loaded.
 */

@customElement("wy-pdf-viewer")
@localized()
export class WyPdfViewer extends LitElement {
  static override styles = [
    pdfCss,
    toolbarCss,
    inputCss,
    hostContentsCss,
  ];

  /** @internal */
  protected exportParts = new ShadowPartsController(this);

  /** @internal */
  @consume({ context: WeavyContext, subscribe: true })
  @state()
  weavy?: WeavyType;

  /**
   * Emit `file-preview-loaded` once the viewer has initialized.
   *
   * @returns {boolean} True if the event was not canceled.
   */
  protected dispatchLoaded() {
    const event: FilePreviewLoadedEventType = new (CustomEvent as NamedEvent)("file-preview-loaded");
    return this.dispatchEvent(event);
  }

  /**
   * Deferred resolver used while lazily loading pdf.js modules.
   *
   * @internal
   */
  whenPdfjsResolve?: (value: { pdfjsLib: pdfjsLibType; pdfjsViewer: pdfjsViewerType }) => void;

  /**
   * Promise that resolves when both pdf.js core and viewer modules are available.
   *
   * @internal
   */
  whenPdfjs: Promise<{ pdfjsLib: pdfjsLibType; pdfjsViewer: pdfjsViewerType }> = new Promise((r) => {this.whenPdfjsResolve = r});

  /**
   * Cached pdf.js core module.
   *
   * @internal
   */
  pdfjsLib?: pdfjsLibType;

  /**
   * Cached pdf.js viewer helpers.
   *
   * @internal
   */
  pdfjsViewer?: pdfjsViewerType;

  MAX_CANVAS_PIXELS = 0; // CSS-only zooming.
  TEXT_LAYER_MODE = 0; // DISABLE
  MAX_IMAGE_SIZE = -1; // DISABLE //1024 * 1024;

  // Some PDFs need external cmaps.
  CMAP_URL?: URL;
  CMAP_PACKED = true;

  DEFAULT_SCALE_DELTA = 1.1;
  MIN_SCALE = 0.25;
  MAX_SCALE = 10.0;
  DEFAULT_SCALE_VALUE = "auto";

  ///////////////////////

  //DEFAULT_SCALE_DELTA = 1.1;
  //MAX_SCALE = 3.0;
  //MIN_SCALE = 0.2;

  ENABLE_XFA = true;
  DEFAULT_WORKER_URL: string = "/pdfjs/pdf.worker.min.mjs";
  DEFAULT_CMAPS_URL: string = "/pdfjs/cmaps/";
  WORKER_URL?: URL;

  /**
   * Source URL for the PDF to display.
   */
  @property()
  src!: string;

  /**
   * Input reference controlling the current page number.
   *
   * @internal
   */
  pageNumberRef: Ref<HTMLInputElement> = createRef<HTMLInputElement>();

  /**
   * Span reference showing the total number of pages.
   *
   * @internal
   */
  totalPagesRef: Ref<HTMLSpanElement> = createRef<HTMLSpanElement>();

  /**
   * Input reference controlling zoom level.
   *
   * @internal
   */
  zoomLevelRef: Ref<HTMLInputElement> = createRef<HTMLInputElement>();

  /**
   * Container that hosts the PDF viewer.
   *
   * @internal
   */
  viewerContainerRef = createRef<HTMLDivElement>();

  /////

  //pdfLoadingTask: null,
  pdfDocument?: PDFDocumentProxy;

  /**
   * Localization helper provided by pdf.js.
   *
   * @internal
   */
  l10n?: GenericL10n;

  /**
   * Browser history helper for the PDF viewer.
   *
   * @internal
   */
  pdfHistory?: PDFHistory;

  /**
   * Active PDF viewer instance.
   *
   * @internal
   */
  @state()
  pdfViewer?: PDFViewer;

  /**
   * Event bus used by pdf.js sub-components.
   *
   * @internal
   */
  pdfEventBus?: EventBus;

  /**
   * Link service used to handle internal navigation.
   *
   * @internal
   */
  pdfLinkService?: PDFLinkService;
  /*pdfFindController: PDFFindController = new PDFFindController({
    eventBus: this.pdfEventBus,
    linkService: this.pdfLinkService,
  });*/

  protected pdfLoadingTask?: PDFDocumentLoadingTask;

  protected delayedResize?: number
  protected resizer: ResizeObserver = new ResizeObserver(() => { 
    if (this.pdfViewer) {
      if (this.delayedResize) {
        clearTimeout(this.delayedResize)
        this.delayedResize = undefined
      }
      this.delayedResize = window.setTimeout(() => {
        if (this.pdfViewer) {
          // Update/Set scale
          this.pdfViewer.currentScaleValue = this.pdfViewer._currentScaleValue as string;
        }  
      }, 100)
    }
  });

  ////////

  /**
   * Open the configured PDF source in the viewer.
   *
   * @internal
   */
  protected async open() {
    const { pdfjsLib } = await this.whenPdfjs;
    if (!this.pdfViewer || !this.pdfHistory || !this.l10n || !this.pdfLinkService) {
      return;
    }

    if (this.pdfLoadingTask) {
      // We need to destroy already opened document
      await this.close();
    }

    // Loading document.
    const loadingTask = pdfjsLib.getDocument({
      url: this.src,
      maxImageSize: this.MAX_IMAGE_SIZE,
      enableXfa: this.ENABLE_XFA,
      cMapUrl: this.CMAP_URL?.toString() || "",
      cMapPacked: this.CMAP_PACKED,
    });
    this.pdfLoadingTask = loadingTask;

    loadingTask.onProgress = (_progressData: OnProgressParameters) => {
      //self.progress(progressData.loaded / progressData.total);
    };

    try {
      const pdfDocument = await loadingTask.promise;

      // Document loaded, specifying document for the viewer.
      this.pdfDocument = pdfDocument;
      this.pdfViewer.setDocument(pdfDocument);
      this.pdfLinkService.setDocument(pdfDocument);
      this.pdfHistory.initialize({
        // @ts-expect-error Type 'string | null' is not assignable to type 'string'.
        fingerprint: pdfDocument.fingerprints[0],
      });

      //this.loadingBar.hide();
      //self.setTitleUsingMetadata(pdfDocument);
    } catch (reason) {
      let key = "pdfjs-loading-error";
      if (reason instanceof pdfjsLib.InvalidPDFException) {
        key = "pdfjs-invalid-file-error";
      } else if (reason instanceof pdfjsLib.MissingPDFException) {
        key = "pdfjs-missing-file-error";
      } else if (reason instanceof pdfjsLib.UnexpectedResponseException) {
        key = "pdfjs-unexpected-response-error";
      }
      await this.l10n.get(key, undefined, undefined).then((errorMsg: string) => {
        this.pdfViewError(pdfjsLib, errorMsg, { message: (reason as Error | undefined)?.message });
      });
      //this.loadingBar.hide();
    }

    this.dispatchLoaded();
  }

  /**
   * Close any currently loaded PDF and release resources.
   *
   * @internal
   */
  protected async close() {
    if (!this.pdfLoadingTask) {
      return Promise.resolve();
    }

    const destructionPromise = this.pdfLoadingTask.destroy();
    this.pdfLoadingTask = undefined;

    if (this.pdfDocument) {
      this.pdfDocument = undefined;

      /* @ts-expect-error null */
      this.pdfViewer?.setDocument(null);
      this.pdfLinkService?.setDocument(null, null);

      if (this.pdfHistory) {
        this.pdfHistory.reset();
      }
    }

    return await destructionPromise;
  }

  /**
   * Log a pdf.js related error with contextual metadata.
   *
   * @internal
   * @param pdfjsLib - pdf.js core library.
   * @param message - Human readable error.
   * @param moreInfo - Additional error metadata.
   */
  protected pdfViewError(pdfjsLib: pdfjsLibType, message: string, moreInfo: Partial<Error & { filename: string; lineNumber: number }>) {
    const moreInfoText = [`PDF.js v${pdfjsLib?.version || "?"} (build: ${pdfjsLib?.build || "?"})`];
    if (moreInfo) {
      moreInfoText.push(`Message: ${moreInfo.message}`);

      if (moreInfo.stack) {
        moreInfoText.push(`Stack: ${moreInfo.stack}`);
      } else {
        if (moreInfo.filename) {
          moreInfoText.push(`File: ${moreInfo.filename}`);
        }
        if (moreInfo.lineNumber) {
          moreInfoText.push(`Line: ${moreInfo.lineNumber}`);
        }
      }
    }

    console.error(`${message}\n\n${moreInfoText.join("\n")}`);
  }

  ///////

  /**
   * Navigate to the provided page number.
   *
   * @param pageNumber - One-based page index.
   */
  setPage(pageNumber: number) {
    //console.debug("setPage:", pageNumber)
    if (this.pdfViewer) {
      this.pdfViewer.currentPageNumber = pageNumber;
    }
  }

  /**
   * Increase zoom level by the configured delta.
   *
   * @param ticks - Number of zoom steps to apply.
   */
  zoomIn(ticks: number = 0) {
    if (this.pdfViewer) {
      let newScale = this.pdfViewer.currentScale;
      do {
        newScale = parseFloat((newScale * this.DEFAULT_SCALE_DELTA).toFixed(2));
        newScale = Math.ceil(newScale * 10) / 10;
        newScale = Math.min(this.MAX_SCALE, newScale);
      } while (--ticks && newScale < this.MAX_SCALE);
      this.pdfViewer.currentScaleValue = newScale.toFixed(2);
    }
  }

  /**
   * Decrease zoom level by the configured delta.
   *
   * @param ticks - Number of zoom steps to apply.
   */
  zoomOut(ticks: number = 0) {
    if (this.pdfViewer) {
      let newScale = this.pdfViewer.currentScale;
      do {
        newScale = parseFloat((newScale / this.DEFAULT_SCALE_DELTA).toFixed(2));
        newScale = Math.floor(newScale * 10) / 10;
        newScale = Math.max(this.MIN_SCALE, newScale);
      } while (--ticks && newScale > this.MIN_SCALE);
      this.pdfViewer.currentScaleValue = newScale.toFixed(2);
    }
  }

  /**
   * Apply an absolute zoom level or named scale preset.
   *
   * @param scale - Numeric zoom or preset name.
   */
  setScale(scale: number | string) {
    //console.debug("setScale:", scale)
    if (this.pdfViewer) {
      this.pdfViewer.currentScaleValue = typeof scale === "number" ? scale.toFixed(2) : scale;
    }
  }

  /**
   * Validate and update the current page based on the input value.
   */
  updatePage() {
    //console.debug("updatePage");
    if (this.pdfViewer && this.pageNumberRef.value) {
      const pageNumber = parseInt(this.pageNumberRef.value.value);

      if (isNaN(pageNumber)) {
        this.setPage(this.pdfViewer.currentPageNumber);
      } else if (pageNumber > this.pdfViewer.pagesCount) {
        this.setPage(this.pdfViewer.pagesCount);
      } else if (pageNumber <= 0) {
        this.setPage(1);
      } else {
        this.setPage(pageNumber);
      }
    }
  }

  /**
   * Select all text inside an input, aiding quick replacement.
   *
   * @param e - Input focus event.
   */
  select(e: Event) {
    //console.debug("select");
    const input = e.target as EventTarget as HTMLInputElement;
    if (input) {
      input.setSelectionRange(0, input.value.length);
    }
  }

  /**
   * Fit the PDF to the current viewport height.
   */
  fitToPage() {
    this.setScale("page-fit");
  }

  /**
   * Fit the PDF to the current viewport width.
   */
  fitToWidth() {
    this.setScale("page-width");
  }

  /**
   * Validate and persist zoom level from the input field.
   */
  updateZoom() {
    //console.debug("updateZoom");
    if (this.pdfViewer && this.zoomLevelRef.value) {
      const zoomValue = parseFloat(this.zoomLevelRef.value.value.replace("%", ""));
      if (isNaN(zoomValue)) {
        this.setScale(this.pdfViewer.currentScale + 0.0001);
      } else {
        this.setScale(zoomValue / 100);
      }
    }
  }

  // clearDocument() {
  //   try {
  //     this.loadingTask?.destroy();
  //     //console.debug("loadingTask cleanup", loadingTask)
  //   } catch (e) {
  //     /* No worries */
  //   }

  //   try {
  //     // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  //     // @ts-ignore due to incorrect param type def?
  //     this.pdfViewer?.setDocument(null);
  //   } catch (e) {
  //     /* No worries */
  //   }

  //   try {
  //     this.pdfLinkService.setDocument(null, null);
  //   } catch (e) {
  //     /* No worries */
  //   }
  // }

  override async willUpdate(changedProperties: PropertyValueMap<this>): Promise<void> {
    super.willUpdate(changedProperties);
    
    if (changedProperties.has("weavy") && this.weavy) {
      if (!this.pdfjsLib) {
        await this.weavy.whenUrl();
        
        this.pdfjsLib = await import("pdfjs-dist");
        // Assign to globalThis, otherwise it breaks
        (globalThis as typeof globalThis & { pdfjsLib: pdfjsLibType }).pdfjsLib = this.pdfjsLib;
        
        // Must await after globalThis.pdfjsLib, otherwise it breaks
        this.pdfjsViewer = await import("pdfjs-dist/web/pdf_viewer.mjs");
        
        this.whenPdfjsResolve?.({ 
          pdfjsLib: this.pdfjsLib, 
          pdfjsViewer: this.pdfjsViewer 
        })
      }
      if (this.pdfjsLib && !this.WORKER_URL) {
        try {
          this.WORKER_URL = environmentUrl(this.DEFAULT_WORKER_URL, import.meta.url);
          this.WORKER_URL.searchParams.append("v", this.weavy.version);
          // Setting worker path to worker bundle.
          this.pdfjsLib.GlobalWorkerOptions.workerSrc = this.WORKER_URL.toString();
        } catch {
          console.warn("Invalid PDF worker source, using fake worker instead.")
        }
      }

      if (!this.CMAP_URL) {
        try {
          this.CMAP_URL = environmentUrl(this.DEFAULT_CMAPS_URL, import.meta.url);
        } catch {
          console.warn("Invalid PDF CMAPS source, skipping CMAPS.")
        }
      }
    }
  }

  override update(changedProperties: PropertyValueMap<this>) {
    super.update(changedProperties);

    if (
      (changedProperties.has("weavy") || changedProperties.has("src") || changedProperties.has("pdfViewer")) &&
      this.weavy &&
      this.src &&
      this.pdfViewer
    ) {
      void this.open();
    }
  }

  override async updated() {
    if (this.weavy && this.viewerContainerRef.value && !this.pdfViewer) {
      const { pdfjsLib, pdfjsViewer } = await this.whenPdfjs;

      // Double check after awaiting loading to avoid double init
      if (this.viewerContainerRef.value && !this.pdfViewer) {
        // INIT PDF VIEWER
        //console.log("new pdf viewer", this.viewerContainerRef.value);
        
        this.pdfEventBus = new pdfjsViewer.EventBus();
  
        this.pdfLinkService = new pdfjsViewer.PDFLinkService({
          eventBus: this.pdfEventBus,
        });
  
        this.l10n = new pdfjsViewer.GenericL10n(this.weavy?.locale);
  
        this.pdfViewer = new pdfjsViewer.PDFViewer({
          container: this.viewerContainerRef.value,
          eventBus: this.pdfEventBus,
          linkService: this.pdfLinkService,
          //findController: this.pdfFindController,
          annotationEditorMode: pdfjsLib.AnnotationEditorType.DISABLE,
          l10n: this.l10n,
          maxCanvasPixels: this.MAX_CANVAS_PIXELS,
          textLayerMode: this.TEXT_LAYER_MODE,
        });
        //pdfViewer!.MAX_AUTO_SCALE = 1.0;
  
        this.pdfLinkService?.setViewer(this.pdfViewer);
  
        this.pdfHistory = new pdfjsViewer.PDFHistory({
          eventBus: this.pdfEventBus,
          linkService: this.pdfLinkService,
        });
        this.pdfLinkService?.setHistory(this.pdfHistory);
  
        this.pdfEventBus?.on("scalechanging", () => {
          //console.debug("scalechanging")
          if (this.zoomLevelRef.value && this.pdfViewer) {
            this.zoomLevelRef.value.value = Math.round(this.pdfViewer.currentScale * 100).toFixed(0) + "%";
          } else {
            console.warn("Could not set zoom level")
          }
        });
  
        this.pdfEventBus?.on("pagechanging", () => {
          //console.debug("pagechanging")
          if (this.pageNumberRef.value && this.pdfViewer) {
            this.pageNumberRef.value.value = this.pdfViewer.currentPageNumber.toFixed(0);
          } else {
            console.warn("Could not set page number");
          }
        });
  
        this.pdfEventBus?.on("pagesinit", () => {
          // We can use pdfViewer now, e.g. let's change default scale.
          if (this.isConnected && this.pdfViewer && this.pageNumberRef.value && this.totalPagesRef.value) {
            //console.log("PDF INIT", this.pdfViewer)
            this.pdfViewer.currentScaleValue = this.DEFAULT_SCALE_VALUE; //"auto";
            this.pageNumberRef.value.value = "1";
            this.totalPagesRef.value.innerText = this.pdfViewer.pagesCount.toFixed(0);
            this.resizer.observe(this.pdfViewer.container);        
          } else {
            console.warn("Could not init pdf page")
          }
        });
        //console.log("new pdf viewer", this.pdfViewer);
      }
    }
  }

  override render() {
    //console.log("wy-pdf-viewer render")
    return html`
      <div class="wy-content-pdf">
        <div part="wy-toolbars-bottom">
          <nav part="wy-toolbar wy-toolbar-center">
            <div part="wy-toolbar-buttons">
              <input
                type="text"
                part="wy-input wy-toolbar-center-text"
                class="wy-pdf-page-number"
                ${ref(this.pageNumberRef)}
                @keydown=${inputBlurOnEscape}
                @keyup=${inputConsume}
                @change=${() => this.updatePage()}
                @click=${(e: MouseEvent) => this.select(e)}
              />
              <span part="wy-toolbar-text">/</span>
              <span part="wy-toolbar-text" ${ref(this.totalPagesRef)}>1</span>
            </div>
            <div part="wy-toolbar-buttons">
              <wy-button kind="icon" class="btn-zoom-out" @click=${() => this.zoomOut()} title=${msg("Zoom out")}>
                <wy-icon name="minus"></wy-icon>
              </wy-button>
              <input
                type="text"
                part="wy-input"
                class="wy-pdf-zoom-level"
                ${ref(this.zoomLevelRef)}
                @keydown=${inputBlurOnEscape}
                @keyup=${inputConsume}
                @change=${() => this.updateZoom()}
                @click=${(e: MouseEvent) => this.select(e)}
                value="100%"
              />
              <wy-button kind="icon" class="btn-zoom-in" @click=${() => this.zoomIn()} title=${msg("Zoom in")}>
                <wy-icon name="plus"></wy-icon>
              </wy-button>
            </div>
            <div part="wy-toolbar-buttons">
              <wy-button kind="icon" class="btn-fit-page" @click=${() => this.fitToWidth()} title=${msg("Fit to width")}>
                <wy-icon name="fit-width"></wy-icon>
              </wy-button>
              <wy-button kind="icon" @click=${() => this.fitToPage()} title=${msg("Fit to screen")}>
                <wy-icon name="fit-screen"></wy-icon>
              </wy-button>
            </div>
          </nav>
        </div>
        <div ${ref(this.viewerContainerRef)} class="wy-pdf-container">
          <div class="pdfViewer"></div>
        </div>
      </div>
    `;
  }

  override connectedCallback(): void {
    super.connectedCallback()
    if (this.pdfViewer) {
      this.resizer.observe(this.pdfViewer.container);
    }
  }

  override disconnectedCallback() {
    this.resizer.unobserve(this);

    try {
      void this.close();
      this.pdfViewer?.cleanup();
    } catch {
      /* No worries */
    }

    this.pdfViewer = undefined;

    super.disconnectedCallback();
  }
}
