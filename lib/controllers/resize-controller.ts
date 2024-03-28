import { ReactiveController, ReactiveControllerHost } from "lit";

export type ResizeCondition = { target: HTMLElement; name: string; condition: (entry: ResizeObserverEntry) => boolean };

export class ResizeController implements ReactiveController {
  constructor(host: ReactiveControllerHost) {
    host.addController(this);
    this.host = host;
  }

  host: ReactiveControllerHost;
  observers: ResizeCondition[] = [];
  conditions: { [key: string]: boolean } = {};

  checkConditions(entry: ResizeObserverEntry) {
    let hasChanged = false;
    this.observers.forEach((observe) => {
      if (entry.target === observe.target) {
        const prevCondition = this.conditions[observe.name];
        const currentCondition = observe.condition(entry);
        if (prevCondition !== currentCondition) {
          this.conditions[observe.name] = currentCondition;
          hasChanged = true;
        }
      }
    });
    return hasChanged;
  }

  resizer: ResizeObserver = new ResizeObserver((entries) => {
    let hasChanged = false;
    for (const entry of entries) {
      hasChanged = this.checkConditions(entry) || hasChanged;
    }

    if (hasChanged) {
      this.host.requestUpdate();
    }
  });

  public observe(resizeCondition: ResizeCondition) {
    const target = resizeCondition.target;
    const contentRect = target.getBoundingClientRect();

    this.observers.push(resizeCondition);
    this.resizer.observe(target);

    this.checkConditions({
      contentBoxSize: [
        {
          inlineSize: target.clientWidth,
          blockSize: target.clientHeight,
        },
      ],
      borderBoxSize: [
        {
          inlineSize: contentRect.width,
          blockSize: contentRect.height,
        },
      ],
      devicePixelContentBoxSize: [
        {
          inlineSize: contentRect.width * window.devicePixelRatio,
          blockSize: contentRect.height * window.devicePixelRatio,
        },
      ],
      contentRect,
      target,
    });
  }

  reset() {
    this.conditions = {};
    this.observers.length = 0;
    this.resizer.disconnect();
  }

  hostConnected() {
    this.observers.forEach((observer) => {
      this.resizer.observe(observer.target);
    })
  }

  hostDisconnected() {
    // Clear the observer when the host is disconnected
    this.resizer.disconnect();
  }
}
