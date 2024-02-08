import { LitElement, ReactiveController, ReactiveControllerHost } from "lit";

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

    host.addEventListener("dragstart", () => (this.isDragActive = true));
    host.addEventListener("dragenter", () => (this.isDragActive = true));
    host.addEventListener("dragover", (event: DragEvent) => {
      // prevent default to allow drop
      event.preventDefault();
      this.isDragActive = true;
    });
    host.addEventListener("dragleave", () => (this.isDragActive = false));
    host.addEventListener("dragend", () => (this.isDragActive = false));

    host.addEventListener("drop", (e: DragEvent) => this.handleDrop(e));
  }

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
          files.push(file!);
          //console.log(`… file[${i}].name = ${file?.name}`);
        }
      });
    } else if (event.dataTransfer?.files) {
      // Use DataTransfer interface to access the file(s)
      [...event.dataTransfer.files].forEach((file) => {
        files.push(file!);
        //console.log(`… file[${i}].name = ${file.name}`);
      });
    }

    if (files.length) {
      this.dispatchUploadFiles(files);
    }

    this.isDragActive = false;
  }

  private dispatchUploadFiles(files: FileList | File[] | null) {
    const uploadEvent = new CustomEvent("drop-files", { detail: { files } });
    return this.host.dispatchEvent(uploadEvent);
  }

  hostDisconnected() {}
}
