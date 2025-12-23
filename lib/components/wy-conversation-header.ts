import { html, nothing, type PropertyValueMap } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { WeavySubComponent } from "../classes/weavy-sub-component";
import type { MemberType, MembersResultType } from "../types/members.types";
import { getMemberOptions } from "../data/members";
import { QueryController } from "../controllers/query-controller";
import { localized, msg } from "@lit/localize";
import {
  AddMembersToConversationMutationType,
  LeaveConversationMutationType,
  UpdateConversationMutationType,
  UpdateMemberMutationType,
  getAddMembersToConversationMutation,
  getLeaveConversationMutation,
  getUpdateConversationMutation,
  getUpdateMemberMutation,
} from "../data/conversation";
import { ifDefined } from "lit/directives/if-defined.js";
import { inputBlurOnEnter } from "../utils/keyboard";
import type { RealtimeAppEventType, RealtimePresenceEventType } from "../types/realtime.types";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { BlobType } from "../types/files.types";
import { type AppType, AppTypeGuid, AccessType, PermissionType } from "../types/app.types";
import { hasPermission } from "../utils/permission";
import type { BlobUploadedEventType } from "../types/files.events";
import type { MemberSearchSubmitEventType } from "../types/members.events";
import { NamedEvent } from "../types/generic.types";
import { ActionType } from "../types/action.types";
import { WyActionEventType } from "../types/action.events";

import inputCss from "../scss/components/input.scss";
import paneCss from "../scss/components/pane.scss";
import scrollCss from "../scss/scroll.scss";
import hostContentsCss from "../scss/host-contents.scss";

import "./ui/wy-avatar";
import "./ui/wy-button";
import "./ui/wy-icon";
import "./ui/wy-dropdown";
import "./ui/wy-item";
import "./ui/wy-overlay";
import "./ui/wy-presence";
import "./ui/wy-titlebar";
import "./wy-upload";
import "./wy-users-search";

declare global {
  interface HTMLElementTagNameMap {
    "wy-conversation-header": WyConversationHeader;
  }
}

/**
 * Header section for a conversation. Displays title and optional conversation details with possibility to edit.
 * 
 * **Used sub components**
 *
 * - [`<wy-avatar>`](./ui/wy-avatar.ts)
 * - [`<wy-avatar-header>`](./ui/wy-avatar.ts)
 * - [`<wy-avatar-group>`](./ui/wy-avatar.ts)
 * - [`<wy-button>`](./ui/wy-button.ts)
 * - [`<wy-dropdown>`](./ui/wy-dropdown.ts)
 * - [`<wy-dropdown-item>`](./ui/wy-dropdown.ts)
 * - [`<wy-icon>`](./ui/wy-icon.ts)
 * - [`<wy-item>`](./ui/wy-item.ts)
 * - [`<wy-item-list>`](./ui/wy-item.ts)
 * - [`<wy-presence>`](./ui/wy-presence.ts)
 * - [`<wy-titlebar>`](./ui/wy-titlebar.ts)
 * - [`<wy-titlebar-text>`](./ui/wy-titlebar.ts)
 * - [`<wy-overlay>`](./ui/wy-overlay.ts)
 * - [`<wy-upload>`](./wy-upload.ts)
 * - [`<wy-users-search>`](./wy-users-search.ts)
 *
 * @slot icon - Icon or button to display in the beginning of the header.
 * 
 * @csspart wy-conversation-titlebar - The titlebar for the conversation.
 * @csspart wy-conversation-details - The conversation details overlay modal.
 * @csspart wy-conversation-add-members - The add members overlay modal.
 * @csspart wy-scroll-y - Scrollable content area inside the details overlay.
 * @csspart wy-pane-group - Grouping wrapper for room details fields.
 * @csspart wy-label - Labels for inputs in the details view.
 * @csspart wy-input - Inputs (room name) in the details view.
 * @csspart wy-description - Description/help text in the details view.
 * @csspart wy-conversation-details-add-members-button - Button for opening the add-members flow.
 *
 * @fires {WyActionEventType} wy-action - Emitted when the conversation is deselected/cleared.
 */
@customElement("wy-conversation-header")
@localized()
export class WyConversationHeader extends WeavySubComponent {
  static override styles = [inputCss, paneCss, scrollCss, hostContentsCss];

  /**
   * Controller for exporting named shadow parts.
   *
   * @internal
   */
  protected exportParts = new ShadowPartsController(this);

  /**
   * The id of the current conversation.
   *
   * Set this to load or target a specific conversation.
   */
  @property({ attribute: false })
  conversationId?: number;

  /**
   * Conversation data object for the current conversation.
   */
  @property({ attribute: false })
  conversation?: AppType;

  /**
   * Whether to show the details modal.
   *
   * @internal
   */
  @state()
  protected showDetails: boolean = false;

  /**
   * Whether to show the add members modal.
   *
   * @internal
   */
  @state()
  protected showAddMembers: boolean = false;

  /**
   * The title of the conversation.
   *
   * @internal
   */
  @state()
  protected conversationTitle: string = "";

  /**
   * State for the conversation title input.
   *
   * @internal
   */
  @state()
  protected conversationTitleInput: string = "";

  /** Checks whether the current or provided conversation is an agent chat. */
  protected isAgentChat(conversation?: AppType) {
    return (conversation ?? this.conversation)?.type === AppTypeGuid.AgentChat;
  }

  /** Checks whether the current or provided conversation is a chat room. */
  protected isChatRoom(conversation?: AppType) {
    return (conversation ?? this.conversation)?.type === AppTypeGuid.ChatRoom;
  }

  /** Checks whether the current or provided conversation is a private chat. */
  protected isPrivateChat(conversation?: AppType) {
    return (conversation ?? this.conversation)?.type === AppTypeGuid.PrivateChat;
  }

  /**
   * Query controller for loading members of the conversation.
   *
   * @internal
   */
  private membersQuery = new QueryController<MembersResultType>(this);

  /**
   * Mutation for adding members to a conversation.
   *
   * @internal
   */
  private addMembersMutation?: AddMembersToConversationMutationType;
  /**
   * Mutation for leaving a conversation.
   *
   * @internal
   */
  private leaveConversationMutation?: LeaveConversationMutationType;
  /**
   * Mutation for updating a member's access.
   *
   * @internal
   */
  private updateMemberMutation?: UpdateMemberMutationType;
  /**
   * Mutation for updating conversation properties (name/avatar).
   *
   * @internal
   */
  private updateConversationMutation?: UpdateConversationMutationType;

  /**
   * Handler invoked when an app update realtime event is received for the current conversation.
   *
   * Updates the local title state from the realtime payload.
   *
   * @internal
   */
  private handleRealtimeAppUpdated = (realtimeEvent: RealtimeAppEventType) => {
    if (!this.conversationId || realtimeEvent.app.id !== this.conversationId) {
      return;
    }

    this.conversationTitle = this.conversationTitleInput = realtimeEvent.app.name;
  };

  /**
   * Adds a list of members to the conversation.
   *
   * @internal
   */
  private async addMembers(members: MemberType[]) {
    this.showAddMembers = false;
    this.showDetails = true;

    if (!this.weavy || !this.conversationId) {
      return;
    }

    // add members
    await this.addMembersMutation?.mutate({ appId: this.conversationId, members: members.map((m) => m.id) });
    await this.membersQuery.result.refetch();

    await this.weavy.queryClient.invalidateQueries({ queryKey: ["apps"] });
  }

  /**
   * Handles saving the conversation name from the conversation name input.
   *
   * @internal
   */
  private async handleSaveConversationName() {
    if (!this.weavy || !this.conversationId) {
      return;
    }

    const name = this.conversationTitleInput.trim() === "" ? null : this.conversationTitleInput.trim();
    await this.updateConversationMutation?.mutate({ appId: this.conversationId, name });
  }

  /**
   * Updates the avatar with an uploaded blob picture.
   *
   * @internal
   */
  private async handleAvatarUploaded(blob: BlobType) {
    if (!this.weavy || !this.conversationId) {
      return;
    }
    await this.updateConversationMutation?.mutate({
      appId: this.conversationId,
      blobId: blob.id,
      thumbnailUrl: blob.thumbnail_url,
    });
  }

  /**
   * Clears the set avatar for the conversation.
   *
   * @internal
   */
  private async clearAvatar() {
    if (!this.weavy || !this.conversationId) {
      return;
    }
    await this.updateConversationMutation?.mutate({ appId: this.conversationId, blobId: null, thumbnailUrl: null });
  }

  /**
   * Updates the access for a member in the conversation.
   *
   * @internal
   */
  private async updateMember(id: number, access: AccessType) {
    if (!this.weavy || !this.conversationId) {
      return;
    }

    await this.updateMemberMutation?.mutate({
      appId: this.conversationId,
      userId: id,
      access,
    });

    await this.membersQuery.result.refetch();
  }

  /**
   * Removes the current or provided member from the conversation.
   *
   * If no memberId is provided, the current user leaves the conversation and the component state is cleared.
   *
   * @internal
   */
  private async leaveConversation(memberId?: number) {
    if (!this.weavy || !this.conversationId || !this.user) {
      return;
    }

    if (memberId) {
      await this.leaveConversationMutation?.mutate({
        appId: this.conversationId,
        members: [memberId],
      });
    }

    if (!memberId || memberId === this.user.id) {
      this.showDetails = false;
      this.conversation = undefined;
      this.conversationId = undefined;
      this.dispatchAction(ActionType.Select, null);
    } else {
      await this.membersQuery.result.refetch();
    }

    await this.weavy.queryClient.invalidateQueries({ queryKey: ["apps"] });
  }

  /**
   * Triggers `wy-action` event.
   *
   * @param action - The performed action.
   * @param conversation - The conversation to select or `null` to clear.
   * @returns Whether the event was successful.
   *
   * @internal
   */
  private dispatchAction(action: ActionType, conversation: AppType | null) {
    this.conversationId = conversation?.id;
    const event: WyActionEventType = new (CustomEvent as NamedEvent)("wy-action", { detail: { action, app: conversation }, bubbles: true, composed: true });
    return this.dispatchEvent(event);
  }

  /**
   * Updates member presence data from realtime presence events.
   *
   * @internal
   */
  private handlePresenceChange = (data: RealtimePresenceEventType) => {
    if (!this.weavy) {
      return;
    }
    
    // payload returns a single id as a string instead of number[]
    if (!Array.isArray(data)) {
      data = [parseInt(data)];
    }
    
    const updateMembersInApps = (members: MemberType[] = []) => {
      members.forEach((m) => {
        m.presence = data.indexOf(m.id) != -1 ? "active" : "away";
      });
      return members;
    };

    this.weavy.queryClient.setQueryData(["apps", this.conversationId], (app: AppType) => {
      app.members.data = updateMembersInApps(app.members.data);
      return app;
    });
    this.weavy.queryClient.setQueryData(["members", this.conversationId], (members: MemberType[]) => updateMembersInApps(members));
  };

  /**
   * Unsubscribe function for realtime subscriptions.
   *
   * @internal
   */
  #unsubscribeToRealtime?: () => void;

  protected override async willUpdate(changedProperties: PropertyValueMap<this>): Promise<void> {
    super.willUpdate(changedProperties);

    // if context updated
    if (changedProperties.has("weavy") && this.weavy) {
      this.leaveConversationMutation = getLeaveConversationMutation(this.weavy);
      this.addMembersMutation = getAddMembersToConversationMutation(this.weavy);
      this.updateConversationMutation = getUpdateConversationMutation(this.weavy);
      this.updateMemberMutation = getUpdateMemberMutation(this.weavy);
    }

    // ConversationId doesn't exist anymore
    if (changedProperties.has("conversationId")) {
      this.showDetails = false;
    }

    // conversationId is changed
    if ((changedProperties.has("weavy") || changedProperties.has("conversationId")) && this.weavy) {
      this.#unsubscribeToRealtime?.();

      if (this.conversationId) {
        await this.membersQuery.trackQuery(
          getMemberOptions(this.weavy, this.conversationId, {
            initialData: () => {
              // Use any data from the conversation query as the initial data for the member query
              if (this.conversationId) {
                return this.weavy?.queryClient.getQueryData<AppType>(["apps", this.conversationId])?.members;
              }
              return undefined;
            },
          })
        );

        const subscribeGroup = `a${this.conversationId}`;
        void this.weavy.subscribe(subscribeGroup, "app_updated", this.handleRealtimeAppUpdated);
        void this.weavy.subscribe(null, "online", this.handlePresenceChange);

        this.#unsubscribeToRealtime = () => {
          void this.weavy?.unsubscribe(subscribeGroup, "app_updated", this.handleRealtimeAppUpdated);
          void this.weavy?.unsubscribe(null, "online", this.handlePresenceChange);
          this.#unsubscribeToRealtime = undefined;
        };
      } else {
        this.membersQuery.untrackQuery();
      }
    }

    // conversation object is updated
    if (changedProperties.has("conversation") && this.conversation) {
      this.conversationTitleInput = this.conversationTitle = this.conversation.name;
    }
  }

  override render() {
    const { data: membersData } = this.membersQuery.result ?? {};

    const adminCount: number = (membersData?.data || []).filter((user) => user.access === AccessType.Admin).length;

    const otherMember =
      this.user && this.isPrivateChat()
        ? (this.conversation?.members?.data || []).filter((member) => member.id !== this.user?.id)?.[0] ?? this.user
        : null;

    return this.conversationId
      ? html`
          <wy-titlebar outer header floating part="wy-conversation-titlebar">
            <slot slot="icon" name="icon"><span></span></slot>
            ${this.conversation && this.user
              ? html`
                  ${this.conversation.type === AppTypeGuid.PrivateChat
                    ? html`<wy-presence
                        slot="title-section"
                        placement="text"
                        .status=${otherMember?.presence}
                        id=${ifDefined(otherMember?.id)}
                      ></wy-presence>`
                    : nothing}
                  <wy-titlebar-text slot="title-section">${this.conversationTitle}</wy-titlebar-text>
                `
              : nothing}
            ${this.isChatRoom()
              ? html`<wy-button
                  slot="actions"
                  kind="icon"
                  @click=${() => (this.showDetails = true)}
                  title="${msg("Details")}"
                >
                  <wy-icon name="information"></wy-icon>
                </wy-button>`
              : nothing}
          </wy-titlebar>

          <!-- details modal -->
          ${this.weavy
            ? html`
                <wy-overlay
                  part="wy-conversation-details"
                  .show=${this.showDetails}
                  @close=${() => {
                    this.showDetails = false;
                  }}
                >
                  <wy-titlebar header slot="header">
                    <wy-button
                      slot="icon"
                      kind="icon"
                      @click=${() => {
                        this.showDetails = false;
                      }}
                    >
                      <wy-icon name="close"></wy-icon>
                    </wy-button>
                    <span slot="title">${this.conversationTitle}</span>
                  </wy-titlebar>
                  <div part="wy-scroll-y">
                    ${this.showDetails && this.conversation && this.user
                      ? html`
                          <wy-avatar-header>
                            ${this.isChatRoom()
                              ? html`
                                  <wy-upload
                                    @blob-uploaded=${(e: BlobUploadedEventType) =>
                                      this.handleAvatarUploaded(e.detail.blob)}
                                    .accept=${"image/*"}
                                    .label=${msg("Select picture")}
                                  >
                                    <div slot="placeholder">
                                      ${this.conversation.avatar_url
                                        ? html`<wy-avatar .size=${96} src=${this.conversation.avatar_url}></wy-avatar>`
                                        : html`<wy-avatar-group
                                            .members=${membersData?.data}
                                            title=${this.conversation.name}
                                            .size=${96}
                                          ></wy-avatar-group>`}
                                    </div>
                                    ${this.conversation.avatar_url
                                      ? html`<div slot="action"
                                          ><wy-button @click=${() => this.clearAvatar()}
                                            >${msg("Remove picture")}</wy-button
                                          ></div
                                        >`
                                      : nothing}
                                  </wy-upload>
                                `
                              : html`
                                  <wy-avatar
                                    src=${ifDefined(otherMember?.avatar_url)}
                                    name=${ifDefined(otherMember?.name)}
                                    presence=${otherMember?.presence || "away"}
                                    ?isAgent=${otherMember?.is_agent}
                                    id=${ifDefined(otherMember?.id)}
                                    size=${96}
                                  ></wy-avatar>
                                `}
                          </wy-avatar-header>
                          ${this.isChatRoom()
                            ? html`
                                <div part="wy-pane-group">
                                  <label part="wy-label" for="roomName">${msg("Room name")}</label>

                                  <input
                                    id="roomName"
                                    part="wy-input"
                                    .value=${this.conversationTitleInput}
                                    @input=${(e: Event) => {
                                      this.conversationTitleInput = (e.target as HTMLInputElement).value;
                                    }}
                                    @keyup=${inputBlurOnEnter}
                                    @blur=${() => this.handleSaveConversationName()}
                                  />

                                  <div part="wy-description">
                                    ${msg("Changing the name of a group chat changes it for everyone.")}
                                  </div>
                                  <br />
                                  <label part="wy-label">${msg("Members")}</label>
                                  ${membersData
                                    ? html`
                                        <wy-item-list>
                                          ${membersData.data?.map(
                                            (member: MemberType) => html`
                                              <wy-item>
                                                <wy-avatar
                                                  slot="image"
                                                  .src=${member.avatar_url}
                                                  .name=${member.name}
                                                  .description=${member.comment}
                                                  .isAgent=${member.is_agent}
                                                  size=${32}
                                                ></wy-avatar>
                                                <span slot="title">
                                                  ${member.name}
                                                  ${member.access === AccessType.Admin
                                                    ? html` <wy-icon
                                                        size="20"
                                                        inline
                                                        name="shield-star"
                                                        title=${msg("Admin")}
                                                      ></wy-icon>`
                                                    : nothing}
                                                </span>
                                                ${this.user &&
                                                this.user.id === member.id &&
                                                !hasPermission(PermissionType.Admin, this.conversation?.permissions)
                                                  ? html` <wy-button
                                                      slot="actions"
                                                      @click=${() => this.leaveConversation(member.id)}
                                                      title=${msg("Leave conversation")}
                                                      kind="icon"
                                                    >
                                                      <wy-icon name="close"></wy-icon>
                                                    </wy-button>`
                                                  : hasPermission(PermissionType.Admin, this.conversation?.permissions)
                                                  ? html`<wy-dropdown slot="actions">
                                                      <wy-dropdown-item
                                                        @click=${() => this.leaveConversation(member.id)}
                                                      >
                                                        <wy-icon name="account-minus"></wy-icon>
                                                        ${this.user && this.user.id === member.id
                                                          ? msg("Leave conversation")
                                                          : msg("Remove member")}
                                                      </wy-dropdown-item>
                                                      ${adminCount > 1 && member.access === AccessType.Admin
                                                        ? html`<wy-dropdown-item
                                                            @click=${() =>
                                                              this.updateMember(member.id, AccessType.Write)}
                                                          >
                                                            <wy-icon name="shield-star-outline"></wy-icon>
                                                            ${msg("Remove as admin")}
                                                          </wy-dropdown-item>`
                                                        : member.access !== AccessType.Admin
                                                        ? html`<wy-dropdown-item
                                                            @click=${() =>
                                                              this.updateMember(member.id, AccessType.Admin)}
                                                          >
                                                            <wy-icon name="shield-star"></wy-icon>
                                                            ${msg("Make admin")}
                                                          </wy-dropdown-item>`
                                                        : nothing}
                                                    </wy-dropdown>`
                                                  : nothing}
                                              </wy-item>
                                            `
                                          ) ?? nothing}
                                        </wy-item-list>
                                      `
                                    : nothing}
                                  <div>
                                    <wy-button
                                      part="wy-conversation-details-add-members-button"
                                      kind="filled"
                                      color="primary"
                                      @click=${() => {
                                        this.showDetails = false;
                                        this.showAddMembers = true;
                                      }}
                                      title=${msg("Add members")}
                                    >
                                      ${msg("Add members")}
                                    </wy-button>
                                  </div>
                                </div>
                              `
                            : nothing}
                        `
                      : nothing}
                  </div>
                </wy-overlay>
              `
            : nothing}

          <!-- add members modal -->
          ${this.weavy
            ? html`
                <wy-overlay
                  part="wy-conversation-add-members"
                  .show=${this.showAddMembers}
                  @close=${() => {
                    this.showAddMembers = false;
                  }}
                >
                  <wy-titlebar header>
                    <wy-button
                      slot="icon"
                      kind="icon"
                      @click=${() => {
                        this.showAddMembers = false;
                      }}
                    >
                      <wy-icon name="close"></wy-icon>
                    </wy-button>
                    <span slot="title">${msg("Add members")}</span>
                  </wy-titlebar>
                  ${this.showAddMembers
                    ? html`
                        <wy-users-search
                          .buttonTitle=${msg("Add members")}
                          .appId=${this.conversationId}
                          @submit=${(e: MemberSearchSubmitEventType) => this.addMembers(e.detail.members)}
                        ></wy-users-search>
                      `
                    : nothing}
                </wy-overlay>
              `
            : nothing}
        `
      : nothing;
  }

  override disconnectedCallback(): void {
    this.#unsubscribeToRealtime?.();
    super.disconnectedCallback();
  }
}
