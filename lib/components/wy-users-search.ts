import { LitElement, css, html, TemplateResult, nothing, type PropertyValueMap } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { type WeavyType, WeavyContext } from "../contexts/weavy-context";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import chatCss from "../scss/all.scss";
import throttle from "lodash.throttle";
import type { MemberType } from "../types/members.types";
import { getInfiniteSearchMemberOptions } from "../data/members";
import { localized, msg } from "@lit/localize";
import { InfiniteQueryController } from "../controllers/infinite-query-controller";
import { InfiniteScrollController } from "../controllers/infinite-scroll-controller";
import { clickOnEnterAndConsumeOnSpace, inputClearAndBlurOnEscape, inputConsume } from "../utils/keyboard";
import { WeavyProps } from "../types/weavy.types";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";

import "./wy-button";
import "./wy-icon";
import "./wy-avatar";
import "./wy-spinner";
import { InfiniteQueryResultType } from "../types/query.types";

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

  protected exportParts = new ShadowPartsController(this);

  @consume({ context: WeavyContext, subscribe: true })
  @state()
  private weavy?: WeavyType;

  @property({ attribute: false})
  appId?: number;

  @property({ attribute: false })
  buttonTitle?: string;

  @state()
  botFilter?: boolean = undefined;

  @state()
  private selected: MemberType[] = [];

  @state()
  private select: MemberType[] = [];

  @state()
  text: string = "";

  peopleQuery = new InfiniteQueryController<InfiniteQueryResultType<MemberType>>(this);
  private inputRef: Ref<HTMLInputElement> = createRef();

  private infiniteScroll = new InfiniteScrollController(this);
  private pagerRef: Ref<HTMLElement> = createRef();

  private dispatchSubmit() {
    this.selected = [...this.selected, ...this.select];
    const event = new CustomEvent("submit", { detail: { members: this.selected } });
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

  getSelected() {
    if (this.selected.length > 0) {
      return html`${this.selected.map((member: MemberType) => {
          return html`
            <div class="wy-item wy-list-item wy-item-hover" @click=${() => this.handleSelected(member, false)} @keydown=${clickOnEnterAndConsumeOnSpace} @keyup=${clickOnEnterAndConsumeOnSpace}>
              <wy-avatar
                id=${member.id}
                .src=${member.avatar_url}
                .name=${member.display_name}
                .presence=${member.presence}
                .isBot=${member.is_bot}
                size=${32}
              ></wy-avatar>
              <div class="wy-item-body"> ${member.display_name} </div>
              <wy-icon name="checkbox-marked"></wy-icon>
            </div>
          `;
        })}`;
    } else {
      return nothing;
    }
  }

  getSearchResult() {
    const { data: peopleData, isPending } = this.peopleQuery.result ?? { data: [], isPending: true };
    const flattenedPages = (peopleData?.pages?.flatMap((peopleResult) => (peopleResult.data)).filter(x => x) ?? []) as MemberType[];
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
      templateResults.push(html`
        ${flattenedPages
          .filter(
            (m: MemberType) =>
              this.selected.find((s) => s.id === m.id) === undefined
          )
          .map((member: MemberType) => {
            return html`<div class="wy-item wy-list-item wy-item-hover" @click=${() => this.handleSelected(member, !this.isChecked(member.id))} @keydown=${clickOnEnterAndConsumeOnSpace} @keyup=${clickOnEnterAndConsumeOnSpace}>
              <wy-avatar
                id=${member.id}
                .src=${member.avatar_url}
                .name=${member.display_name}
                .presence=${member.presence}
                .isBot=${member.is_bot}
                size=${32}
              ></wy-avatar>
              <div class="wy-item-body"> ${member.display_name} </div>
              <wy-icon name="${this.isChecked(member.id) ? "checkbox-marked" : "checkbox-blank"}"></wy-icon>
          </div>`;
          }) ?? nothing}`);
    }
    templateResults.push(html`<div ${ref(this.pagerRef)} part="wy-pager"></div>`);
    return templateResults;
  }

  override render() {
    return html`<div class="wy-pane wy-scroll-y">
      <div class="wy-pane-body">
      <div class="wy-pane-group">
        <div class="wy-input-group">
          <input
            class="wy-input wy-input-group-input wy-input-filled"
            name="search"
            .value=${this.text || ""}
            ${ref(this.inputRef)}
            @input=${() => this.throttledSearch()}
            @keydown=${inputClearAndBlurOnEscape}
            @keyup=${inputConsume}
            placeholder=${msg("Search...")}
          />
          <wy-button
            type="reset"
            @click=${this.clear}
            kind="icon"
            class="wy-input-group-button-icon"
          >
            <wy-icon name="close-circle"></wy-icon>
          </wy-button>
          <wy-button kind="icon" class="wy-input-group-button-icon">
            <wy-icon name="magnify"></wy-icon>
          </wy-button>
        </div>
      </div>
      <wy-buttons tabs>
        <wy-button
          ?active=${this.botFilter === undefined}
          @click=${() => (this.botFilter = undefined)}
          kind="tab"
          small
          >${msg("All")}</wy-button
        >
        <wy-button
          ?active=${this.botFilter === false}
          @click=${() => (this.botFilter = false)}
          kind="tab"
          small
          >${msg("People")}</wy-button
        >
        <wy-button
          ?active=${this.botFilter === true}
          @click=${() => (this.botFilter = true)}
          kind="tab"
          small
          >${msg("Bots")}</wy-button
        >
      </wy-buttons>
      <div class="wy-pane-group">
        ${this.getSelected()} ${this.getSearchResult()}
      </div>      
      </div>
      <div class="wy-footerbar wy-footerbar-sticky">
        <div class="wy-pane-group">
          <wy-buttons reverse>
            <wy-button
              color="primary"
              @click=${this.dispatchSubmit}
              ?disabled=${this.selected.length === 0 && this.select.length === 0 ? true : undefined}
              >${this.buttonTitle ?? msg("Create")}</wy-button
            >
          </wy-buttons>
        </div>
      </div>
    </div>`;
  }

  protected override async updated(changedProperties: PropertyValueMap<this & WeavyProps>): Promise<void> {
    this.infiniteScroll.observe(this.peopleQuery.result, this.pagerRef.value);    

    if (changedProperties.has("weavy") && this.weavy) {
      this.peopleQuery.trackInfiniteQuery(
        getInfiniteSearchMemberOptions(
          this.weavy,          
          () => this.text!,
          this.appId,
          () => this.botFilter
        )
      );
    }

    if (changedProperties.has("text") || changedProperties.has("botFilter")) {
      if (this.select.length > 0) {
        this.selected = [...this.selected, ...this.select];
        this.select = [];
      }
      await this.peopleQuery.result?.refetch();
      this.inputRef.value?.focus();
    }
  }
}
