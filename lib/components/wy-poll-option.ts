import { LitElement, html, nothing, type PropertyValueMap } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import chatCss from "../scss/all.scss";
import type { PollOptionType } from "../types/polls.types";
import { QueryController } from "../controllers/query-controller";
import { getVotesOptions } from "../data/poll";
import { localized, msg, str } from "@lit/localize";
import { WeavyProps } from "../types/weavy.types";
import { clickOnEnterAndConsumeOnSpace, clickOnSpace } from "../utils/keyboard";
import { WeavyComponentConsumerMixin } from "../classes/weavy-component-consumer-mixin";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";

import "./base/wy-sheet";
import "./base/wy-avatar";
import "./base/wy-icon";

@customElement("wy-poll-option")
@localized()
export default class WyPollOption extends WeavyComponentConsumerMixin(LitElement) {
  static override styles = chatCss;

  protected exportParts = new ShadowPartsController(this);

  @property({ type: Number, attribute: false })
  totalVotes: number = 0;

  @property({ attribute: false })
  option?: PollOptionType;

  @state()
  private showSheet: boolean = false;

  getVotesQuery = new QueryController<PollOptionType>(this);

  protected override updated(changedProperties: PropertyValueMap<this & WeavyProps>): void {
    if (changedProperties.has("weavy") && this.weavy && this.option && this.option.id) {
      this.getVotesQuery.trackQuery(getVotesOptions(this.weavy, this.option.id));
    }
  }

  private dispatchVote(id?: number | null) {
    if (!id) {
      return;
    }

    const event = new CustomEvent("vote", { detail: { id: id } });
    return this.dispatchEvent(event);
  }

  private openSheet(e: Event) {
    e.preventDefault();
    e.stopPropagation();
    this.getVotesQuery.observer?.refetch();
    this.showSheet = !this.showSheet;
  }

  override render() {
    if(!this.option || !this.option.id) {
      return nothing;
    }

    const { data, isLoading } = this.getVotesQuery.result ?? {};
    const ratio = this.totalVotes > 0 ? Math.round(((this.option.votes?.count || 0) / this.totalVotes) * 100) : 0;

    return html`
      <div
        class="wy-item wy-list-item wy-poll-option"
        tabindex="0"
        @click=${() => this.dispatchVote(this.option?.id)}
        @keydown=${clickOnEnterAndConsumeOnSpace}
        @keyup=${clickOnSpace}
      >
        <div class="wy-progress" style="width: ${ratio + "%"}"></div>
        ${this.option.has_voted
          ? html`<wy-icon name="check-circle"></wy-icon>`
          : html`<wy-icon name="circle-outline"></wy-icon>`}
        <div class="wy-item-body">${this.option.text}</div>
        ${ratio > 0
          ? html`<span
              class="wy-facepile"
              tabindex="0"
              @click=${(e: Event) => this.openSheet(e)}
              @keydown=${clickOnEnterAndConsumeOnSpace}
              @keyup=${clickOnSpace}
            >
              ${ratio + "%"}
            </span>`
          : nothing}
      </div>

      ${this.weavy
        ? html`
            <wy-sheet
              .show=${this.showSheet}
              @close=${() => (this.showSheet = false)}
              @release-focus=${() =>
                this.dispatchEvent(new CustomEvent("release-focus", { bubbles: true, composed: true }))}
            >
              <span slot="appbar-text">${msg(str`Votes on ${this.option.text}`)}</span>
              <!-- <wy-spinner></wy-spinner> -->
              ${this.showSheet && data && !isLoading
                ? html`
                    ${data.votes?.data ? data.votes.data.map(
                      (vote) => html`
                        <div class="wy-item wy-list-item">
                          <wy-avatar .size=${32} .src=${vote.avatar_url} .name=${vote.name}></wy-avatar>
                          <div class="wy-item-body">${vote.name}</div>
                        </div>
                      `
                    ) : nothing}
                  `
                : nothing}
            </wy-sheet>
          `
        : nothing}
    `;
  }
}
