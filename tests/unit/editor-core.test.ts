import { expect, fixture, html, waitUntil } from "@open-wc/testing";
import { ContextProvider } from "@lit/context";

import "../utils/version";
// Library entry first: importing the editor module alone hits a circular import.
import "../../lib";
import type { WyEditorCore } from "../../lib/components/wy-editor-core";
import { Weavy } from "../../lib/client/weavy";
import { WeavyContext } from "../../lib/contexts/weavy-context";
import { UserContext } from "../../lib/contexts/user-context";

describe("editor clicks", () => {
  let weavy: Weavy;

  beforeEach(() => {
    weavy = new Weavy();
    // CodeMirror only loads once the client has a url.
    weavy.url = "https://weavy.test";
    weavy.fetch = async () => Response.json({});
  });

  afterEach(() => {
    weavy.destroy();
  });

  /** A `wy-editor-core` with the given appearance and text, once its CodeMirror view exists. */
  async function createEditor(appearance: WyEditorCore["appearance"], text: string) {
    const host = await fixture<HTMLDivElement>(html`<div style="width: 400px"></div>`);
    new ContextProvider(host, { context: WeavyContext, initialValue: weavy });
    new ContextProvider(host, { context: UserContext, initialValue: { id: 1, name: "Test user" } });
    const core = document.createElement("wy-editor-core");
    core.appearance = appearance;
    host.appendChild(core);
    await waitUntil(() => core.editor, "CodeMirror view was not created", { timeout: 10000 });
    core.editor!.dispatch({ changes: { from: 0, insert: text } });
    await core.updateComplete;
    return core.editor!;
  }

  for (const appearance of ["line", "multiline"] as const) {
    it(`maps clicks on the top and bottom edge of a ${appearance} editor to the clicked line`, async () => {
      const view = await createEditor(appearance, "first line of text\nsecond line\nthird and last line");
      const content = view.contentDOM.getBoundingClientRect();
      const lines = view.contentDOM.querySelectorAll(".cm-line");
      const first = lines[0].getBoundingClientRect();
      const last = lines[lines.length - 1].getBoundingClientRect();
      const x = first.left + 40;

      const topEdge = view.posAtCoords({ x, y: content.top + 2 }, false);
      const bottomEdge = view.posAtCoords({ x, y: content.bottom - 2 }, false);

      expect(topEdge).to.equal(view.posAtCoords({ x, y: (first.top + first.bottom) / 2 + 2 }, false));
      expect(topEdge).to.be.greaterThan(0);
      expect(bottomEdge).to.equal(view.posAtCoords({ x, y: (last.top + last.bottom) / 2 - 2 }, false));
      expect(bottomEdge).to.be.lessThan(view.state.doc.length);
    });
  }

  it("adds no padding to the lines of the full editor", async () => {
    const view = await createEditor("full", "first line\nlast line");
    const lines = view.contentDOM.querySelectorAll(".cm-line");

    expect(getComputedStyle(lines[0]).paddingTop).to.equal("0px");
    expect(getComputedStyle(lines[lines.length - 1]).paddingBottom).to.equal("0px");
  });
});
