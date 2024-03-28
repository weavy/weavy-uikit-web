import { LitElement, html, type PropertyValues, nothing, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { ContextConsumer } from "@lit/context";
import { type WeavyContextType, weavyContextDefinition } from "../client/context-definition";
import { portal } from "lit-modal-portal";
import { ConversationTypeGuid, type ConversationType } from "../types/conversations.types";

import type { UserType } from "../types/users.types";
import type { MemberType, MembersResultType } from "../types/members.types";

import { getApiOptions } from "../data/api";
import { getMemberOptions } from "../data/members";
import { QueryController } from "../controllers/query-controller";

import { localized, msg } from "@lit/localize";
import {
  AddMembersToConversationMutationType,
  LeaveConversationMutationType,
  UpdateConversationMutationType,
  getAddMembersToConversationMutation,
  getLeaveConversationMutation,
  getUpdateConversationMutation,
} from "../data/conversation";
import { ifDefined } from "lit/directives/if-defined.js";
import { inputConsumeWithBlurOnEscape } from "../utils/keyboard";
import type { RealtimeAppEventType } from "../types/realtime.types";
import { whenParentsDefined } from "../utils/dom";
import { WeavyContextProps } from "../types/weavy.types";

import chatCss from "../scss/all";

import "./wy-typing";
import "./wy-presence";
import "./wy-users-search";
import "./wy-overlay";
import "./wy-dropdown";

@customElement("wy-conversation-appbar")
@localized()
export default class WyConversationAppbar extends LitElement {
  static override styles = [
    chatCss,
    css`
      :host {
        display: contents;
      }
    `,
  ];

  protected weavyContextConsumer?: ContextConsumer<{ __context__: WeavyContextType }, this>;

  // Manually consumed in scheduleUpdate()
  @state()
  protected weavyContext?: WeavyContextType;

  @property({ attribute: false })
  user?: UserType;

  @property({ attribute: false })
  conversationId?: number;

  @property({ attribute: false })
  conversation?: ConversationType;

  @property({ type: Boolean })
  showAddMembers: boolean = false;

  @property({ type: Boolean })
  showDetails: boolean = false;

  @property({ type: String })
  conversationTitle: string = "";

  @state()
  protected conversationTitleInput: string = "";

  /**
   * A keyboard-consuming element releases focus.
   * @event release-focus
   */
  private releaseFocusEvent = () => new CustomEvent<undefined>("release-focus", { bubbles: true, composed: true });

  protected isPrivateChat(conversation?: ConversationType) {
    return (conversation ?? this.conversation)?.type === ConversationTypeGuid.PrivateChat;
  }

  protected isChatRoom(conversation?: ConversationType) {
    return (conversation ?? this.conversation)?.type === ConversationTypeGuid.ChatRoom;
  }

  private membersQuery = new QueryController<MembersResultType>(this);
  private userQuery = new QueryController<UserType>(this);

  private addMembersMutation?: AddMembersToConversationMutationType;
  private leaveConversationMutation?: LeaveConversationMutationType;
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

    if (!this.weavyContext || !this.conversationId) {
      return;
    }

    // add members
    await this.addMembersMutation?.mutate({ id: this.conversationId, members: members.map((m) => m.id) });
    await this.membersQuery.result.refetch();

    await this.weavyContext.queryClient.invalidateQueries({ queryKey: ["conversations"] });
  }

  private async handleSaveConversationName() {
    if (!this.conversationId) {
      return;
    }
    const name = this.conversationTitleInput.trim() === "" ? null : this.conversationTitleInput.trim();
    await this.updateConversationMutation?.mutate({ id: this.conversationId, name });

    //this.conversationTitle = conversation?.display_name || "";
  }

  private async leaveConversation(memberId?: number) {
    if (!this.weavyContext || !this.conversationId || !this.user) {
      return;
    }

    await this.leaveConversationMutation?.mutate({
      id: this.conversationId,
      members: [memberId || this.user.id],
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

  override async scheduleUpdate() {
    await whenParentsDefined(this);
    this.weavyContextConsumer = new ContextConsumer(this, { context: weavyContextDefinition, subscribe: true });

    if (this.weavyContextConsumer?.value && this.weavyContext !== this.weavyContextConsumer?.value) {
      this.weavyContext = this.weavyContextConsumer?.value;
    }

    await super.scheduleUpdate();
  }

  protected override willUpdate(changedProperties: PropertyValues<this & WeavyContextProps>) {
    // if context updated
    if (changedProperties.has("weavyContext") && this.weavyContext) {
      this.userQuery.trackQuery(getApiOptions<UserType>(this.weavyContext, ["user"]));

      this.leaveConversationMutation = getLeaveConversationMutation(this.weavyContext);
      this.addMembersMutation = getAddMembersToConversationMutation(this.weavyContext);
      this.updateConversationMutation = getUpdateConversationMutation(this.weavyContext);
    }

    // ConversationId doesn't exist anymore
    if (changedProperties.has("conversationId")) {
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

    if (!this.userQuery.result?.isPending) {
      this.user = this.userQuery.result?.data;
    }

    // conversation object is updated
    if (changedProperties.has("conversation") && this.conversation) {
      this.conversationTitleInput = this.conversationTitle = this.conversation.display_name;
    }
  }

  override render() {
    const { data: membersData } = this.membersQuery.result ?? {};

    const otherMember =
      this.user && this.isPrivateChat()
        ? (this.conversation?.members?.data || []).filter((member) => member.id !== this.user?.id)?.[0]
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
          ${this.isChatRoom() || this.isPrivateChat()
            ? html`
                <wy-dropdown>
                  <wy-dropdown-item @click=${() => (this.showDetails = true)}>
                    <wy-icon name="information"></wy-icon>
                    ${msg("Details")}
                  </wy-dropdown-item>
                  ${this.isChatRoom()
                    ? html`
                        <wy-dropdown-item @click=${() => (this.showAddMembers = true)}>
                          <wy-icon name="account-plus"></wy-icon> ${msg("Add members")}
                        </wy-dropdown-item>
                        <wy-dropdown-item @click=${() => this.leaveConversation()}>
                          <wy-icon name="account-minus"></wy-icon> ${msg("Leave conversation")}
                        </wy-dropdown-item>
                      `
                    : nothing}
                </wy-dropdown>
              `
            : nothing}
        </nav>
      </header>

      <!-- add members modal -->
      ${portal(
        this.showAddMembers,
        html`
          <wy-overlay @release-focus=${() => this.dispatchEvent(this.releaseFocusEvent())}>
            <header class="wy-appbars">
              <nav class="wy-appbar">
                <wy-button kind="icon" @click=${() => (this.showAddMembers = false)}>
                  <wy-icon name="close"></wy-icon>
                </wy-button>
                <div class="wy-appbar-text">${msg("Add members")}</div>
              </nav>
            </header>

            <wy-users-search
              .buttonTitle=${msg("Add")}
              .existingMembers=${membersData}
              @submit=${(e: CustomEvent) => this.addMembers(e.detail.members)}
            ></wy-users-search>
          </wy-overlay>
        `,
        () => (this.showAddMembers = false)
      )}

      <!-- details modal -->
      ${portal(
        this.showDetails,
        html`
          <wy-overlay @release-focus=${() => this.dispatchEvent(this.releaseFocusEvent())}>
            <header class="wy-appbars">
              <nav class="wy-appbar">
                <wy-button kind="icon" @click=${() => (this.showDetails = false)}>
                  <wy-icon name="close"></wy-icon>
                </wy-button>
                <div class="wy-appbar-text">${msg("Details")}</div>
              </nav>
            </header>
            <div class="wy-scroll-y">
              ${this.conversation && this.user
                ? html`
                    <div class="wy-avatar-header">
                      ${this.isChatRoom() && !this.conversation.avatar_url
                        ? html`
                            <wy-avatar-group
                              .members=${membersData}
                              .user=${this.user}
                              .name=${this.conversation.display_name}
                              .size=${96}
                            ></wy-avatar-group>
                          `
                        : this.conversation.display_name || this.conversation.avatar_url
                        ? html`
                            <wy-avatar
                              src=${ifDefined(otherMember?.avatar_url)}
                              name=${this.conversation.display_name}
                              size=${96}
                            ></wy-avatar>
                          `
                        : nothing}
                      ${this.conversationTitle ? html` <h3 class="wy-title">${this.conversationTitle}</h3> ` : nothing}
                    </div>
                    ${this.isChatRoom()
                      ? html`
                          <div class="wy-pane-group">
                            <label class="wy-input-label">${msg("Conversation name")}</label>
                            <div class="wy-input-group">
                              <input
                                class="wy-input"
                                .value=${this.conversationTitleInput}
                                @input=${(e: Event) => {
                                  this.conversationTitleInput = (e.target as HTMLInputElement).value;
                                }}
                                @keyup=${inputConsumeWithBlurOnEscape}
                              />
                              <wy-button
                                kind="icon"
                                class="wy-input-group-button-icon"
                                buttonClass="wy-input-group-button-icon wy-button-primary"
                                @click=${() => this.handleSaveConversationName()}
                              >
                                <wy-icon name="check"></wy-icon>
                              </wy-button>
                            </div>
                            <div class="wy-description">
                              ${msg("Changing the name of a group chat changes it for everyone.")}
                            </div>
                          </div>
                          <div class="wy-pane-group">
                            <label class="wy-input-label">${msg("Members")}</label>
                            ${membersData
                              ? html`
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
                                          ${this.conversation!.created_by_id === member.id
                                            ? html` <wy-icon
                                                size="20"
                                                inline
                                                name="shield-star"
                                                title=${msg("Admin")}
                                              ></wy-icon>`
                                            : nothing}
                                        </div>

                                        ${this.conversation!.created_by_id === this.user!.id ||
                                        member.id !== this.user!.id
                                          ? html`
                                              <wy-dropdown>
                                                ${this.conversation!.created_by_id === this.user!.id &&
                                                member.id !== this.user!.id
                                                  ? html` <wy-dropdown-item
                                                      @click=${() => this.leaveConversation(member.id)}
                                                    >
                                                      <wy-icon name="account-minus"></wy-icon>
                                                      ${msg("Remove member")}
                                                    </wy-dropdown-item>`
                                                  : member.id === this.user!.id
                                                  ? html`
                                                      <wy-dropdown-item @click=${() => this.leaveConversation()}>
                                                        <wy-icon name="account-minus"></wy-icon>
                                                        ${msg("Leave conversation")}
                                                      </wy-dropdown-item>
                                                    `
                                                  : nothing}
                                              </wy-dropdown>
                                            `
                                          : nothing}
                                      </div>
                                    `
                                  ) ?? nothing}
                                `
                              : nothing}
                          </div>
                          <div class="wy-pane-group">
                            <wy-button
                              kind="filled"
                              buttonClass="wy-button-primary"
                              @click=${() => {
                                this.showDetails = false;
                                this.showAddMembers = true;
                              }}
                              title=${msg("Add members")}
                            >
                              <wy-icon name="account-plus"></wy-icon>
                              ${msg("Add members")}
                            </wy-button>
                          </div>
                        `
                      : nothing}
                  `
                : nothing}
            </div>
          </wy-overlay>
        `,
        () => (this.showDetails = false)
      )}
    `;
  }

  override disconnectedCallback(): void {
    if (this.weavyContext && this.conversationId) {
      this.unsubscribeToRealtime(this.conversationId);
    }
    super.disconnectedCallback();
  }
}
