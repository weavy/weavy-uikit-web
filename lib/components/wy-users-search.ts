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
import type { WySearch } from "./ui/wy-search";

import paneCss from "../scss/components/pane.scss";
import footerbarCss from "../scss/components/footerbar.scss";
import inputCss from "../scss/components/input.scss";
import scrollCss from "../scss/scroll.scss";
import pagerCss from "../scss/components/pager.scss";
import hostContentsCss from "../scss/host-contents.scss";

import "./ui/wy-button";
import "./ui/wy-icon";
import "./ui/wy-item";
import "./ui/wy-avatar";
import "./ui/wy-progress-circular";
import "./ui/wy-search";

declare global {
  interface HTMLElementTagNameMap {
    "wy-users-search": WyUsersSearch;
  }
}

/**
 * User search UI used to find and pick members for apps.
 *
 * **Used sub components:**
 *
 * - [`<wy-search>`](./ui/wy-search.ts)
 * - [`<wy-item>`](./ui/wy-item.ts)
 * - [`<wy-avatar>`](./ui/wy-avatar.ts)
 * - [`<wy-button>`](./ui/wy-button.ts)
 * - [`<wy-icon>`](./ui/wy-icon.ts)
 * - [`<wy-progress-circular>`](./ui/wy-progress-circular.ts)
 *
 * @csspart wy-pane - Root pane container.
 * @csspart wy-pane-body - Body area for content.
 * @csspart wy-pane-group - Group wrapper inside pane.
 * @csspart wy-no-result - Message shown when there are no results.
 * @csspart wy-footerbar - Footer bar container.
 * @csspart wy-footerbar-sticky - Sticky footer modifier.
 * @csspart wy-pager - Pager container.
 * @csspart wy-pager-bottom - Pager bottom modifier.
 *
 * @fires {MemberSearchSubmitEventType} submit - Emitted when the selected members are submitted.
 */
@customElement("wy-users-search")
@localized()
export class WyUsersSearch extends LitElement {
  static override styles = [scrollCss, footerbarCss, inputCss, pagerCss, hostContentsCss, paneCss];

  protected exportParts = new ShadowPartsController(this);

  /**
   * Consumed Weavy client used for querying members.
   *
   * @internal
   */
  @consume({ context: WeavyContext, subscribe: true })
  @state()
  weavy?: WeavyType;

  /**
   * App identifier used to scope member searches.
   */
  @property({ attribute: false })
  appId?: number;

  /**
   * Label for the submit button.
   */
  @property({ attribute: false })
  buttonTitle?: string;

  /**
   * Filters search results to agents, non-agents, or all members.
   *
   * @internal
   */
  @state()
  agentFilter?: boolean = undefined;

  /**
   * Members already chosen prior to the current selection.
   *
   * @internal
   */
  @state()
  private selected: MemberType[] = [];

  /**
   * Members marked during the current selection session.
   *
   * @internal
   */
  @state()
  private select: MemberType[] = [];

  /**
   * Current search query text.
   *
   * @internal
   */
  @state()
  text: string = "";

  /**
   * Infinite query controller handling member search responses.
   *
   * @internal
   */
  peopleQuery = new InfiniteQueryController<InfiniteQueryResultType<MemberType>>(this);

  /**
   * Reference to the search input instance.
   *
   * @internal
   */
  private searchRef: Ref<WySearch> = createRef();

  /**
   * Controls incremental loading when scrolling.
   *
   * @internal
   */
  private infiniteScroll = new InfiniteScrollController(this);

  /**
   * Pager sentinel element reference for infinite scroll.
   *
   * @internal
   */
  private pagerRef: Ref<HTMLElement> = createRef();

  /**
   * Emits the selected members via the `submit` event.
   *
   * @internal
   * @returns {boolean} `true` if the event was not canceled.
   */
  private dispatchSubmit() {
    this.selected = [...this.selected, ...this.select];
    const event: MemberSearchSubmitEventType = new (CustomEvent as NamedEvent)("submit", {
      detail: { members: this.selected },
    });
    return this.dispatchEvent(event);
  }

  /**
   * Checks whether a member is currently selected.
   *
   * @internal
   */
  private isChecked(memberId: number): boolean {
    return (
      this.select.find((m) => {
        return m.id === memberId;
      }) != null
    );
  }

  /**
   * Toggles selection state for the provided member.
   *
   * @internal
   */
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

  /**
   * Renders the list of currently selected members.
   *
   * @internal
   */
  getSelected() {
    if (this.selected.length > 0) {
      return html`
        ${this.selected.map((member: MemberType) => {
          return html`
            <wy-item
              interactive
              @click=${() => this.handleSelected(member, false)}
              @keydown=${clickOnEnterAndConsumeOnSpace}
              @keyup=${clickOnEnterAndConsumeOnSpace}
            >
              <wy-avatar
                slot="image"
                id=${member.id}
                .src=${member.avatar_url}
                .name=${member.name}
                .description=${member.comment}
                .presence=${member.presence}
                .isAgent=${member.is_agent}
                size=${32}
              ></wy-avatar>
              <span slot="title"> ${member.name} </span>
              <wy-button slot="actions" kind="icon" .active=${false}
                ><wy-icon name="checkbox-marked"></wy-icon
              ></wy-button>
            </wy-item>
          `;
        })}
      `;
    } else {
      return nothing;
    }
  }

  /**
   * Renders search results for the current query and filter.
   *
   * @internal
   */
  getSearchResult() {
    const { data: peopleData, hasNextPage, isPending } = this.peopleQuery.result ?? { data: [], isPending: true };
    const flattenedPages = getFlatInfiniteResultData(peopleData);
    const hasResult = Boolean(flattenedPages.length);
    const templateResults: TemplateResult[] = [];

    if (isPending) {
      templateResults.push(html`<wy-progress-circular indeterminate overlay></wy-progress-circular>`);
    } else if (!hasResult) {
      templateResults.push(html`<div part="wy-pane-group">
        <div part="wy-no-result">
          ${this.text ? msg("Your search did not match any people.") : msg("No more users found.")}
        </div>
      </div>`);
    }

    if (hasResult) {
      templateResults.push(
        html` ${flattenedPages
          .filter((m: MemberType) => this.selected.find((s) => s.id === m.id) === undefined)
          .map((member: MemberType) => {
            return html` <wy-item
              interactive
              @click=${() => this.handleSelected(member, !this.isChecked(member.id))}
              @keydown=${clickOnEnterAndConsumeOnSpace}
              @keyup=${clickOnEnterAndConsumeOnSpace}
            >
              <wy-avatar
                slot="image"
                id=${member.id}
                .src=${member.avatar_url}
                .name=${member.name}
                .description=${member.comment}
                .presence=${member.presence}
                .isAgent=${member.is_agent}
                size=${32}
              ></wy-avatar>
              <span slot="title"> ${member.name} </span>
              <wy-button slot="actions" kind="icon" .active=${false}
                ><wy-icon name="${this.isChecked(member.id) ? "checkbox-marked" : "checkbox-blank"}"></wy-icon
              ></wy-button>
            </wy-item>`;
          }) ?? nothing}`
      );
    }
    if (hasNextPage) {
      templateResults.push(html`<div ${ref(this.pagerRef)} part="wy-pager wy-pager-bottom"></div>`);
    }
    return templateResults;
  }

  override render() {
    return html`<div part="wy-pane wy-scroll-y wy-scroll-y-always">
      <div part="wy-pane-body">
        <div part="wy-pane-group wy-pane-group-fixed-size">
          <wy-search ${ref(this.searchRef)} @search=${(e: SearchEventType) => (this.text = e.detail.query)}></wy-search>
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
        <div part="wy-pane-body"> ${this.getSelected()} ${this.getSearchResult()} </div>
      </div>
      <div part="wy-footerbar wy-footerbar-sticky">
        <div part="wy-pane-group">
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
