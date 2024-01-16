import { LitElement, PropertyValues, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { type WeavyContext, weavyContextDefinition } from "../client/context-definition";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import chatCss from "../scss/all.scss";
import throttle from "lodash.throttle";
import type { MemberType, MembersResultType } from "../types/members.types";
import { getInfiniteSearchMemberOptions } from "../data/members";
import { localized, msg } from "@lit/localize";
import { InfiniteQueryController } from "../controllers/infinite-query-controller";
import { InfiniteScrollController } from "../controllers/infinite-scroll-controller";

import "./wy-button";
import "./wy-icon";
import "./wy-avatar";
import "./wy-spinner";
import {  inputConsumeWithClearAndBlurOnEscape } from "../utils/keyboard";
import { WeavyContextProps } from "src/types/weavy.types";

@customElement("wy-users-search")
@localized()
export default class WyUsersSearch extends LitElement {
  
  static override styles = [
    chatCss,
    css`
      :host {
        display: contents;
      }
    `,
  ];

  @consume({ context: weavyContextDefinition, subscribe: true })
  @state()
  private weavyContext?: WeavyContext;

  @property({ attribute: false })
  existingMembers?: MembersResultType = { data: [], count: 0 };

  @property({ attribute: false })
  buttonTitle?: string;

  @state()
  private selected: MemberType[] = [];

  @state()
  text: string = "";

  peopleQuery = new InfiniteQueryController<MembersResultType>(this);
  private inputRef: Ref<HTMLInputElement> = createRef();

  private infiniteScroll = new InfiniteScrollController(this);
  private pagerRef: Ref<Element> = createRef();

  protected override async updated(changedProperties: PropertyValues<this & WeavyContextProps>): Promise<void> {
    this.infiniteScroll.observe(this.peopleQuery.result, this.pagerRef.value);

    if (changedProperties.has("weavyContext") && this.weavyContext) {     
      this.peopleQuery.trackInfiniteQuery(getInfiniteSearchMemberOptions(this.weavyContext, () => this.text!));     
    }

    if (changedProperties.has("text")) {
      await this.peopleQuery.result?.refetch();
    }
  }

  private dispatchSubmit() {
    const event = new CustomEvent("submit", { detail: { members: this.selected } });
    return this.dispatchEvent(event);
  }

  private isChecked(memberId: number): boolean {
    return (
      this.selected.find((m) => {
        return m.id === memberId;
      }) != null
    );
  }

  private handleSelected(member: MemberType, checked: boolean) {
    if (checked) {
      this.selected = [...this.selected, member];
    } else {
      this.selected = this.selected.filter((m) => {
        return m.id !== member.id;
      });
    }
  }

  private async clear() {
    this.text = "";
  }

  private throttledSearch = throttle(
    async () => {
      this.text = this.inputRef.value?.value || "";
    },
    250,
    { leading: false, trailing: true }
  );

  override render() {
    const { data: peopleData, isPending } = this.peopleQuery.result ?? { data: [] };

    const flattenedPeoplePages = peopleData?.pages?.flatMap((peopleResult) => peopleResult.data) || [];

    const hasPeopleResult = Boolean(flattenedPeoplePages.length);
    const hasSelectedMembers = this.selected.length > 0;
    const hasUnselectedPeople = Boolean(
      flattenedPeoplePages.filter(
        (m: MemberType) => this.existingMembers?.data?.find((e) => e.id === m.id) === undefined
      ).length
    );

    return html`<div class="wy-search wy-scroll-y">
      <div class="wy-pane-group">
        <div class="wy-search-form wy-input-group">
          <input
            class="wy-search-input wy-input wy-input-group-input wy-input-filled"
            name="search"
            .value=${this.text || ''}
            ${ref(this.inputRef)}
            @input=${() => this.throttledSearch()}
            @keyup=${inputConsumeWithClearAndBlurOnEscape}
            placeholder=${msg("Search for people...")} />
          <wy-button
            type="reset"
            @click=${this.clear}
            kind="icon"
            class="wy-input-group-button-icon"
            buttonClass="wy-button-icon">
            <wy-icon name="close-circle"></wy-icon>
          </wy-button>
          <wy-button kind="icon" class="wy-input-group-button-icon" buttonClass="wy-button-icon">
            <wy-icon name="magnify"></wy-icon>
          </wy-button>
        </div>
      </div>
      ${hasSelectedMembers
        ? html`
            <div class="wy-pane-group">
              <label class="wy-input-label">${msg("Selected")}</label>
              ${this.selected.map((member: MemberType) => {
                return html`
                  <div class="wy-item">
                    <wy-avatar
                      id=${member.id}
                      .src=${member.avatar_url}
                      .name=${member.display_name}
                      .presence=${member.presence}
                      size=${32}
                      ></wy-avatar>

                    <div class="wy-item-body"> ${member.display_name} </div>
                    <wy-button
                      @click=${() => this.handleSelected(member, !this.isChecked(member.id))}
                      kind="icon"
                      title=${msg("Remove", { desc: "Button action to remove" })}>
                      <wy-icon name="account-minus"></wy-icon>
                    </wy-button>
                  </div>
                `;
              })}
            </div>
          `
        : nothing}
      ${hasPeopleResult && hasUnselectedPeople
        ? html`
            <div class="wy-pane-group">
              <label class="wy-input-label">${msg("People")}</label>
              ${flattenedPeoplePages
                .filter(
                  (m: MemberType) =>
                    this.existingMembers?.data?.find((e) => e.id === m.id) === undefined &&
                    this.selected.find((s) => s.id === m.id) === undefined
                )
                .map((member: MemberType) => {
                  return html` <div class="wy-item">
                    <wy-avatar
                      id=${member.id}
                      .src=${member.avatar_url}
                      .name=${member.display_name}
                      .presence=${member.presence}
                      size=${32}
                      ></wy-avatar>

                    <div class="wy-item-body"> ${member.display_name} </div>
                    <wy-button @click=${() => this.handleSelected(member, !this.isChecked(member.id))} kind="icon">
                      <wy-icon name="account-plus"></wy-icon>
                    </wy-button>
                  </div>`;
                }) ?? nothing}
            </div>
            <div ${ref(this.pagerRef)} class="wy-pager"></div>
          `
        : !isPending
        ? html`
            <div class="wy-pane-group">
              <div class="wy-table-no-result">
                ${this.text ? msg("Your search did not match any people.") : msg("No more users found.")}
              </div>
            </div>
          `
        : html` <wy-spinner overlay></wy-spinner> `}

      <div class="wy-footerbars">
        <div class="wy-footerbar">
          <div class="wy-pane-group">
            <div class="wy-buttons">
              <wy-button
                buttonClass="wy-button-primary"
                @click=${this.dispatchSubmit}
                ?disabled=${this.selected.length === 0 ? true : undefined}
                >${this.buttonTitle ?? msg("Next")}</wy-button
              >
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }
}
