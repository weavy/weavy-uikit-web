import { LitElement, html, css } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { PollOptionType } from "../types/polls.types";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { PollVoteEventType } from "../types/polls.events";
import { NamedEvent } from "../types/generic.types";

import chatCss from "../scss/all.scss"

import "./wy-poll-option";

@customElement("wy-poll")
export default class WyPoll extends LitElement {
  static override styles = [
    chatCss,
    css`
      :host {
        display: grid;
      }
    `,
  ];

  protected exportParts = new ShadowPartsController(this);
  
  @property({ type: Array, attribute: false })
  pollOptions: PollOptionType[] = [];

  private dispatchVote(optionId: number) {
    const event: PollVoteEventType = new (CustomEvent as NamedEvent)("vote", { detail: { optionId } });
    return this.dispatchEvent(event);
  }

  override render() {
    const totalVotes = this.pollOptions.reduce((prev, curr) => prev + (curr.votes?.count || 0), 0);

    return html`
      <div class="wy-poll">
        ${this.pollOptions.map(
          (option: PollOptionType) =>
            html`<wy-poll-option
              @vote=${(e: PollVoteEventType) => this.dispatchVote(e.detail.optionId)}
              .option=${option}
              .totalVotes=${totalVotes}></wy-poll-option>`
        )}
      </div>
    `;
  }
}
