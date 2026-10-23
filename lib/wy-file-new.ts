import { html } from "lit";
import { customElement } from "./utils/decorators/custom-element";
import { AppTypeGuid } from "./types/app.types";
import type { DropFilesEventType } from "./types/files.events";
import { DropZoneController } from "./controllers/dropzone-controller";
import { localized, msg } from "@lit/localize";
//import { HistoryController } from './controllers/history-controller'
import { ThemeController } from "./controllers/theme-controller";
import { WeavyAppComponent } from "./classes/weavy-app-component";
import { ComponentFeatures, Feature } from "./contexts/features-context";
import { partMap } from "./utils/directives/shadow-part-map";
import { CreateFilesController } from "./controllers/create-files-controller";
import { createRef, ref } from "lit/directives/ref.js";

import dropZoneCss from "./scss/components/dropzone.scss";
import hostPaddedCss from "./scss/host-padded.scss";
import hostFontCss from "./scss/host-font.scss";
import hostFlexCss from "./scss/host-flex.scss";
import colorModesCss from "./scss/color-modes.scss";

import "./components/wy-file-create";
import { WyFileCreate } from "./components/wy-file-create";

declare global {
  interface HTMLElementTagNameMap {
    "wy-file-new": WyFileNew;
  }
}

/**
 * @import { WyAppEventType } from "./types/app.events"
 * @import { WyActionEventType } from "./types/action.events"
 */

/**
 * Weavy file component to create files, upload files or attach cloud files to a files app.
 *
 * Supports upload of multiple large files at once, upload using drag'n'drop and pasting files to upload. The file upload progress can be monitored and aborted.
 *
 * Prompts for a filename when creating files, optionally suggesting an extension. Also supports uploading files and adding files from cloud providers such as Google Drive, Dropbox, Box and Microsoft OneDrive.
 *
 * Each file component requires an app identifier (`uid`), which automatically creates a [corresponding app](https://docs.weavy.com/concepts#app) on your Weavy environment when the component is first initialized. The app identifier must correspond to the app of where you want to save the files. It's also recommended to specify a readable `name` of the files app, to get better readable notifications from the app.
 *
 * > It's often useful to base the `uid` on something that identifies the location where the component is rendered.
 * > Typically you would use something like a product id, page id or path.
 *
 * **Component Layout**
 *
 * The component is displayed as a dropdown menu shown as a button. After the dropdown is a status icon button; shown when creating, uploading, attaching or modifying files in the app. The default height of the buttons is the icon size `1.5rem`/`24px` together with the set `--wy-padding` (which defaults to `0.5rem`/`8px`), which makes a total of `2.5rem`/`40px` per default. The width varies with the length of the text and whether the status is displayed or not.
 *
 * The cloud file picker appears as a modal overlay centered in the `top layer`.
 *
 * The file name selector when creating files appears as a modal input dialog centered in the `top layer`.
 *
 * The status detail dialog renders in a sheet overlay centered in the `top layer`.
 *
 * All the overlays does not occupy any visual layout space where they are placed in the DOM, they only render in the [top layer](https://developer.mozilla.org/en-US/docs/Glossary/Top_layer).
 *
 * You can add additional styling using _CSS Custom Properties_ and _CSS Shadow Parts_ and further customization using _slots_.
 *
 * **Used sub components:**
 *
 * - [`<wy-file-create>`](./components/wy-file-create.ts)
 *
 * @tagname wy-file-new
 * @csspart wy-file-new - Main container.
 * @csspart wy-dragging - Modifier for the main layout when dragging over.
 * @slot actions - Buttons placed in the toolbar.
 * @fires {WyAppEventType} wy-app - Fired whenever the app property changes.
 * @fires {WyActionEventType} wy-action - Emitted when an action is performed on an embed.
 *
 * @example <caption>Standard create new file button</caption>
 * 
 * Displays a file create button for the `test-files` files app with integrated file-creation, uploading and cloud file picker.
 *
 * Specifying the app identifier (`uid`) is required, and automatically creates a [corresponding app](https://www.weavy.com/docs/concepts#app) on your Weavy environment when the component is first initialized.
 * It's recommended to specify a readable `name` of the files app, to get better readable notifications from the app.
 *
 * ```html
 * <wy-file-new uid="test-files" name="Test files"></wy-file-new>
 * ```
 * 
 * @example <caption>Standard create new file button without cloud files</caption>
 * 
 * Displays a create new file button without the possibility to add files from cloud providers.
 * 
 * ```html
 * <wy-file-new uid="test-files" features="-cloud_files"></wy-file-new>
 * ```
 * 
 * @example <caption>Connect create new file button to `<wy-file>` view</caption>
 * 
 * Displays a create new file button that displays the added file in a [file view component](https://docs.weavy.com/reference/uikit/file).
 * 
 * ```html
 * <wy-file-new id="file-picker" uid="test-files"></wy-file-new>
 * <wy-file id="file-view" uid="test-files"></wy-file>
 * <script>
 *   const filePicker = document.getElementById("file-picker");
 *   const fileView = document.getElementById("file-view");
 * 
 *   filePicker.addEventListener("wy-action", (e) => {
 *     if (e.detail.file) {
 *       // Open the file in the file view;
 *       fileView.fileId = e.detail.file.id;
 * 
 *       // Optionally set edit mode
 *       fileView.edit = e.detail.action === "edit";
 *     }
 *   })
 * ```
 * 
 * @example <caption>Connect create new file button to `<wy-files>` list</caption>
 * 
 * Displays a create new file button that selects the added file in a [file list component](xref:uikit-files).
 * 
 * ```html
 * <wy-file-new id="file-picker" uid="test-files"></wy-file-new>
 * <wy-files id="files-list" uid="test-files"></wy-files>
 * <script>
 *   const filePicker = document.getElementById("file-picker");
 *   const filesList = document.getElementById("files-list");
 * 
 *   filePicker.addEventListener("wy-action", (e) => {
 *     if (e.detail.file) {
 *       // Select the file in the file list;
 *       filesList.selectedId = e.detail.file.id;
 * 
 *       // Ensure the file is visible in the list and scrolled to
 *       filesList.highlightId = e.detail.file.id;
 * 
 *       // Optionally open the file in preview
 *       filesList.preview(e.detail.file.id, { edit: e.detail.action === "edit" })
 *     }
 *   })
 * ```
 */
@customElement("wy-file-new")
@localized()
export class WyFileNew extends WeavyAppComponent {
  static override styles = [dropZoneCss, colorModesCss, hostFlexCss, hostPaddedCss, hostFontCss];

  /** @internal */
  override appType = AppTypeGuid.Files;

  /** @internal */
  override componentFeatures = new ComponentFeatures({
    // All available features as enabled/disabled by default
    [Feature.CloudFiles]: true,
    [Feature.ContextData]: true,
    [Feature.FileCreate]: true,
    [Feature.FileEdit]: true,
    [Feature.FileUpload]: true,
  });

  /** @internal */
  protected theme = new ThemeController(this, WyFileNew.styles);

  /** @internal */
  private dropZone: DropZoneController = new DropZoneController(this);

  private createFilesController = new CreateFilesController(this);

  private fileCreateRef = createRef<WyFileCreate>();

  /**
   * Prompt for a filename and create a new file.
   *
   * @param ext - Suggested initial extension; the submitted filename is used unchanged.
   * @returns Data for the created file, or undefined if the prompt is cancelled.
   */
  async createFile(ext?: string) {
    await this.updateComplete;
    return await this.fileCreateRef.value?.createFile(ext);
  }

  /**
   * Upload one or more files. If no file is provided, the user will be prompted to select a file.
   *
   * @param files - Optional files to upload.
   * @returns An array of data for the created files.
   */
  async uploadFile(...files: File[]) {
    await this.updateComplete;
    if (files.length === 1) {
      return await this.createFilesController.uploadFile(files[0]);
    } else if (files.length > 1) {
      return await this.createFilesController.uploadFiles(files);
    } else {
      return await this.fileCreateRef.value?.getFileInput();
    }
  }

  /**
   * Request files via user input from a configured cloud file provider.
   * @returns An array of data for the created files.
   */
  async selectCloudFiles() {
    await this.updateComplete;
    return await this.fileCreateRef.value?.getCloudFiles();
  }

  constructor() {
    super();
    this.addEventListener("drop-files", (e) => {
      if (this.componentFeatures?.allowsFeature(Feature.FileUpload)) {
        void this.createFilesController.uploadFiles((e as DropFilesEventType).detail.files);
      }
    });
  }

  protected override render() {
    const isDragActive = this.componentFeatures?.allowsFeature(Feature.FileUpload) && this.dropZone.isDragActive;

    return html`
      <div part="wy-file-new ${partMap({ "wy-dragging": isDragActive })}" data-drag-title=${msg("Drop files here")}>
        <wy-file-create ${ref(this.fileCreateRef)}></wy-file-create>
      </div>
    `;
  }
}
