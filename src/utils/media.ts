export function mediaFallback(media: HTMLVideoElement | HTMLAudioElement) {
  if (media.classList.contains("wy-loading")) {
    media.classList.add("wy-loaded");
  }
  media.classList.add("wy-error");
  // TODO: replace with react way
  media.outerHTML = media.outerHTML.replace(/<(video|audio)/, "<div").replace(/(video|audio)>/, "div>");
}

export function mediaLoaded(event: Event) {
  const src = event.target as HTMLMediaElement;
  if (src.tagName === "VIDEO" || src.tagName === "AUDIO") {
    if (src.classList.contains("wy-loading")) {
      //console.log("loaded")
      src.classList.add("wy-loaded");
    }
  }
}

export function mediaError(event: Event) {
  const src = event.target as HTMLSourceElement;
  if (src.tagName === "SOURCE" && src.parentNode) {
    const media: HTMLMediaElement = src.parentNode as HTMLMediaElement;
    const errors = parseInt(media.dataset.errors || "0") + 1;
    media.dataset.errors = errors.toString();

    if (media.querySelectorAll("source").length >= errors) {
      console.warn(media.tagName.toLowerCase() + " source error, switching to fallback");
      mediaFallback(media);
    }
  }
}

export function codecError(event: Event) {
  const src = event.target as HTMLMediaElement;
  if (src.tagName === "VIDEO" || src.tagName === "AUDIO") {
    // Capture codec-error for video in firefox
    if (
      (src.tagName === "VIDEO" && !(src as HTMLVideoElement).videoWidth) ||
      (src.tagName === "AUDIO" && !src.duration)
    ) {
      console.warn(src.tagName.toLowerCase() + " track not available, switching to fallback");
      mediaFallback(src);
    }
  }
}
