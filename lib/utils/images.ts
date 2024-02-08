export function checkImageLoad(element?: Element) {
  const img = element as HTMLImageElement;
  if (img) {
    const isLoaded = img.complete && img.naturalHeight !== 0;
    if (isLoaded) {
      if (!img.classList.contains("wy-loading")) {
        //console.debug("image is instantly loaded")
        img.classList.add("wy-loading", "wy-loaded");
      } else {
        img.decode().then(() => {
          //console.debug("image is loaded after delay")
          img.classList.add("wy-loaded");
        });
      }
    } else {
      //console.debug("image is loading")
      img.classList.add("wy-loading");
    }
  }
}

export function imageLoaded(event: Event) {
  const img = event.target as HTMLElement;
  if (img.tagName === "IMG" && img.classList.contains("wy-loading") && !img.classList.contains("wy-loaded")) {
    img.classList.add("wy-loaded");
  }
}
