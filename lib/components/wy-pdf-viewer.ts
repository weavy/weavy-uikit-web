import { LitElement, css, html, type PropertyValueMap } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { localized, msg } from "@lit/localize";

import { type WeavyType, WeavyContext } from "../contexts/weavy-context";
import allCss from "../scss/all.scss";

//import * as type pdfjsLibType from "pdfjs-dist";
import type { OnProgressParameters, PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";
import type { EventBus, GenericL10n, PDFHistory, PDFLinkService, PDFViewer } from "pdfjs-dist/web/pdf_viewer.mjs";
//import type * as pdfjsViewerType from "pdfjs-dist/web/pdf_viewer.mjs";

import { inputBlurOnEscape, inputConsume } from "../utils/keyboard";
import { WeavyProps } from "../types/weavy.types";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import "./wy-button";
import "./wy-icon";

type pdfjsLibType = typeof import("pdfjs-dist");
type pdfjsViewerType = typeof import("pdfjs-dist/web/pdf_viewer.mjs");

/**
 * PDF Viewer component based on pdfjs examples
 *
 * @see https://github.com/mozilla/pdf.js/blob/master/examples/mobile-viewer
 * @see https://github.com/mozilla/pdf.js/blob/master/examples/components/
 */

@customElement("wy-pdf-viewer")
@localized()
export default class WyPdfViewer extends LitElement {
  static override styles = [
    allCss,
    css`
      :host {
        display: contents;
      }
    `,
  ];

  protected exportParts = new ShadowPartsController(this);

  @consume({ context: WeavyContext, subscribe: true })
  @state()
  protected weavy?: WeavyType;

  whenPdfjsResolve?: (value: { pdfjsLib: pdfjsLibType, pdfjsViewer: pdfjsViewerType }) => void
  whenPdfjs: Promise<{ pdfjsLib: pdfjsLibType, pdfjsViewer: pdfjsViewerType }> = new Promise((r) => {this.whenPdfjsResolve = r});

  pdfjsLib?: pdfjsLibType;
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
  DEFAULT_WORKER_URL: string = "/js/pdf.worker.min.mjs";
  WORKER_URL?: URL;

  @property()
  src!: string;

  pageNumberRef: Ref<HTMLInputElement> = createRef<HTMLInputElement>();
  totalPagesRef: Ref<HTMLSpanElement> = createRef<HTMLSpanElement>();
  zoomLevelRef: Ref<HTMLInputElement> = createRef<HTMLInputElement>();

  viewerContainerRef = createRef<HTMLDivElement>();

  /////

  //pdfLoadingTask: null,
  pdfDocument?: PDFDocumentProxy;
  l10n?: GenericL10n;

  pdfHistory?: PDFHistory;

  @state()
  pdfViewer?: PDFViewer;

  pdfEventBus?: EventBus;
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
          this.pdfViewer.currentScaleValue = this.pdfViewer._currentScaleValue;
        }  
      }, 100)
    }
  });

  ////////
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
      this.l10n.get(key, undefined, undefined).then((errorMsg: string) => {
        this.pdfViewError(pdfjsLib, errorMsg, { message: (reason as Error | undefined)?.message });
      });
      //this.loadingBar.hide();
    }
  }

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

  protected pdfViewError(pdfjsLib: pdfjsLibType ,message: string, moreInfo: Partial<Error & { filename: string; lineNumber: number }>) {
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

  setPage(pageNumber: number) {
    //console.debug("setPage:", pageNumber)
    if (this.pdfViewer) {
      this.pdfViewer.currentPageNumber = pageNumber;
    }
  }

  zoomIn(ticks: number) {
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

  zoomOut(ticks: number) {
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

  setScale(scale: number | string) {
    //console.debug("setScale:", scale)
    if (this.pdfViewer) {
      this.pdfViewer.currentScaleValue = typeof scale === "number" ? scale.toFixed(2) : scale;
    }
  }

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

  select(e: Event) {
    //console.debug("select");
    const input = e.target as EventTarget as HTMLInputElement;
    if (input) {
      input.setSelectionRange(0, input.value.length);
    }
  }

  fitToPage() {
    this.setScale("page-fit");
  }

  fitToWidth() {
    this.setScale("page-width");
  }

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

  override async willUpdate(changedProperties: PropertyValueMap<this & WeavyProps>) {
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
        this.WORKER_URL = new URL(this.DEFAULT_WORKER_URL, this.weavy.url);
        // Setting worker path to worker bundle.
        this.pdfjsLib.GlobalWorkerOptions.workerSrc = this.WORKER_URL.toString();
      }

      if (!this.CMAP_URL) {
        this.CMAP_URL = new URL("/cmaps/", this.weavy.url);
      }
    }
  }

  override update(changedProperties: PropertyValueMap<this & WeavyProps>) {
    super.update(changedProperties);

    if (
      (changedProperties.has("weavy") || changedProperties.has("src") || changedProperties.has("pdfViewer")) &&
      this.weavy &&
      this.src &&
      this.pdfViewer
    ) {
      this.open();
    }
  }

  override async updated() {
    if (this.weavy && this.viewerContainerRef.value && !this.pdfViewer) {
      const { pdfjsLib, pdfjsViewer } = await this.whenPdfjs;

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
        if (this.zoomLevelRef.value) {
          this.zoomLevelRef.value.value = Math.round(this.pdfViewer!.currentScale * 100).toFixed(0) + "%";
        }
      });

      this.pdfEventBus?.on("pagechanging", () => {
        //console.debug("pagechanging")
        this.pageNumberRef.value!.value = this.pdfViewer!.currentPageNumber.toFixed(0);
      });

      this.pdfEventBus?.on("pagesinit", () => {
        // We can use pdfViewer now, e.g. let's change default scale.
        if (this.isConnected && this.pdfViewer) {
          //console.log("PDF INIT", this.pdfViewer)
          this.pdfViewer.currentScaleValue = this.DEFAULT_SCALE_VALUE; //"auto";
          this.pageNumberRef.value!.value = "1";
          this.totalPagesRef.value!.innerText = this.pdfViewer!.pagesCount.toFixed(0);
          this.resizer.observe(this.pdfViewer.container);        }
      });
      //console.log("new pdf viewer", this.pdfViewer);
    }
  }

  override render() {
    //console.log("wy-pdf-viewer render")
    return html`
      <div class="wy-content-pdf">
        <div class="wy-toolbars-bottom">
          <nav class="wy-toolbar wy-toolbar-center">
            <div class="wy-toolbar-buttons">
              <input
                type="text"
                class="wy-input wy-pdf-page-number"
                ${ref(this.pageNumberRef)}
                @keydown=${inputBlurOnEscape}
                @keyup=${inputConsume}
                @change=${this.updatePage}
                @click=${this.select}
              />
              <span class="wy-toolbar-text">/</span>
              <span class="wy-toolbar-text" ${ref(this.totalPagesRef)}>1</span>
            </div>
            <div class="wy-toolbar-buttons">
              <wy-button kind="icon" class="btn-zoom-out" @click=${this.zoomOut} title=${msg("Zoom out")}>
                <wy-icon name="minus"></wy-icon>
              </wy-button>
              <input
                type="text"
                class="wy-input wy-pdf-zoom-level"
                ${ref(this.zoomLevelRef)}
                @keydown=${inputBlurOnEscape}
                @keyup=${inputConsume}
                @change=${this.updateZoom}
                @click=${this.select}
                value="100%"
              />
              <wy-button kind="icon" class="btn-zoom-in" @click=${this.zoomIn} title=${msg("Zoom in")}>
                <wy-icon name="plus"></wy-icon>
              </wy-button>
            </div>
            <div class="wy-toolbar-buttons">
              <wy-button kind="icon" class="btn-fit-page" @click=${this.fitToWidth} title=${msg("Fit to width")}>
                <wy-icon name="fit-width"></wy-icon>
              </wy-button>
              <wy-button kind="icon" @click=${this.fitToPage} title=${msg("Fit to screen")}>
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
      this.close();
      this.pdfViewer?.cleanup();
    } catch {
      /* No worries */
    }

    this.pdfViewer = undefined;

    super.disconnectedCallback();
  }
}
