import { LitElement, html, type PropertyValues, nothing, css } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { WeavyComponentConsumerMixin } from "../classes/weavy-component-consumer-mixin";
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
import { WeavyProps } from "../types/weavy.types";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { BlobType } from "../types/files.types";
import { type AppType, AppTypeGuid, AccessType, PermissionType } from "../types/app.types";
import { hasPermission } from "../utils/permission";

import chatCss from "../scss/all.scss";

import "./wy-presence";
import "./wy-users-search";
import "./wy-dropdown";
import "./wy-blob-upload";
import "./wy-overlay";

@customElement("wy-conversation-appbar")
@localized()
export default class WyConversationAppbar extends WeavyComponentConsumerMixin(LitElement) {
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
  conversation?: AppType;

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

  protected isBotChat(conversation?: AppType) {
    return (conversation ?? this.conversation)?.type === AppTypeGuid.BotChat;
  }

  protected isChatRoom(conversation?: AppType) {
    return (conversation ?? this.conversation)?.type === AppTypeGuid.ChatRoom;
  }

  protected isPrivateChat(conversation?: AppType) {
    return (conversation ?? this.conversation)?.type === AppTypeGuid.PrivateChat;
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

  private async handleSaveConversationName() {
    if (!this.weavy || !this.conversationId) {
      return;
    }

    const name = this.conversationTitleInput.trim() === "" ? null : this.conversationTitleInput.trim();
    await this.updateConversationMutation?.mutate({ appId: this.conversationId, name });
  }

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

  private async clearAvatar() {
    if (!this.weavy || !this.conversationId) {
      return;
    }
    await this.updateConversationMutation?.mutate({ appId: this.conversationId, blobId: null, thumbnailUrl: null });
  }

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

    if (!memberId) {
      this.showDetails = false;
      this.conversation = undefined;
      this.conversationId = undefined;
    } else {
      await this.membersQuery.result.refetch();
    }

    await this.weavy.queryClient.invalidateQueries({ queryKey: ["apps"] });
  }

  private handlePresenceChange = (data: RealtimePresenceEventType) => {
    if (!this.weavy) {
      return;
    }

    // payload returns a single id as a string instead of number[]
    if (!Array.isArray(data)) {
      data = [parseInt(data)];
    }

    const updateMembersInApps = (app: AppType) => {
      const members = app.members.data ?? [];
      members.forEach((m) => {
        m.presence = (data as number[]).indexOf(m.id) != -1 ? "active" : "away";
      });
      app.members.data = members;
      return app;
    };

    this.weavy.queryClient.setQueryData(["apps", this.conversationId], updateMembersInApps);
  };

  #unsubscribeToRealtime?: () => void;

  protected override willUpdate(changedProperties: PropertyValues<this & WeavyProps>) {
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
        this.membersQuery.trackQuery(
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
        this.weavy.subscribe(subscribeGroup, "app_updated", this.handleRealtimeAppUpdated);
        this.weavy.subscribe(null, "online", this.handlePresenceChange);

        this.#unsubscribeToRealtime = () => {
          this.weavy?.unsubscribe(subscribeGroup, "app_updated", this.handleRealtimeAppUpdated);
          this.weavy?.unsubscribe(null, "online", this.handlePresenceChange);
          this.#unsubscribeToRealtime = undefined;
        };
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
          <slot class="wy-appbar-buttons wy-appbar-buttons-first" name="action"></slot>
          ${this.conversation && this.user
            ? html`
                <div class="wy-appbar-section">
                  ${this.conversation.type === AppTypeGuid.PrivateChat
                    ? html`<wy-presence
                        placement="text"
                        .status=${otherMember?.presence}
                        id=${ifDefined(otherMember?.id)}
                      ></wy-presence>`
                    : nothing}
                  <span class="wy-appbar-text">${this.conversationTitle}</span>
                </div>
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
      ${this.weavy
        ? html`
            <wy-overlay
              .show=${this.showDetails}
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
                ${this.showDetails && this.conversation && this.user
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
                                    ? html`<wy-avatar .size=${96} src=${this.conversation.avatar_url}></wy-avatar>`
                                    : html`<wy-avatar-group
                                        .members=${membersData?.data}
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
                                          <div class="wy-item wy-list-item">
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
                                            ${this.user &&
                                            this.user.id === member.id &&
                                            !hasPermission(PermissionType.Admin, this.conversation?.permissions)
                                              ? html` <wy-button
                                                  @click=${() => this.leaveConversation(member.id)}
                                                  title=${msg("Leave conversation")}
                                                  kind="icon"
                                                >
                                                  <wy-icon name="close"></wy-icon>
                                                </wy-button>`
                                              : hasPermission(PermissionType.Admin, this.conversation?.permissions)
                                              ? html`<wy-dropdown>
                                                  <wy-dropdown-item @click=${() => this.leaveConversation(member.id)}>
                                                    <wy-icon name="account-minus"></wy-icon>
                                                    ${this.user && this.user.id === member.id
                                                      ? msg("Leave conversation")
                                                      : msg("Remove member")}
                                                  </wy-dropdown-item>
                                                  ${adminCount > 1 && member.access === AccessType.Admin
                                                    ? html`<wy-dropdown-item
                                                        @click=${() => this.updateMember(member.id, AccessType.Write)}
                                                      >
                                                        <wy-icon name="shield-star-outline"></wy-icon>
                                                        ${msg("Remove as admin")}
                                                      </wy-dropdown-item>`
                                                    : member.access !== AccessType.Admin
                                                    ? html`<wy-dropdown-item
                                                        @click=${() => this.updateMember(member.id, AccessType.Admin)}
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
        : nothing}

      <!-- add members modal -->
      ${this.weavy
        ? html`
            <wy-overlay
              .show=${this.showAddMembers}
              @close=${() => {
                this.showAddMembers = false;
              }}
              @release-focus=${() => this.dispatchEvent(this.releaseFocusEvent())}
            >
              <header class="wy-appbars">
                <nav class="wy-appbar">
                  <wy-button
                    kind="icon"
                    @click=${() => {
                      this.showAddMembers = false;
                    }}
                  >
                    <wy-icon name="close"></wy-icon>
                  </wy-button>
                  <div class="wy-appbar-text">${msg("Add members")}</div>
                </nav>
              </header>
              ${this.showAddMembers
                ? html`
                    <wy-users-search
                      .buttonTitle=${msg("Add members")}
                      .appId=${this.conversationId}
                      @submit=${(e: CustomEvent) => this.addMembers(e.detail.members)}
                    ></wy-users-search>
                  `
                : nothing}
            </wy-overlay>
          `
        : nothing}
    `;
  }

  override disconnectedCallback(): void {
    this.#unsubscribeToRealtime?.();
    super.disconnectedCallback();
  }
}
