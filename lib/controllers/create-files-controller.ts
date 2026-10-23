import { LitElement, ReactiveController, ReactiveControllerHost } from "lit";
import { NamedEvent } from "../types/generic.types";
import { ContextConsumer } from "@lit/context";
import { type WeavyType, WeavyContext } from "../contexts/weavy-context";
import { whenParentsDefined } from "../utils/dom";
import { AppType, PermissionType } from "../types/app.types";
import { WyActionEventType } from "../types/action.events";
import { ActionType } from "../types/action.types";
import {
  BlobType,
  CreateFileProps,
  ExternalBlobType,
  FileMutationContextType,
  FileType,
  MutateFileProps,
} from "../types/files.types";
import { getExternalBlobMutationOptions, MutateExternalBlobVariables } from "../data/blob-external";
import { MutationController } from "./mutation-controller";
import { hasAnyPermission } from "../utils/permission";
import { AppContext, UserContext, UserType } from "../contexts";
import { getUploadBlobMutationOptions } from "../data/blob-upload";
import { getCreateFileMutationOptions, removeSettledFileMutations } from "../data/file-create";
import type { ServerErrorResponseType } from "../types/server.types";
import { WeavyAppComponentContextProps, WeavyComponentContextProps } from "../types/component.types";

/**
 * Lit element controller for creating a conversation app.
 *
 * - Requires a weavy context.
 * - May use members and an agent.
 *
 * @fires {WyActionEventType} wy-action - Emitted when a file is created.
 */
export class CreateFilesController implements ReactiveController {
  host: LitElement & ReactiveControllerHost;

  // Weavy context
  protected weavyContext?: ContextConsumer<{ __context__: WeavyType }, LitElement>;
  protected whenWeavyContext: Promise<WeavyType>;
  protected resolveWeavyContext?: (value: WeavyType | PromiseLike<WeavyType>) => void;

  protected get weavy() {
    return this.weavyContext?.value;
  }

  // App context
  protected appContext?: ContextConsumer<{ __context__: AppType }, LitElement>;
  protected whenAppContext: Promise<AppType>;
  protected resolveAppContext?: (value: AppType | PromiseLike<AppType>) => void;

  protected get app() {
    return this.appContext?.value || (this.host as unknown as WeavyAppComponentContextProps).app;
  }

  // User context
  protected userContext?: ContextConsumer<{ __context__: UserType }, LitElement>;
  protected whenUserContext: Promise<UserType>;
  protected resolveUserContext?: (value: UserType | PromiseLike<UserType>) => void;

  protected get user() {
    return this.userContext?.value || (this.host as unknown as WeavyComponentContextProps).user;
  }

  /** @internal */
  private uploadBlobMutation?: MutationController<BlobType, Error, MutateFileProps, FileMutationContextType>;

  /** @internal */
  private externalBlobMutation?: MutationController<
    BlobType,
    Error,
    MutateExternalBlobVariables,
    FileMutationContextType
  >;

  /** @internal */
  private createFileMutation?: MutationController<FileType, Error, CreateFileProps, FileMutationContextType>;

  constructor(host: LitElement) {
    host.addController(this);
    this.host = host;
    this.whenWeavyContext = new Promise((r) => (this.resolveWeavyContext = r));
    this.whenAppContext = new Promise((r) => (this.resolveAppContext = r));
    this.whenUserContext = new Promise((r) => (this.resolveUserContext = r));
    void this.setContexts();
  }

  /**
   * Initiates context consumers
   */
  protected async setContexts() {
    await whenParentsDefined(this.host);
    this.weavyContext = new ContextConsumer(this.host, { context: WeavyContext, subscribe: true });
    this.appContext = new ContextConsumer(this.host, { context: AppContext, subscribe: true });
    this.userContext = new ContextConsumer(this.host, { context: UserContext, subscribe: true });
  }

  /**
   * Dispatch a `wy-action` event on the host.
   *
   * @fires {WyActionEventType} wy-action - Emitted when a conversation app is created and should be selected.
   */
  async dispatchActionEvent(file: FileType, action: ActionType = ActionType.Select) {
    const app = await this.whenAppContext;
    const eventAction: WyActionEventType = new (CustomEvent as NamedEvent)("wy-action", {
      detail: { action, app, file },
      bubbles: true,
      composed: true,
    });
    return this.host.dispatchEvent(eventAction);
  }

  /**
   * Create mutation controllers.
   */
  protected async initMutations() {
    if (!this.uploadBlobMutation || !this.externalBlobMutation || !this.createFileMutation) {
      await this.whenWeavyContext;
      this.uploadBlobMutation = new MutationController(this.host);
      this.externalBlobMutation = new MutationController(this.host);
      this.createFileMutation = new MutationController(this.host);
    }

    const [weavy, app, user] = await Promise.all([this.whenWeavyContext, this.whenAppContext, this.whenUserContext]);

    await this.uploadBlobMutation.trackMutation(getUploadBlobMutationOptions(weavy, user, app.id));
    await this.createFileMutation.trackMutation(getCreateFileMutationOptions(weavy, user, app));
    await this.externalBlobMutation.trackMutation(getExternalBlobMutationOptions(weavy, user, app.id));

    return {
      uploadBlobMutation: this.uploadBlobMutation,
      externalBlobMutation: this.externalBlobMutation,
      createFileMutation: this.createFileMutation,
    };
  }

  /*async cleanUpMutatingFiles() {
      const [weavy, app] = await Promise.all([this.whenWeavyContext, this.whenAppContext, this.whenUserContext]);

      // clear errored mutations before uploading more files
      removeErroredFileMutations(weavy, app);

      // Check the just updated file status
      const fileStatus = getFileMutationsTotalStatus(this.mutatingFiles.result);

      // If everything seems ok, start a fresh upload session
      if (fileStatus === "ok") {
        removeSettledFileMutations(weavy, app);
      }
  }*/

  /**
   * Upload a file and dispatch a `wy-action` event for the created file.
   *
   * @param file - The file to upload.
   * @param action - Action to dispatch, or a function choosing it from the created file. A function is needed when the action depends on properties only the server knows, such as the file `kind`.
   * @returns The created file.
   */
  async uploadFile(file: File | null | undefined, action?: ActionType | ((createdFile: FileType) => ActionType)) {
    if (!file) {
      console.warn("No file supplied.");
      return;
    }

    const { uploadBlobMutation, createFileMutation } = await this.initMutations();
    const app = await this.whenAppContext;

    if (!hasAnyPermission([PermissionType.Create, PermissionType.Admin], app.permissions)) {
      throw new Error(`No permission to create files in app ${app.id}.`);
    }

    const blob = await uploadBlobMutation.mutate({ file });
    const createdFile = await createFileMutation.mutate({ blob });

    await this.dispatchActionEvent(createdFile, typeof action === "function" ? action(createdFile) : action);

    return createdFile;
  }

  /**
   * Create an empty file with the given name, or report that the name is taken.
   *
   * Used by the filename prompt, which re-asks for a name on conflict. The server rejects a name that an existing
   * (non-trashed) file in the app already has with `409 Conflict`; that is returned as `undefined` instead of being
   * thrown, and the conflicting mutation is removed from the cache so the upload sheet does not also offer to replace
   * the existing file. Any other failure is thrown as usual.
   *
   * @param filename - The exact name of the file to create.
   * @param action - Action to dispatch, or a function choosing it from the created file.
   * @returns The created file, or `undefined` when a file with that name already exists.
   */
  async createEmptyFile(filename: string, action?: ActionType | ((createdFile: FileType) => ActionType)) {
    try {
      return await this.uploadFile(new File([], filename), action);
    } catch (error) {
      if (((error as Error)?.cause as ServerErrorResponseType | undefined)?.status !== 409) {
        throw error;
      }
      // The contexts are already resolved here since the upload needed them, but they may be missing when the upload is stubbed.
      if (this.weavy && this.app) {
        removeSettledFileMutations(this.weavy, this.app, filename);
      }
      return undefined;
    }
  }

  async uploadFiles(files: File[] | FileList | null | undefined) {
    if (!files || !files.length) {
      console.warn("No files supplied.");
      return;
    }

    // Make a hard copy to prevent gc
    files = [...files];

    // Handle status
    //await this.cleanUpMutatingFiles();

    // Upload
    const uploadedFiles = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      uploadedFiles.push(this.uploadFile(file));
    }

    return (await Promise.allSettled(uploadedFiles)).map((result) =>
      result.status === "fulfilled" ? result.value : undefined,
    );
  }

  async addExternalBlobs(externalBlobs: ExternalBlobType[] | null | undefined) {
    if (!externalBlobs) {
      console.warn("No blobs supplied.");
      return;
    }

    // Make a hard copy to prevent gc
    externalBlobs = [...externalBlobs];

    const { externalBlobMutation, createFileMutation } = await this.initMutations();
    const app = await this.whenAppContext;

    if (!hasAnyPermission([PermissionType.Create, PermissionType.Admin], app.permissions)) {
      throw new Error(`No permission to create files in app ${app.id}.`);
    }

    const addedBlobs = [];

    for (let i = 0; i < externalBlobs.length; i++) {
      const externalBlob = externalBlobs[i];
      addedBlobs.push(
        externalBlobMutation.mutate({ externalBlob }).then(async (blob) => {
          const createdFile = await createFileMutation.mutate({ blob });

          await this.dispatchActionEvent(createdFile);

          return createdFile;
        }),
      );
    }

    return (await Promise.allSettled(addedBlobs)).map((result) =>
      result.status === "fulfilled" ? result.value : undefined,
    );
  }

  async createFileFromBlob(blob: BlobType, replace?: boolean) {
    const { createFileMutation } = await this.initMutations();
    const app = await this.whenAppContext;

    if (!hasAnyPermission([PermissionType.Create, PermissionType.Admin], app.permissions)) {
      throw new Error(`No permission to create files in app ${app.id}.`);
    }

    const createdFile = await createFileMutation.mutate({ blob, replace });

    await this.dispatchActionEvent(createdFile);

    return createdFile;
  }

  hostUpdate(): void {
    // Resolve any context promises
    if (this.weavy) {
      this.resolveWeavyContext?.(this.weavy);
    }

    if (this.app) {
      this.resolveAppContext?.(this.app);
    }

    if (this.user) {
      this.resolveUserContext?.(this.user);
    }
  }
}
