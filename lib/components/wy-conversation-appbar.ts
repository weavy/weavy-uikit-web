import { LitElement, html, type PropertyValues, nothing, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { portal } from "lit-modal-portal";
import { ConversationTypeGuid, type ConversationType } from "../types/conversations.types";

import { AppConsumerMixin } from "../mixins/app-consumer-mixin";
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
import type { RealtimeAppEventType } from "../types/realtime.types";
import { WeavyContextProps } from "../types/weavy.types";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";

import chatCss from "../scss/all";

import "./wy-typing";
import "./wy-presence";
import "./wy-users-search";
import "./wy-overlay";
import "./wy-dropdown";
import "./wy-blob-upload";
import { BlobType } from "../types/files.types";
import { AccessType, PermissionType } from "../types/app.types";
import { hasPermission } from "../utils/permission";

@customElement("wy-conversation-appbar")
@localized()
export default class WyConversationAppbar extends AppConsumerMixin(LitElement) {
  static override styles = [
    chatCss,
    css`
      :host {
        display: contents;
      }
    `,
  ];

  protected exportParts = new ShadowPartsController(this);

  @property({ attribute: false })
  conversationId?: number;

  @property({ attribute: false })
  conversation?: ConversationType;

  @property({ type: Boolean })
  showDetails: boolean = false;

  @property({ type: Boolean })
  showAddMembers: boolean = false;

  @property({ type: String })
  conversationTitle: string = "";

  @state()
  protected conversationTitleInput: string = "";

  /**
   * A keyboard-consuming element releases focus.
   * @event release-focus
   */
  private releaseFocusEvent = () => new CustomEvent<undefined>("release-focus", { bubbles: true, composed: true });

  protected isBotChat(conversation?: ConversationType) {
    return (conversation ?? this.conversation)?.type === ConversationTypeGuid.BotChat;
  }

  protected isChatRoom(conversation?: ConversationType) {
    return (conversation ?? this.conversation)?.type === ConversationTypeGuid.ChatRoom;
  }

  protected isPrivateChat(conversation?: ConversationType) {
    return (conversation ?? this.conversation)?.type === ConversationTypeGuid.PrivateChat;
  }

  private membersQuery = new QueryController<MembersResultType>(this);

  private addMembersMutation?: AddMembersToConversationMutationType;
  private leaveConversationMutation?: LeaveConversationMutationType;
  private updateMemberMutation?: UpdateMemberMutationType;
  private updateConversationMutation?: UpdateConversationMutationType;

  private handleRealtimeAppUpdated = (realtimeEvent: RealtimeAppEventType) => {
    if (!this.conversationId || realtimeEvent.app.id !== this.conversationId) {
      return;
    }

    this.conversationTitle = this.conversationTitleInput = realtimeEvent.app.display_name;
  };

  private unsubscribeToRealtime(conversationId: number) {
    if (!this.weavyContext) {
      return;
    }

    this.weavyContext.unsubscribe(`a${conversationId}`, "app_updated", this.handleRealtimeAppUpdated);
  }

  private async addMembers(members: MemberType[]) {
    this.showAddMembers = false;
    this.showDetails = true;

    if (!this.weavyContext || !this.conversationId) {
      return;
    }

    // add members
    await this.addMembersMutation?.mutate({ id: this.conversationId, members: members.map((m) => m.id) });
    await this.membersQuery.result.refetch();

    await this.weavyContext.queryClient.invalidateQueries({ queryKey: ["conversations"] });
  }

  private async handleSaveConversationName() {
    if (!this.weavyContext || !this.conversationId) {
      return;
    }

    const name = this.conversationTitleInput.trim() === "" ? null : this.conversationTitleInput.trim();
    await this.updateConversationMutation?.mutate({ id: this.conversationId, name });
  }

  private async handleAvatarUploaded(blob: BlobType) {
    if (!this.weavyContext || !this.conversationId) {
      return;
    }
    await this.updateConversationMutation?.mutate({
      id: this.conversationId,
      blobId: blob.id,
      thumbnailUrl: blob.thumbnail_url,
    });
  }

  private async clearAvatar() {
    if (!this.weavyContext || !this.conversationId) {
      return;
    }
    await this.updateConversationMutation?.mutate({ id: this.conversationId, blobId: null, thumbnailUrl: null });
  }

  private async updateMember(id: number, access: AccessType) {
    if (!this.weavyContext || !this.conversationId) {
      return;
    }

    await this.updateMemberMutation?.mutate({
      id: this.conversationId,
      userId: id,
      access,
    });

    await this.membersQuery.result.refetch();
  }

  private async leaveConversation(memberId?: number) {
    if (!this.weavyContext || !this.conversationId || !this.user) {
      return;
    }

    await this.leaveConversationMutation?.mutate({
      id: this.conversationId,
      members: [memberId!],
    });

    if (!memberId) {
      this.showDetails = false;
      this.conversation = undefined;
      this.conversationId = undefined;
    } else {
      await this.membersQuery.result.refetch();
    }

    await this.weavyContext.queryClient.invalidateQueries({ queryKey: ["conversations"] });
  }

  protected override willUpdate(changedProperties: PropertyValues<this & WeavyContextProps>) {
    super.willUpdate(changedProperties);

    // if context updated
    if (changedProperties.has("weavyContext") && this.weavyContext) {
      this.leaveConversationMutation = getLeaveConversationMutation(this.weavyContext);
      this.addMembersMutation = getAddMembersToConversationMutation(this.weavyContext);
      this.updateConversationMutation = getUpdateConversationMutation(this.weavyContext);
      this.updateMemberMutation = getUpdateMemberMutation(this.weavyContext);
    }

    // ConversationId doesn't exist anymore
    if (changedProperties.has("conversationId")) {
      this.showDetails = false;
      const lastConversationId = changedProperties.get("conversationId");

      // conversation id is changed
      if (lastConversationId && this.conversation && lastConversationId !== this.conversationId) {
        this.unsubscribeToRealtime(lastConversationId);
      }
    }

    // conversationId is changed
    if ((changedProperties.has("weavyContext") || changedProperties.has("conversationId")) && this.weavyContext) {
      if (this.conversationId) {
        this.membersQuery.trackQuery(
          getMemberOptions(this.weavyContext, this.conversationId, {
            initialData: () => {
              // Use any data from the conversation query as the initial data for the member query
              if (this.conversationId) {
                return this.weavyContext?.queryClient.getQueryData<ConversationType>([
                  "conversations",
                  this.conversationId,
                ])?.members;
              }
              return undefined;
            },
          })
        );
        this.weavyContext.subscribe(`a${this.conversationId}`, "app_updated", this.handleRealtimeAppUpdated);
      } else {
        this.membersQuery.untrackQuery();
      }
    }

    // conversation object is updated
    if (changedProperties.has("conversation") && this.conversation) {
      this.conversationTitleInput = this.conversationTitle = this.conversation.display_name;
    }
  }

  override render() {
    const { data: membersData } = this.membersQuery.result ?? {};

    const adminCount: number = (membersData?.data || []).filter((user) => user.access === AccessType.Admin).length;

    const otherMember =
      this.user && this.isPrivateChat()
        ? (this.conversation?.members?.data || []).filter((member) => member.id !== this.user?.id)?.[0] ?? this.user
        : null;

    return html`
      <header class="wy-appbars">
        <nav class="wy-appbar">
          <div><slot name="action"></slot></div>
          ${this.conversation && this.user
            ? html`
                <wy-typing appId=${this.conversation?.id} userId=${this.user.id}>
                  ${this.conversation.type === ConversationTypeGuid.PrivateChat
                    ? html`<wy-presence
                        placement="text"
                        .status=${otherMember?.presence}
                        id=${ifDefined(otherMember?.id)}
                      ></wy-presence>`
                    : nothing}
                  <span class="wy-appbar-text">${this.conversationTitle}</span>
                </wy-typing>
              `
            : html`<span></span>`}
          ${this.isChatRoom()
            ? html`<wy-button kind="icon" @click=${() => (this.showDetails = true)} title="${msg("Details")}">
                <wy-icon name="information"></wy-icon>
              </wy-button>`
            : nothing}
        </nav>
      </header>

      <!-- details modal -->
      ${this.weavyContext && this.settings
        ? portal(
            this.showDetails
              ? html`
                  <wy-overlay
                    .contexts=${this.contexts}
                    @close=${() => {
                      this.showDetails = false;
                    }}
                    @release-focus=${() => this.dispatchEvent(this.releaseFocusEvent())}
                  >
                    <header class="wy-appbars">
                      <nav class="wy-appbar">
                        <wy-button
                          kind="icon"
                          @click=${() => {
                            this.showDetails = false;
                          }}
                        >
                          <wy-icon name="close"></wy-icon>
                        </wy-button>
                        <div class="wy-appbar-text">${this.conversationTitle}</div>
                      </nav>
                    </header>
                    <div class="wy-scroll-y">
                      ${this.conversation && this.user
                        ? html`
                            <wy-avatar-header>
                              ${this.isChatRoom()
                                ? html`
                                    <wy-blob-upload
                                      @blob-uploaded=${(e: CustomEvent) => this.handleAvatarUploaded(e.detail.blob)}
                                      .accept=${"image/*"}
                                      .label=${msg("Select picture")}
                                    >
                                      <div slot="placeholder">
                                        ${this.conversation.avatar_url
                                          ? html`<wy-avatar
                                              .size=${96}
                                              src=${this.conversation.avatar_url}
                                            ></wy-avatar>`
                                          : html`<wy-avatar-group
                                              .members=${membersData}
                                              title=${this.conversation.display_name}
                                              .size=${96}
                                            ></wy-avatar-group>`}
                                      </div>
                                      ${this.conversation.avatar_url
                                        ? html`<div slot="label"
                                            ><wy-button @click=${() => this.clearAvatar()}
                                              >${msg("Remove picture")}</wy-button
                                            ></div
                                          >`
                                        : nothing}
                                    </wy-blob-upload>
                                  `
                                : html`
                                    <wy-avatar
                                      src=${ifDefined(otherMember?.avatar_url)}
                                      name=${ifDefined(otherMember?.display_name)}
                                      presence=${otherMember?.presence || "away"}
                                      ?isBot=${otherMember?.is_bot}
                                      id=${ifDefined(otherMember?.id)}
                                      size=${96}
                                    ></wy-avatar>
                                  `}
                            </wy-avatar-header>
                            ${this.isChatRoom()
                              ? html`
                                  <div class="wy-pane-group">
                                    <label class="wy-label" for="roomName">${msg("Room name")}</label>

                                    <input
                                      id="roomName"
                                      class="wy-input"
                                      .value=${this.conversationTitleInput}
                                      @input=${(e: Event) => {
                                        this.conversationTitleInput = (e.target as HTMLInputElement).value;
                                      }}
                                      @keyup=${inputBlurOnEnter}
                                      @blur=${() => this.handleSaveConversationName()}
                                    />

                                    <div class="wy-description">
                                      ${msg("Changing the name of a group chat changes it for everyone.")}
                                    </div>
                                    <br />
                                    <label class="wy-label">${msg("Members")}</label>
                                    ${membersData
                                      ? html`
                                          <div class="wy-list">
                                            ${membersData.data?.map(
                                              (member: MemberType) => html`
                                                <div class="wy-item">
                                                  <wy-avatar
                                                    .src=${member.avatar_url}
                                                    .name=${member.display_name}
                                                    .isBot=${member.is_bot}
                                                    size=${32}
                                                  ></wy-avatar>
                                                  <div class="wy-item-body">
                                                    ${member.display_name}
                                                    ${member.access === AccessType.Admin
                                                      ? html` <wy-icon
                                                          size="20"
                                                          inline
                                                          name="shield-star"
                                                          title=${msg("Admin")}
                                                        ></wy-icon>`
                                                      : nothing}
                                                  </div>
                                                  ${member.id === this.user!.id &&
                                                  !hasPermission(PermissionType.Admin, this.conversation?.permissions)
                                                    ? html` <wy-button
                                                        @click=${() => this.leaveConversation(member.id)}
                                                        title=${msg("Leave conversation")}
                                                        kind="icon"
                                                      >
                                                        <wy-icon name="close"></wy-icon>
                                                      </wy-button>`
                                                    : hasPermission(
                                                        PermissionType.Admin,
                                                        this.conversation?.permissions
                                                      )
                                                    ? html`<wy-dropdown>
                                                        <wy-dropdown-item
                                                          @click=${() => this.leaveConversation(member.id)}
                                                        >
                                                          <wy-icon name="account-minus"></wy-icon>
                                                          ${member.id === this.user!.id
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
                                                </div>
                                              `
                                            ) ?? nothing}
                                          </div>
                                        `
                                      : nothing}
                                    <wy-button
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
                                `
                              : nothing}
                          `
                        : nothing}
                    </div>
                  </wy-overlay>
                `
              : nothing,
            this.settings.submodals || this.weavyContext.modalRoot === undefined
              ? this.settings.component.renderRoot
              : this.weavyContext.modalRoot
          )
        : nothing}

      <!-- add members modal -->
      ${this.weavyContext && this.settings
        ? portal(
            this.showAddMembers
              ? html`
                  <wy-overlay
                    .contexts=${this.contexts}
                    @close=${() => (this.showAddMembers = false)}
                    @release-focus=${() => this.dispatchEvent(this.releaseFocusEvent())}
                  >
                    <header class="wy-appbars">
                      <nav class="wy-appbar">
                        <wy-button kind="icon" @click=${() => (this.showAddMembers = false)}>
                          <wy-icon name="close"></wy-icon>
                        </wy-button>
                        <div class="wy-appbar-text">${msg("Add members")}</div>
                      </nav>
                    </header>

                    <wy-users-search
                      .buttonTitle=${msg("Add members")}
                      .appId=${this.conversationId}
                      @submit=${(e: CustomEvent) => this.addMembers(e.detail.members)}
                    ></wy-users-search>
                  </wy-overlay>
                `
              : nothing,
            this.settings.submodals || this.weavyContext.modalRoot === undefined
              ? this.settings.component.renderRoot
              : this.weavyContext.modalRoot
          )
        : nothing}
    `;
  }

  override disconnectedCallback(): void {
    if (this.weavyContext && this.conversationId) {
      this.unsubscribeToRealtime(this.conversationId);
    }
    super.disconnectedCallback();
  }
}
