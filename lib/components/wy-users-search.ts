import { LitElement, html, TemplateResult, nothing, type PropertyValueMap } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { type WeavyType, WeavyContext } from "../contexts/weavy-context";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import type { MemberType } from "../types/members.types";
import { getInfiniteSearchMemberOptions } from "../data/members";
import { localized, msg } from "@lit/localize";
import { InfiniteQueryController } from "../controllers/infinite-query-controller";
import { InfiniteScrollController } from "../controllers/infinite-scroll-controller";
import { clickOnEnterAndConsumeOnSpace } from "../utils/keyboard";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { InfiniteQueryResultType } from "../types/query.types";
import { getFlatInfiniteResultData } from "../utils/query-cache";
import type { MemberSearchSubmitEventType } from "../types/members.events";
import type { NamedEvent } from "../types/generic.types";
import type { SearchEventType } from "../types/search.events";

import chatCss from "../scss/all.scss";
import footerbarCss from "../scss/components/footerbar.scss";
import pagerCss from "../scss/components/pager.scss";
import hostContentsCss from "../scss/host-contents.scss";

import "./base/wy-button";
import "./base/wy-icon";
import "./base/wy-avatar";
import "./base/wy-spinner";
import "./base/wy-search";
import WySearch from "./base/wy-search";

@customElement("wy-users-search")
@localized()
export default class WyUsersSearch extends LitElement {
  static override styles = [
    chatCss,
    footerbarCss,
    pagerCss,
    hostContentsCss,
  ];

  protected exportParts = new ShadowPartsController(this);

  @consume({ context: WeavyContext, subscribe: true })
  @state()
  weavy?: WeavyType;

  @property({ attribute: false })
  appId?: number;

  @property({ attribute: false })
  buttonTitle?: string;

  @state()
  agentFilter?: boolean = undefined;

  @state()
  private selected: MemberType[] = [];

  @state()
  private select: MemberType[] = [];

  @state()
  text: string = "";

  peopleQuery = new InfiniteQueryController<InfiniteQueryResultType<MemberType>>(this);
  private searchRef: Ref<WySearch> = createRef();

  private infiniteScroll = new InfiniteScrollController(this);
  private pagerRef: Ref<HTMLElement> = createRef();

  private dispatchSubmit() {
    this.selected = [...this.selected, ...this.select];
    const event: MemberSearchSubmitEventType = new (CustomEvent as NamedEvent)("submit", { detail: { members: this.selected } });
    return this.dispatchEvent(event);
  }

  private isChecked(memberId: number): boolean {
    return (
      this.select.find((m) => {
        return m.id === memberId;
      }) != null
    );
  }

  private handleSelected(member: MemberType, checked: boolean) {
    if (checked) {
      this.select = [...this.select, member];
    } else {
      this.select = this.select.filter((m) => {
        return m.id !== member.id;
      });
      this.selected = this.selected.filter((m) => {
        return m.id !== member.id;
      });
    }
  }

  getSelected() {
    if (this.selected.length > 0) {
      return html`
        ${this.selected.map((member: MemberType) => {
          return html`
            <div
              class="wy-item wy-list-item wy-item-hover"
              @click=${() => this.handleSelected(member, false)}
              @keydown=${clickOnEnterAndConsumeOnSpace}
              @keyup=${clickOnEnterAndConsumeOnSpace}
            >
              <wy-avatar
                id=${member.id}
                .src=${member.avatar_url}
                .name=${member.name}
                .description=${member.comment}
                .presence=${member.presence}
                .isAgent=${member.is_agent}
                size=${32}
              ></wy-avatar>
              <div class="wy-item-body"> ${member.name} </div>
              <wy-icon name="checkbox-marked"></wy-icon>
            </div>
          `;
        })}
      `;
    } else {
      return nothing;
    }
  }

  getSearchResult() {
    const { data: peopleData, hasNextPage, isPending } = this.peopleQuery.result ?? { data: [], isPending: true };
    const flattenedPages = getFlatInfiniteResultData(peopleData);
    const hasResult = Boolean(flattenedPages.length);
    const templateResults: TemplateResult[] = [];

    if (isPending) {
      templateResults.push(html`<wy-spinner overlay></wy-spinner>`);
    } else if (!hasResult) {
      templateResults.push(html`<div class="wy-pane-group">
        <div class="wy-table-no-result">
          ${this.text ? msg("Your search did not match any people.") : msg("No more users found.")}
        </div>
      </div>`);
    }

    if (hasResult) {
      templateResults.push(
        html` ${flattenedPages
          .filter((m: MemberType) => this.selected.find((s) => s.id === m.id) === undefined)
          .map((member: MemberType) => {
            return html`<div
              class="wy-item wy-list-item wy-item-hover"
              @click=${() => this.handleSelected(member, !this.isChecked(member.id))}
              @keydown=${clickOnEnterAndConsumeOnSpace}
              @keyup=${clickOnEnterAndConsumeOnSpace}
            >
              <wy-avatar
                id=${member.id}
                .src=${member.avatar_url}
                .name=${member.name}
                .description=${member.comment}
                .presence=${member.presence}
                .isAgent=${member.is_agent}
                size=${32}
              ></wy-avatar>
              <div class="wy-item-body"> ${member.name} </div>
              <wy-icon name="${this.isChecked(member.id) ? "checkbox-marked" : "checkbox-blank"}"></wy-icon>
            </div>`;
          }) ?? nothing}`
      );
    }
    if (hasNextPage) {
      templateResults.push(html`<div ${ref(this.pagerRef)} part="wy-pager wy-pager-bottom"></div>`);
    }
    return templateResults;
  }

  override render() {
    return html`<div class="wy-pane wy-scroll-y">
      <div class="wy-pane-body">
        <div class="wy-pane-group">
          <wy-search ${ref(this.searchRef)} @search=${(e: SearchEventType) => this.text = e.detail.query}></wy-search>
        </div>
        <div>
          <wy-buttons tabs>
            <wy-button
              ?active=${this.agentFilter === undefined}
              @click=${() => (this.agentFilter = undefined)}
              kind="tab"
              small
              >${msg("All")}</wy-button
            >
            <wy-button ?active=${this.agentFilter === false} @click=${() => (this.agentFilter = false)} kind="tab" small
              >${msg("People")}</wy-button
            >
            <wy-button ?active=${this.agentFilter === true} @click=${() => (this.agentFilter = true)} kind="tab" small
              >${msg("Agents")}</wy-button
            >
          </wy-buttons>
        </div>
        <div class="wy-pane-body">
          ${this.getSelected()} ${this.getSearchResult()}
        </div>
      </div>
      <div part="wy-footerbar wy-footerbar-sticky">
        <div class="wy-pane-group">
          <wy-buttons reverse>
            <wy-button
              color="primary"
              @click=${() => this.dispatchSubmit()}
              ?disabled=${this.selected.length === 0 && this.select.length === 0 ? true : undefined}
              >${this.buttonTitle ?? msg("Create")}</wy-button
            >
          </wy-buttons>
        </div>
      </div>
    </div>`;
  }

  protected override async willUpdate(changedProperties: PropertyValueMap<this>): Promise<void> {
    super.willUpdate(changedProperties);
    
    if (changedProperties.has("weavy") && this.weavy) {
      await this.peopleQuery.trackInfiniteQuery(
        getInfiniteSearchMemberOptions(
          this.weavy,
          () => this.text,
          this.appId,
          () => this.agentFilter
        )
      );
    }
  }

  protected override async updated(changedProperties: PropertyValueMap<this>): Promise<void> {
    this.infiniteScroll.observe(this.peopleQuery.result, this.pagerRef.value);

    if (changedProperties.has("text") || changedProperties.has("agentFilter")) {
      if (this.select.length > 0) {
        this.selected = [...this.selected, ...this.select];
        this.select = [];
      }
      await this.peopleQuery.result?.refetch?.();
      this.searchRef.value?.focusInput();
    }
  }
}
