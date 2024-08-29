import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import chatCss from "../scss/all.scss"
import { PollOptionType } from "../types/polls.types";
import "./wy-poll-option";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";

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

  private dispatchVote(id: number) {
    const event = new CustomEvent("vote", { detail: { id: id } });
    return this.dispatchEvent(event);
  }

  override render() {
    const totalVotes = this.pollOptions.reduce((prev, curr) => prev + (curr.votes?.count || 0), 0);

    return html`
      <div class="wy-poll">
        ${this.pollOptions.map(
          (o: PollOptionType) =>
            html`<wy-poll-option
              @vote=${(e: CustomEvent) => this.dispatchVote(e.detail.id)}
              .option=${o}
              .totalVotes=${totalVotes}></wy-poll-option>`
        )}
      </div>
    `;
  }
}
