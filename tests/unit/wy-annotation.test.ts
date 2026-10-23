import { fixture, html, oneEvent } from "@open-wc/testing";

import "../utils/version";
import "../../lib";
import { type WyAnnotationList } from "../../lib/components/wy-annotation";
import type { FileType } from "../../lib/types/files.types";
import { WyActionEventType } from "../../lib/types/action.events";
import { expect } from "@open-wc/testing";

describe("wy-annotation-list", () => {
  const file = { id: 42, name: "notes.txt", size: 1234 } as FileType;

  it("re-dispatches file-open from the list when an annotation is clicked", async () => {
    const el = await fixture<WyAnnotationList>(html`<wy-annotation-list .files=${[file]}></wy-annotation-list>`);
    await el.updateComplete;

    const annotation = el.shadowRoot?.querySelector("wy-annotation");
    expect(annotation, "wy-annotation should be rendered").to.exist;
    await (annotation as LitElementLike).updateComplete;

    // the button lives in wy-annotation's own shadow root; its file-open event is neither
    // bubbling nor composed, so without the re-dispatch it never reaches the list
    const button = annotation?.shadowRoot?.querySelector("wy-button") as HTMLElement;
    expect(button, "wy-button should be rendered").to.exist;

    const listening = oneEvent(el, "wy-action");
    button.click();
    const event = (await listening) as WyActionEventType;

    await expect(event.detail.file?.id).to.equal(file.id);
  });

  it("does not dispatch file-open for a trashed annotation", async () => {
    const trashed = { ...file, is_trashed: true } as FileType;
    const el = await fixture<WyAnnotationList>(html`<wy-annotation-list .files=${[trashed]}></wy-annotation-list>`);
    await el.updateComplete;

    const annotation = el.shadowRoot?.querySelector("wy-annotation");
    await (annotation as LitElementLike).updateComplete;

    let fired = false;
    el.addEventListener("wy-action", () => (fired = true));
    (annotation?.shadowRoot?.querySelector("wy-button") as HTMLElement).click();

    expect(fired).to.be.false;
  });
});

/** Minimal shape for awaiting a Lit element's render without importing the class. */
type LitElementLike = Element & { updateComplete: Promise<boolean> };
