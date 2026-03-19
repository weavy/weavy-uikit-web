import { isDomAvailable } from "./dom";

const userAgent = isDomAvailable() ? window.navigator.userAgent : "";

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

export const safari = /Safari\/[0-9]/.test(userAgent) && !/Chrome\/[0-9]/.test(userAgent) && !/Chromium\/[0-9]/.test(userAgent);

/**
 * Interface for the WebGL Debug Renderer Info extension.
 * This is not always available in standard lib.dom definitions.
 */
interface WebGLDebugRendererInfo {
  UNMASKED_VENDOR_WEBGL: number;
  UNMASKED_RENDERER_WEBGL: number;
}

/**
 * Determines if Hardware Acceleration (HWA) is likely stable and 
 * performant on the current device.
 * * @returns {boolean} - Returns true if HWA is recommended.
 */
export function isHWASuitable(): boolean {
  // 1. Basic check for SSR or non-browser environments
  if (typeof window === 'undefined' || !window.document) {
    return false;
  }

  const canvas = document.createElement('canvas');
  const gl = (
    canvas.getContext('webgl') || 
    canvas.getContext('experimental-webgl')
  ) as WebGLRenderingContext | null;

  // 2. If WebGL is missing, the GPU is likely disabled or unsupported
  if (!gl) {
    return false;
  }

  // 3. Identify the renderer to filter out software-based emulators
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info') as WebGLDebugRendererInfo | null;
  
  if (debugInfo) {
    const renderer: unknown = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    
    if (typeof renderer === 'string') {
      const lowCaseRenderer = renderer.toLowerCase();
      
      // Filter out common software-renderers (slow and glitchy for PDF.js)
      const softwareKeywords = ['swiftshader', 'software', 'llvmpipe', 'generic'];
      if (softwareKeywords.some(keyword => lowCaseRenderer.includes(keyword))) {
        return false;
      }
    }
  }

  // 4. Memory check (Optional)
  // If the device has very low RAM, HWA might cause tab crashes during PDF tiling
  if ('deviceMemory' in navigator && navigator.deviceMemory as number < 4) {
    return false;
  }

  return true;
}