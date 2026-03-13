import { html, nothing, type TemplateResult, type PropertyValueMap } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { localized, msg, str } from "@lit/localize";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import throttle from "lodash.throttle";
import { typingMutation } from "../data/typing";
import { type MeetingType } from "../types/meetings.types";
import { addMeetingMutation } from "../data/meetings";
import { hasAbort, MutationController } from "../controllers/mutation-controller";
import {
  BlobType,
  ExternalBlobType,
  FileMutationContextType,
  FileStatusType,
  FileType,
  MutateFileProps,
} from "../types/files.types";
import { toUpperCaseFirst } from "../utils/strings";
import { getUploadBlobMutationOptions } from "../data/blob-upload";
import { MutationStateController } from "../controllers/mutation-state-controller";
import { repeat } from "lit/directives/repeat.js";
import { Mutation, MutationState } from "@tanstack/query-core";
import { removeMutation, removeMutations } from "../utils/mutation-cache";
import { WyCloudFiles } from "./wy-cloud-files";
import { ExternalBlobMutationType, getExternalBlobMutation } from "../data/blob-external";
import { PollOptionType } from "../types/polls.types";
import { clearEmbeds, getEmbeds, initEmbeds, isFetchingEmbeds } from "../utils/embeds";
import type { EmbedType } from "../types/embeds.types";
import { DropZoneController } from "../controllers/dropzone-controller";
import { getMeetingIconName, getMeetingTitle } from "../utils/meetings";
import { inputBlurOnEscape, inputConsume } from "../utils/keyboard";
import { WeavySubAppComponent } from "../classes/weavy-sub-app-component";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { Feature } from "../types/features.types";
import type { MetadataType } from "../types/lists.types";
import { EditorDraftType } from "../types/editor.types";
import { DropFilesEventType, ExternalBlobsEventType } from "../types/files.events";
import type { EditorChangeEventType, MsgEditorSubmitEventType } from "../types/editor.events";
import type { NamedEvent } from "../types/generic.types";
import type { EmbedRemoveEventType } from "../types/embeds.events";
import { getStorage, onlyValues } from "../utils/data";
import { AgentAppTypeGuids } from "../classes/weavy-type-component";
import { partMap } from "../utils/directives/shadow-part-map";

import rebootCss from "../scss/reboot.scss";
import postEditorCss from "../scss/components/editor-msg.scss";
import pollCss from "../scss/components/poll.scss";
import dropzoneCss from "../scss/components/dropzone.scss";
import inputCss from "../scss/components/input.scss";

import "./ui/wy-avatar";
import "./ui/wy-dropdown";
import "./ui/wy-item";
import "./wy-embed";
import "./wy-file-item";
import "./wy-cloud-files";
import "./ui/wy-button";
import "./ui/wy-icon";
import "./wy-editor-core";
import { WyEditorCore } from "./wy-editor-core";

declare global {
  interface HTMLElementTagNameMap {
    "wy-editor-msg": WyEditorMsg;
  }
}

/**
 * Rich text editor used for posts, messages and comments.
 *
 * **Used sub components:**
 *
 * - [`<wy-avatar>`](./ui/wy-avatar.ts)
 * - [`<wy-dropdown>`](./ui/wy-dropdown.ts)
 * - [`<wy-item>`](./ui/wy-item.ts)
 * - [`<wy-button>`](./ui/wy-button.ts)
 * - [`<wy-icon>`](./ui/wy-icon.ts)
 * - [`<wy-file-item>`](./wy-file-item.ts)
 * - [`<wy-embed>`](./wy-embed.ts)
 * - [`<wy-cloud-files>`](./wy-cloud-files.ts)
 * - [`<wy-embed-select>`](./wy-embed.ts)
 *
 * @csspart wy-editor - Root editor container
 * @csspart wy-dragging - Applied when dragging files over the editor
 * @csspart wy-editor-msg-inputs - Container for inputs/buttons
 * @csspart wy-editor-msg-buttons - Container for action buttons
 * @csspart wy-poll-form - Poll options container
 * @csspart wy-input - Inputs inside poll options
 *
 * @fires {MsgEditorSubmitEventType} submit - Emitted when the editor content is submitted 
 * @fires {CustomEvent} edit-last - Emitted when the last message should be edited.
 */
@customElement("wy-editor-msg")
@localized()
export class WyEditorMsg extends WeavySubAppComponent {
  static override styles = [rebootCss, postEditorCss, pollCss, dropzoneCss, inputCss];

  /**
   * Controller for exporting named shadow parts.
   *
   * @internal
   */
  protected exportParts = new ShadowPartsController(this);

  /** @internal */
  protected storage = getStorage("localStorage");

  /**
   * Whether the editor is disabled.
   */
  @property({ type: Boolean })
  disabled: boolean = false;

  /**
   * Parent id for context (message/comment/post).
   */
  @property({ attribute: false })
  parentId?: number;

  /**
   * Placeholder text for the editor input.
   */
  @property()
  placeholder: string = "";

  /**
   * Initial editor text content (draft or loaded content).
   */
  @property()
  text: string = "";

  /**
   * Metadata associated with the editor content (e.g. agent instructions).
   *
   */
  @property({ type: Object })
  metadata?: MetadataType = {};

  /**
   * Optional single embed to prefill the editor.
   *
   */
  @property({ attribute: false })
  embed?: EmbedType;

  /**
   * Poll option templates passed to the editor.
   */
  @property({ attribute: false })
  pollOptions: PollOptionType[] = [];

  /**
   * Attached file references (ids/resolved) shown in the editor.
   *
   */
  @property({ attribute: false })
  attachments: FileType[] = [];

  /**
   * Meeting object attached to the editor (if any).
   *
   */
  @property({ attribute: false })
  meeting?: MeetingType;

  /**
   * Text for the submit button.
   */
  @property()
  buttonText: string = "";

  /**
   * Whether typing indicators should be emitted.
   */
  @property({ type: Boolean })
  typing: boolean = true;

  /**
   * Whether this instance should persist drafts.
   */
  @property({ type: Boolean })
  draft: boolean = false;

  /**
   * Editor usage context, used to adjust behavior and styling.
   */
  @property()
  editorType: "messages" | "posts" | "comments" = "posts";

  /**
   * CSS class applied to the editor container.
   */
  @property()
  editorClass: string = "wy-editor-msg";

  /**
   * Location context to use for file uploads and embeds.
   */
  @property()
  editorLocation: "messages" | "posts" | "apps" | "files" = "apps";

  /**
   * Select all content in the editor.
   */
  async selectAllContent() {
    await this.whenEditor();
    await this.editorRef.value?.selectAllContent();
  }

  /**
   * Place cursor at the end of the editor content.
   */
  async setCursorLast() {
    await this.whenEditor();
    await this.editorRef.value?.setCursorLast();
  }

  /**
   * Focus the editor input.
   */
  async focusInput() {
    await this.whenEditor();
    await this.editorRef.value?.focusInput();
  }

  /**
   * Internal embeds array derived from `embed` or discovered content.
   *
   * @internal
   */
  #embeds: EmbedType[] = [];

  @state()
  set embeds(embeds: EmbedType[]) {
    // Filter out "empty" embeds
    const filteredEmbeds = embeds.filter((embed) => embed.type !== "link" || embed.title || embed.description);
    this.#embeds = [...filteredEmbeds];
  }
  get embeds() {
    return this.#embeds;
  }

  /**
   * Resolves when the editor is available.
   *
   * @returns {Promise<WyEditorCore>}
   */
  async whenEditor() {
    return await this.#whenEditor;
  }
  #resolveEditor?: (editor: WyEditorCore) => void;
  #whenEditor = new Promise<WyEditorCore>((r) => {
    this.#resolveEditor = r;
  });

  /**
   * Id used for handling drafts.
   * @internal
   */
  @state()
  protected draftKey: string = "";

  /**
   * App id used for mutations. Automatically set to negative number when no app id is available.
   * @internal
   */
  @state()
  protected mutationAppId?: number;

  /**
   * Mutation controller for uploading blobs.
   *
   * @internal
   */
  protected uploadBlobMutation = new MutationController<BlobType, Error, MutateFileProps, FileMutationContextType>(
    this,
  );

  /**
   * Tracks state of file mutation uploads.
   *
   * @internal
   */
  protected mutatingFiles = new MutationStateController<
    BlobType | FileType,
    Error,
    MutateFileProps,
    FileMutationContextType
  >(this);

  /**
   * External blob mutation handler (e.g. importing external files).
   *
   * @internal
   */
  protected externalBlobMutation?: ExternalBlobMutationType;

  /**
   * File input element reference.
   *
   * @internal
   */
  protected fileInputRef: Ref<HTMLInputElement> = createRef();

  /**
   * Cloud files picker reference.
   *
   * @internal
   */
  protected cloudFilesRef: Ref<WyCloudFiles> = createRef();

  /**
   * Drop zone controller for drag & drop file handling.
   *
   * @internal
   */
  protected dropZone: DropZoneController = new DropZoneController(this);

  /**
   * Reference to the editor DOM node wrapper.
   *
   * @internal
   */
  protected editorRef: Ref<WyEditorCore> = createRef();

  /**
   * Throttled typing indicator sender to reduce network traffic.
   *
   * @internal
   */
  async handleTyping() {
    if (this.weavy && this.app && !AgentAppTypeGuids.has(this.app.type)) {
      // TODO: Maybe not a new observer for every time?
      const mutation = typingMutation(this.weavy, this.app.id);
      await mutation.mutate();
    }
  }

  /**
   * Reference to oauth authentication window when attaching meetings.
   */
  protected authWindow?: WindowProxy | null;

  constructor() {
    super();

    this.addEventListener("drop-files", (e) => this.handleDropFiles(e as DropFilesEventType));
    this.addEventListener("keydown", inputBlurOnEscape);
    this.addEventListener("keyup", inputConsume);
  }

  override willUpdate(changedProperties: PropertyValueMap<this>): void {
    super.willUpdate(changedProperties);

    if (changedProperties.has("app")) {
      // clear mutationAppId when app changes - will be assigned later
      this.mutationAppId = undefined;
    }

    if (
      (changedProperties.has("weavy") ||
        changedProperties.has("app") ||
        changedProperties.has("user") ||
        changedProperties.has("parentId")) &&
      this.weavy &&
      this.app &&
      this.user
    ) {
      this.mutationAppId = this.mutationAppId ?? this.app?.id ?? Date.now() * -1;
      this.draftKey = `draft-${this.editorType}-${this.parentId || this.mutationAppId}`;

      void this.uploadBlobMutation.trackMutation(
        getUploadBlobMutationOptions(
          this.weavy,
          this.user,
          this.mutationAppId,
          `${this.editorLocation}-${this.parentId || this.mutationAppId}`,
        ),
      );

      void this.mutatingFiles.trackMutationState(
        {
          filters: {
            mutationKey: [
              "apps",
              this.mutationAppId,
              "blobs",
              `${this.editorLocation}-${this.parentId || this.mutationAppId}`,
            ],
            exact: true,
          },
        },
        this.weavy.queryClient,
      );
      this.externalBlobMutation = getExternalBlobMutation(
        this.weavy,
        this.user,
        this.mutationAppId,
        `${this.editorLocation}-${this.parentId || this.mutationAppId}`,
      );

      if (
        this.draft &&
        this.storage &&
        (!this.hasChanged() ||
          changedProperties.get("weavy") ||
          changedProperties.get("app") ||
          changedProperties.get("user") ||
          changedProperties.get("parentId"))
      ) {
        const draftString = this.storage.getItem(this.draftKey);
        if (draftString) {
          const draft = JSON.parse(draftString) as EditorDraftType;

          this.text = draft.text ?? "";
          this.embeds = draft.embeds;
          this.meeting = draft.meeting;
          if (draft.pollOptions?.length > 0) {
            this.pollOptions = draft.pollOptions;
          }

          initEmbeds(this.embeds.map((embed) => embed.url).filter((url): url is string => typeof url === "string"));
        } else {
          // clear editor if weavy/app/user/parentId had a previous value
          this.clearEditor();
        }
      }

      // set other editor content properties
      if (this.embed) {
        this.embeds = [this.embed];
        initEmbeds(this.embeds.map((embed) => embed.url).filter((url): url is string => typeof url === "string"));
      }
    }
  }

  protected override updated(changedProperties: PropertyValueMap<this>): void {
    if (this.editorRef.value) {
      this.#resolveEditor?.(this.editorRef.value);
    }

    if (changedProperties.has("text")) {
      this.throttledDrafting();

      if (this.componentFeatures?.allowsFeature(Feature.Embeds) && this.text !== "") {
        void this.handleEmbeds(this.text);
      }
    }
  }

  override connectedCallback() {
    super.connectedCallback();

    // add meetings event listener
    window.addEventListener("message", this.createMeeting);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();

    // remove meetings event listener
    window.removeEventListener("message", this.createMeeting);
  }

  protected handleRemoveMeeting() {
    this.meeting = undefined;
  }

  /**
   * Open native file picker.
   *
   * @internal
   */
  async openFileInput() {
    await this.whenEditor();
    this.fileInputRef.value?.click();
  }

  /**
   * Open cloud files picker overlay.
   *
   * @internal
   */
  async openCloudFiles() {
    await this.whenEditor();
    this.cloudFilesRef.value?.open();
  }

  /**
   * Handle files dropped on the editor.
   *
   * @internal
   * @param e - Drop files event
   */
  protected handleDropFiles(e: DropFilesEventType) {
    const eventDetail = e.detail;
    if (eventDetail.files) {
      void this.handleUploadFiles(eventDetail.files);
    }
  }

  /**
   * Upload array of File objects via the upload blob mutation controller.
   *
   * Preserves input value if provided and saves draft after each upload.
   *
   * @internal
   * @param files - FileList or array of File objects to upload
   * @param input - Optional input element to reset after upload
   */
  protected async handleUploadFiles(files: File[] | FileList | null, input?: HTMLInputElement) {
    if (files) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileProps = { file: file };
        await this.uploadBlobMutation.mutate(fileProps);
        this.saveDraft();
      }
      if (input) {
        input.value = "";
      }
    }
  }

  /**
   * Handle external blob imports (cloud/external sources).
   *
   * @internal
   * @param externalBlobs - Array of external blob descriptors
   */
  protected handleExternalBlobs(externalBlobs: ExternalBlobType[] | null) {
    if (externalBlobs) {
      for (let i = 0; i < externalBlobs.length; i++) {
        const externalBlob = externalBlobs[i];
        void this.externalBlobMutation?.mutate({ externalBlob });
      }
    }
  }

  /**
   * Handle removal/abortion of an upload mutation and clean cache state.
   *
   * @internal
   * @param mutation - Mutation state object to remove
   */
  protected handleRemoveUpload(mutation: MutationState<BlobType, Error, MutateFileProps, FileMutationContextType>) {
    if (!this.weavy || !this.mutationAppId) {
      return;
    }

    if (mutation.status === "pending" && hasAbort(mutation.variables)) {
      // Abort any ongoing upload
      mutation.variables.abort?.();
    }

    removeMutation(
      this.weavy.queryClient,
      ["apps", this.mutationAppId, "blobs", `${this.editorLocation}-${this.parentId || this.mutationAppId}`],
      (m) =>
        (m as Mutation<BlobType, Error, MutateFileProps, FileMutationContextType>).state.data?.id === mutation.data?.id,
    );
  }

  /**
   * Persist draft to storage if draft mode is enabled.
   *
   * Saves editor text, embeds, poll options and ongoing file uploads to localStorage.
   *
   * @internal
   */
  protected saveDraft() {
    if (!this.draft || !this.storage) return;

    const files = this.mutatingFiles.result;

    if (
      (!files || !files.length) &&
      !this.meeting &&
      !this.embeds.length &&
      (!this.pollOptions.length || this.pollOptions.filter((option) => option.text.trim() !== "").length === 0) &&
      this.text === ""
    ) {
      this.storage.removeItem(this.draftKey);
    } else {
      const draft: EditorDraftType = {
        meeting: this.meeting,
        text: this.text,
        pollOptions: this.pollOptions.filter((option) => option.text.trim() !== ""),
        embeds: this.embeds,
      };
      this.storage.setItem(this.draftKey, JSON.stringify(draft));
    }
  }

  /**
   * Handle removal of an attachment reference from the editor state.
   *
   * @internal
   * @param attachment - Attachment to remove
   */
  protected handleRemoveAttachment(attachment: FileType) {
    this.attachments = this.attachments.filter((a) => a.id !== attachment.id);
  }

  /**
   * Submit the editor content by dispatching a `submit` event.
   *
   * Validates that there is content to submit and that no uploads/embeds are still processing.
   *
   * @internal
   */
  protected submit() {
    const fileMutationResults = this.mutatingFiles.result;

    const currentlyUploadingFiles = fileMutationResults?.some((upload) => upload.status === "pending");

    const text = this.text.trim() ?? "";
    const meetingId = this.meeting?.id;
    const blobs = fileMutationResults?.map((mutation) => mutation.data?.id).filter(onlyValues) as number[] | undefined;
    const attachments = this.attachments?.map((attachment) => attachment.id) || [];
    const pollOptions = this.pollOptions.filter((p) => p.text.trim() !== "");

    if (
      isFetchingEmbeds() ||
      currentlyUploadingFiles ||
      !this.contextDataBlobs ||
      (!text &&
        !meetingId &&
        blobs?.length == 0 &&
        pollOptions.length == 0 &&
        attachments.length == 0 &&
        this.embeds.length == 0)
    ) {
      return;
    }

    const contextData = this.contextDataBlobs.length ? this.contextDataBlobs : undefined;

    const submitEvent: MsgEditorSubmitEventType = new (CustomEvent as NamedEvent)("submit", {
      detail: { text, meetingId, blobs, attachments, pollOptions, embedId: this.embeds[0]?.id, contextData },
      bubbles: true,
      composed: true,
    });

    this.dispatchEvent(submitEvent);

    this.resetEditor();
  }

  protected editLast() {
    const editLastEvent = new (CustomEvent as NamedEvent)("edit-last", {
      bubbles: true,
      composed: true,
    });

    this.dispatchEvent(editLastEvent);
  }

  /**
   * Reset the editor state after a successful submit.
   *
   * Clears editor content, removes pending uploads from the query cache and deletes the stored draft.
   *
   * @internal
   */
  protected resetEditor() {
    this.clearEditor();

    if (this.weavy && this.mutationAppId) {
      removeMutations(this.weavy.queryClient, [
        "apps",
        this.mutationAppId,
        "blobs",
        `${this.editorLocation}-${this.parentId || this.mutationAppId}`,
      ]);
    }

    this.storage?.removeItem(this.draftKey);
  }

  /**
   * Clear the editor UI and internal state (text, embeds, attachments, metadata).
   *
   * @internal
   */
  protected clearEditor() {
    this.text = "";
    this.meeting = undefined;
    this.pollOptions = [];
    this.embeds = [];
    this.metadata = {};
    clearEmbeds();
  }

  /**
   * Checks if the editor has a dirty internal state (text, embeds, attachments, metadata).
   *
   * @internal
   */
  protected hasChanged() {
    return (
      this.text !== "" ||
      this.meeting !== undefined ||
      this.pollOptions.length ||
      this.embeds.length ||
      (this.metadata && this.metadata.length)
    );
  }

  /**
   * Throttled drafting saver to minimize writes.
   *
   * @internal
   */
  private throttledDrafting = throttle(
    () => {
      this.saveDraft();
    },
    500,
    { leading: true, trailing: true },
  );

  /**
   * Message event handler for meeting OAuth responses.
   *
   * Listens for postMessage responses from the meeting auth window and completes meeting creation.
   *
   * @internal
   * @param e - MessageEvent containing meeting authorization payload (e.data.name).
   */
  private createMeeting = async (e: MessageEvent<{ name: string }>) => {
    if (!this.weavy) {
      return;
    }

    if (
      e.source === this.authWindow &&
      (this.weavy.url as URL).origin === e.origin &&
      e.data &&
      e.data.name &&
      e.data.name.endsWith("-authorized")
    ) {
      const name = e.data.name.slice(0, -"-authorized".length);
      const mutation = addMeetingMutation(this.weavy, name);
      const meeting = await mutation.mutate();

      if (!meeting.auth_url) {
        this.meeting = meeting;
      }
    }
  };

  /**
   * Create or initiate a meeting for the current user.
   *
   * If the meeting requires third-party auth, opens an auth popup; otherwise stores the created meeting.
   *
   * @internal
   * @param name - Provider key for the meeting (e.g. "zoom", "google", "microsoft")
   */
  protected async handleMeetingClick(name: string) {
    if (!this.weavy || !this.user) {
      return;
    }

    const mutation = addMeetingMutation(this.weavy, name);
    const meeting = await mutation.mutate();

    if (meeting.auth_url) {
      this.authWindow = window.open(meeting.auth_url, "oauthwin", "height=640,width=480");
    } else {
      this.meeting = meeting;
    }
  }

  /**
   * Add a discovered embed to the editor and persist draft.
   *
   * @internal
   * @param embed - Embed object to add.
   */
  protected setEmbeds(embed: EmbedType) {
    this.embeds = [embed, ...this.embeds];
    this.saveDraft();
  }

  /**
   * Scan content for embeds and add them via setEmbeds callback.
   *
   * @internal
   * @param content - Text content to scan for embed links.
   */
  protected handleEmbeds(content: string) {
    if (!this.weavy) {
      return;
    }

    getEmbeds(content, this.setEmbeds.bind(this), this.weavy);
  }

  /**
   * Remove an embed by id from the editor embeds list and persist draft.
   *
   * @internal
   * @param e - Embed remove event containing embed id.
   */
  protected removeEmbed(e: EmbedRemoveEventType) {
    this.embeds = this.embeds.filter((embed: EmbedType) => embed.id !== e.detail.id);
    this.saveDraft();
  }

  /**
   * Cycle the primary embed (move first to the end) and persist draft.
   *
   * @internal
   */
  protected swapEmbed() {
    const first = this.embeds.shift();
    if (first) {
      this.embeds = [...this.embeds, first];
    }
    this.saveDraft();
  }

  /**
   * Toggle the poll UI in the editor and initialize default options when opened.
   *
   * @param [open=true] - Whether to open the polls - set `false` to close.
   * @internal
   */
  protected togglePolls(open?: boolean) {
    if (this.pollOptions.length === 0) {
      this.pollOptions = Array.from({ length: 3 }, () => ({ id: null, text: "" }));
    } else if (open !== true) {
      this.pollOptions = [];
    }
  }

  /**
   * Handle change to a poll option input and persist draft.
   *
   * @internal
   * @param e - Input event
   * @param index - Index of the poll option changed
   */
  protected handlePollOptionChange(e: Event, index: number) {
    const newValues = [...this.pollOptions];
    newValues[index].text = (e.target as HTMLInputElement).value;
    this.pollOptions = newValues;

    this.saveDraft();
  }

  /**
   * Add a new poll option when focus reaches the last option (limit 5).
   *
   * @internal
   * @param e - Focus/keyboard event
   * @param index - Index of the poll option that triggered the add
   */
  protected handlePollOptionAdd(e: Event, index: number) {
    // NOTE: only allow 5 options for now
    if (index === this.pollOptions.length - 1 && this.pollOptions.length < 5) {
      const option = { id: null, text: "" };
      this.pollOptions = [...this.pollOptions, option];
      this.saveDraft();
    }
  }

  protected renderEditor(): (TemplateResult | typeof nothing)[] | TemplateResult | typeof nothing {
    return html`
      <wy-editor-core
        ${ref(this.editorRef)}
        .editorType=${this.editorType}
        .typing=${this.typing}
        .text=${this.text}
        @typing=${() => this.handleTyping()}
        @change=${(e: EditorChangeEventType) => {
          this.text = e.detail.text;
        }}
        @edit=${() => this.editLast()}
        @drop-files=${(e: DropFilesEventType) => this.handleDropFiles(e)}
        @submit=${() => this.submit()}
      ></wy-editor-core>
    `;
  }

  protected renderTopSlot(): (TemplateResult | typeof nothing)[] | TemplateResult | typeof nothing {
    return nothing;
  }

  protected renderMiddleSlot(): (TemplateResult | typeof nothing)[] | TemplateResult | typeof nothing {
    return html`
      <!-- Input -->
      ${this.renderEditor()}

      <div part="wy-editor-msg-inputs">
        <div part="wy-editor-msg-buttons">
          ${this.componentFeatures?.allowsFeature(Feature.Attachments)
            ? html`<wy-button
                  kind="icon"
                  @click=${() => this.openFileInput()}
                  title=${msg("From device")}
                  ?disabled=${this.disabled}
                >
                  <wy-icon name="attachment"></wy-icon>
                </wy-button>
                <input
                  type="file"
                  ${ref(this.fileInputRef)}
                  @click=${(e: Event) => e.stopPropagation()}
                  @change=${(e: Event) =>
                    this.handleUploadFiles(
                      Array.from((e.target as HTMLInputElement).files || []),
                      e.target as HTMLInputElement,
                    )}
                  multiple
                  hidden
                  tabindex="-1"
                  ?disabled=${this.disabled}
                />`
            : nothing}
          ${this.componentFeatures?.allowsFeature(Feature.CloudFiles)
            ? html`<wy-button
                kind="icon"
                @click=${() => this.openCloudFiles()}
                title=${msg("From cloud")}
                ?disabled=${this.disabled}
              >
                <wy-icon name="cloud"></wy-icon>
              </wy-button>`
            : nothing}
          ${this.componentFeatures?.allowsAnyFeature(Feature.Meetings, Feature.ZoomMeetings)
            ? html`
                <wy-button
                  kind="icon"
                  @click=${() => this.handleMeetingClick("zoom")}
                  title=${msg("Zoom meeting")}
                  ?disabled=${this.disabled}
                >
                  <wy-icon svg="zoom-meetings"></wy-icon>
                </wy-button>
              `
            : nothing}
          ${this.componentFeatures?.allowsAnyFeature(Feature.Meetings, Feature.GoogleMeet)
            ? html`
                <wy-button
                  kind="icon"
                  @click=${() => this.handleMeetingClick("google")}
                  title=${msg("Google Meet")}
                  ?disabled=${this.disabled}
                >
                  <wy-icon svg="google-meet"></wy-icon>
                </wy-button>
              `
            : nothing}
          ${this.componentFeatures?.allowsAnyFeature(Feature.Meetings, Feature.MicrosoftTeams)
            ? html`
                <wy-button
                  kind="icon"
                  @click=${() => this.handleMeetingClick("microsoft")}
                  title=${msg("Microsoft Teams")}
                  ?disabled=${this.disabled}
                >
                  <wy-icon svg="microsoft-teams"></wy-icon>
                </wy-button>
              `
            : nothing}
          ${this.componentFeatures?.allowsFeature(Feature.Polls)
            ? html`<wy-button
                kind="icon"
                @click=${() => this.togglePolls()}
                title=${msg("Poll")}
                ?disabled=${this.disabled}
              >
                <wy-icon name="poll"></wy-icon>
              </wy-button>`
            : nothing}
            <slot name="actions"></slot>
        </div>

        <slot name="inputs"></slot>
        
        <!-- Button -->
        <wy-button @click="${() => this.submit()}" color="primary" title=${this.buttonText} ?disabled=${this.disabled}>
          ${this.buttonText}
        </wy-button>
      </div>
    `;
  }

  /**
   * Render the bottom slot which aggregates lists (polls, meetings, file uploads, attachments, embeds).
   *
   * @internal
   */
  protected renderBottomSlot(): (TemplateResult | typeof nothing)[] | TemplateResult | typeof nothing {
    return [this.renderLists()];
  }

  /**
   * Render the lists section (poll options, meetings, file uploads, attachments, embeds).
   *
   * @internal
   */
  protected renderLists(): TemplateResult | typeof nothing {
    const fileMutationResults = this.mutatingFiles.result;

    const hasPolls = (this.componentFeatures?.allowsFeature(Feature.Polls) && this.pollOptions.length > 0) || false;
    const hasMeetings =
      (this.meeting?.provider === "zoom" &&
        this.componentFeatures?.allowsAnyFeature(Feature.Meetings, Feature.ZoomMeetings)) ||
      (this.meeting?.provider === "google" &&
        this.componentFeatures?.allowsAnyFeature(Feature.Meetings, Feature.GoogleMeet)) ||
      (this.meeting?.provider === "microsoft" &&
        this.componentFeatures?.allowsAnyFeature(Feature.Meetings, Feature.MicrosoftTeams)) ||
      false;
    const hasFileMutations = (fileMutationResults && fileMutationResults.length > 0) || false;
    const hasAttachments = this.attachments && this.attachments.length > 0;
    const hasEmbeds = (this.componentFeatures?.allowsFeature(Feature.Embeds) && this.embeds.length > 0) || false;

    if (this.disabled || !(hasPolls || hasMeetings || hasFileMutations || hasAttachments || hasEmbeds)) {
      return nothing;
    }

    return html` <div part="wy-editor-parts">
      <!-- polls -->
      ${hasPolls
        ? html`
            <div part="wy-poll-form">
              ${this.pollOptions.map((p: PollOptionType, index: number) => {
                const optionNumber = index + 1;
                return html`<input
                  value="${p.text}"
                  part="wy-input"
                  type="text"
                  placeholder=${msg(str`Option ${optionNumber}`)}
                  @change=${(e: Event) => this.handlePollOptionChange(e, index)}
                  @keyup=${inputConsume}
                  @focus=${(e: Event) => this.handlePollOptionAdd(e, index)}
                />`;
              })}
            </div>
          `
        : nothing}

      <!-- meetings -->
      ${hasMeetings && this.meeting
        ? html`
            <wy-item size="sm">
              <wy-icon slot="image" svg="${getMeetingIconName(this.meeting.provider)}"></wy-icon>
              <span slot="title">${getMeetingTitle(this.meeting.provider)}</span>
              <wy-button slot="actions" kind="icon" @click=${() => this.handleRemoveMeeting()}>
                <wy-icon name="close"></wy-icon>
              </wy-button>
            </wy-item>
          `
        : nothing}

      <!-- blobs -->
      ${hasFileMutations && fileMutationResults
        ? html`<div>
            ${repeat(
              fileMutationResults,
              (mutation) => "mutation" + mutation.submittedAt,
              (mutation) => {
                if (mutation.context?.file) {
                  const file = mutation.context.file;
                  const fileStatus: FileStatusType = {
                    ...mutation.context.status,
                  };
                  return html`
                    <wy-file-item
                      .file=${mutation.context.file}
                      .status=${fileStatus}
                      title="${toUpperCaseFirst(mutation.context.type)}: ${file.name +
                      (fileStatus.text ? `: ${fileStatus.text}` : "")}"
                    >
                      <span slot="title"
                        ><strong></strong> ${file.name}
                        ${fileStatus.text ? html`: <em>${fileStatus.text}</em>` : nothing}</span
                      >
                      ${fileStatus.state === "pending"
                        ? html`
                            <wy-progress-circular
                              slot="actions"
                              padded
                              ?indeterminate=${Boolean(!fileStatus.progress)}
                              .max=${100}
                              .value=${fileStatus.progress || 0}
                            ></wy-progress-circular>
                          `
                        : nothing}
                      <wy-button
                        slot="actions"
                        kind="icon"
                        @click=${() => {
                          this.handleRemoveUpload(mutation);
                        }}
                        title=${msg("Discard", { desc: "Button action to discard" })}
                      >
                        <wy-icon name="close"></wy-icon>
                      </wy-button>
                    </wy-file-item>
                  `;
                }

                return nothing;
              },
            )}
          </div>`
        : nothing}

      <!-- attachments -->
      ${hasAttachments
        ? this.attachments.map(
            (attachment) =>
              html`<wy-file-item .file=${attachment} title="${attachment.name}">
                <span slot="title">${attachment.name}</span>
                <wy-button
                  slot="actions"
                  kind="icon"
                  @click=${() => this.handleRemoveAttachment(attachment)}
                  title=${msg("Remove", { desc: "Button action to remove" })}
                >
                  <wy-icon name="close"></wy-icon>
                </wy-button>
              </wy-file-item>`,
          )
        : nothing}

      <!-- embeds -->
      ${hasEmbeds
        ? html`
            <wy-embed-select
              .embeds=${this.embeds}
              @embed-remove=${(e: EmbedRemoveEventType) => this.removeEmbed(e)}
              @embed-swap=${() => this.swapEmbed()}
            ></wy-embed-select>
          `
        : nothing}
    </div>`;
  }

  /**
   * Render the cloud files picker if cloud files feature is enabled.
   *
   * @internal
   */
  protected renderCloudFiles(): TemplateResult | typeof nothing {
    if (this.disabled) {
      return nothing;
    }

    return html`
      <wy-cloud-files
        ${ref(this.cloudFilesRef)}
        @external-blobs=${(e: ExternalBlobsEventType) => this.handleExternalBlobs(e.detail.externalBlobs)}
      ></wy-cloud-files>
    `;
  }

  protected override render() {
    const isDragActive = this.dropZone.isDragActive;

    return html`
      <div
        part=${partMap({
          "wy-editor": true,
          [this.editorClass]: true,
          "wy-dragging": isDragActive,
        })}
        data-drag-title=${msg("Drop files here")}
      >
        ${this.renderTopSlot()} ${this.renderMiddleSlot()} ${this.renderBottomSlot()}
      </div>
      ${this.renderCloudFiles()}
    `;
  }
}
