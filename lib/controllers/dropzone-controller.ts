import { LitElement, ReactiveController, ReactiveControllerHost } from "lit";
import { DropFilesEventType } from "../types/files.events";
import { NamedEvent } from "../types/generic.types";

export class DropZoneController implements ReactiveController {
  host: LitElement & ReactiveControllerHost;

  #isDragActive: boolean = false;

  get isDragActive() {
    return this.#isDragActive;
  }

  set isDragActive(dragActive) {
    if (this.#isDragActive !== dragActive) {
      this.#isDragActive = dragActive;
      this.host.requestUpdate();
    }
  }

  constructor(host: LitElement) {
    host.addController(this);
    this.host = host;

    // Only file drags show the overlay, which would otherwise swallow drops of text dragged in an editor.
    // No `dragstart`: it only fires for drags that start inside the host, never for files.
    host.addEventListener("dragenter", (event: DragEvent) => {
      if (this.hasFiles(event)) {
        this.isDragActive = true;
      }
    });
    host.addEventListener("dragover", (event: DragEvent) => {
      // prevent default to allow drop
      event.preventDefault();
      if (this.hasFiles(event)) {
        this.isDragActive = true;
      }
    });
    host.addEventListener("dragleave", () => (this.isDragActive = false));
    host.addEventListener("dragend", () => (this.isDragActive = false));

    // Reset in the capture phase: a nested zone stops the drop, and no `dragleave` follows it.
    host.addEventListener("drop", () => (this.isDragActive = false), { capture: true });
    host.addEventListener("drop", (e: DragEvent) => this.handleDrop(e));
  }

  /**
   * Whether a drag carries files. Unlike the files, `types` is readable during the whole drag.
   *
   * @param event - A drag event.
   * @returns `true` when the drag carries at least one file.
   */
  private hasFiles(event: DragEvent) {
    return event.dataTransfer?.types.includes("Files") ?? false;
  }

  /**
   * Take the files of a drop and dispatch them as a `drop-files` event on the host.
   *
   * @param event - The native drop event.
   */
  handleDrop(event: DragEvent) {
    //console.log("File(s) dropped");

    // Prevent default behavior (Prevent file from being opened)
    event.preventDefault();

    const files: File[] = [];

    if (event.dataTransfer?.items) {
      // Use DataTransferItemList interface to access the file(s)
      [...event.dataTransfer.items].forEach((item) => {
        // If dropped items aren't files, reject them
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) {
            files.push(file);
          } else {
            console.error("Could not add file")
          }
          //console.log(`… file[${i}].name = ${file?.name}`);
        }
      });
    } else if (event.dataTransfer?.files) {
      // Use DataTransfer interface to access the file(s)
      [...event.dataTransfer.files].forEach((file) => {
        files.push(file);
        //console.log(`… file[${i}].name = ${file.name}`);
      });
    }

    if (files.length) {
      // The drop is native and composed, so it would bubble on to any drop zone further out and be taken twice.
      event.stopPropagation();
      this.dispatchUploadFiles(files);
    }

    this.isDragActive = false;
  }

  private dispatchUploadFiles(files: FileList | File[] | null) {
    const uploadEvent: DropFilesEventType = new (CustomEvent as NamedEvent)("drop-files", { detail: { files } });
    return this.host.dispatchEvent(uploadEvent);
  }

  hostDisconnected() {}
}
