import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";

import { ContextConsumer } from "@lit/context";
import { type WeavyType, WeavyContext } from "../lib/contexts/weavy-context";

import { onlineManager } from "@tanstack/query-core";
import * as TanstackQueryDevtools from "@tanstack/query-devtools";
import type { DevtoolsButtonPosition, DevtoolsErrorType, DevtoolsPosition } from "@tanstack/query-devtools";
import { whenParentsDefined } from "../lib/utils/dom";

@customElement("tanstack-dev-tools")
export default class TanstackDevTools extends LitElement {
  protected weavyContextConsumer?: ContextConsumer<{ __context__: WeavyType }, this>;

  // Manually consumed in scheduleUpdate()
  @state()
  protected weavy?: WeavyType;

  /**
   * Set this true if you want the dev tools to default to being open
   */
  @property({
    type: Boolean,
  })
  initialIsOpen: boolean = false;

  /**
   * The position of the React Query logo to open and close the devtools panel.
   * 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
   * Defaults to 'bottom-left'.
   */
  @property()
  buttonPosition: DevtoolsButtonPosition = "bottom-left";

  /**
   * The position of the React Query devtools panel.
   * 'top' | 'bottom' | 'left' | 'right'
   * Defaults to 'bottom'.
   */
  @property()
  position: DevtoolsPosition = "bottom";

  /**
   * Use this so you can define custom errors that can be shown in the devtools.
   */
  @property({ attribute: false })
  errorTypes: Array<DevtoolsErrorType> = [];

  private containerRef: Ref<HTMLElement> = createRef();

  private devtools?: TanstackQueryDevtools.TanstackQueryDevtools;

  override async scheduleUpdate() {
    await whenParentsDefined(this);
    this.weavyContextConsumer = new ContextConsumer(this, { context: WeavyContext, subscribe: true });

    if (this.weavyContextConsumer?.value && this.weavy !== this.weavyContextConsumer?.value) {
      this.weavy = this.weavyContextConsumer?.value;
    }

    await super.scheduleUpdate();
  }

  override createRenderRoot() {
    return this;
  }

  override updated() {
    if (!this.devtools && this.containerRef.value && this.weavy) {
      this.devtools = new TanstackQueryDevtools.TanstackQueryDevtools({
        // @ts-expect-error TanstackQueryDevtoolsConfig: Property '#private' in type 'QueryClient' refers to a different member that cannot be accessed from within type 'QueryClient'.
        client: this.weavy.queryClient,
        queryFlavor: "Lit Query",
        version: "5",
        // @ts-expect-error TanstackQueryDevtoolsConfig: Property '#private' in type 'OnlineManager' refers to a different member that cannot be accessed from within type 'OnlineManager'
        onlineManager,
        buttonPosition: this.buttonPosition,
        position: this.position,
        initialIsOpen: this.initialIsOpen,
        errorTypes: this.errorTypes,
      });

      //console.log("Mounting Tanstack Query Devtools", this.devtools)
      this.devtools.mount(this.containerRef.value);
    }
  }

  override render() {
    return html` <div class="tsqd-parent-container" ${ref(this.containerRef)}></div> `;
  }

  override disconnectedCallback(): void {
    this.devtools?.unmount();
    super.disconnectedCallback();
  }
}
