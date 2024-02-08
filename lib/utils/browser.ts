const userAgent = window.navigator.userAgent;

// mobile or tablet
// Tablet should also be treated as mobile normally

export const tablet =
  userAgent.includes("iPad") || (userAgent.includes("Android") && !userAgent.includes("Mobi")) || false;
export const mobile = userAgent.includes("Mobi") || tablet || false;
export const desktop = !mobile && !tablet;

// platform
export const platform = userAgent.includes("Windows")
  ? "Windows"
  : userAgent.includes("Macintosh")
  ? "Mac"
  : userAgent.includes("iPad") || userAgent.includes("iPhone") || userAgent.includes("iPod")
  ? "iOS"
  : userAgent.includes("Android")
  ? "Android"
  : undefined;

export const webView =
  (platform === "Android" && userAgent.includes("; wv")) ||
  (platform === "iOS" && !userAgent.includes("Safari")) ||
  false;


// browsers
// see: https://developer.mozilla.org/en-US/docs/Web/HTTP/Browser_detection_using_the_user_agent#browser_name_and_version

export const chrome = /Chrome\/[0-9]/.test(userAgent) && !/Chromium\/[0-9]/.test(userAgent) && !/Edg.*\/[0-9]/.test(userAgent);
