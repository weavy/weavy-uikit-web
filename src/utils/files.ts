import { FileKindType, PreviewFormatType, ProviderType } from "../types/files.types";

export const fileSizeAsString = (size: number, significantDigits: number = 3) => {
  const format = [" B", " KB", " MB", " GB", " TB", " PB", " EB", " ZB", " YB"];
  let s = size;
  let i = 0;
  while (i < format.length - 1 && s >= 1024) {
    s = (100 * s) / 1024 / 100.0;
    i++;
  }

  return s.toLocaleString(undefined, { maximumSignificantDigits: significantDigits }) + format[i];
};

export function getExtension(name: string) {
  if (name.lastIndexOf(".") === -1) {
    return ".";
  }
  return (name.substring(name.lastIndexOf("."), name.length) || name).toLowerCase();
}

export function isAudio(ext: string) {
  switch (ext) {
    case ".aac":
    case ".aif":
    case ".aiff":
    case ".au":
    case ".gsm":
    case ".m4a":
    case ".mid":
    case ".midi":
    case ".mka":
    case ".mp3":
    case ".oga":
    case ".ogg":
    case ".ra":
    case ".ram":
    case ".snd":
    case ".spx":
    case ".wav":
    case ".wma":
      return true;
    default:
      return false;
  }
}

export function isImage(ext: string) {
  switch (ext) {
    case ".ai":
    case ".apng":
    case ".bmp":
    case ".emf":
    case ".eps":
    case ".gif":
    case ".heic":
    case ".ico":
    case ".jpg":
    case ".jpeg":
    case ".png":
    case ".psd":
    case ".svg":
    case ".tif":
    case ".tiff":
    case ".webp":
    case ".wmf":
      return true;
    default:
      return false;
  }
}

export function isWebImage(path: string) {
  // see https://developer.mozilla.org/en-US/docs/Web/Media/Formats/Image_types
  const ext = getExtension(path);
  switch (ext) {
    case ".apng":
    case ".bmp":
    case ".gif":
    case ".ico":
    case ".jpg":
    case ".jpeg":
    case ".png":
    case ".svg":
    case ".webp":
      return true;
    default:
      return false;
  }
}

export function isBitmap(path: string) {
  const ext = getExtension(path);

  switch (ext) {
    case ".bmp":
    case ".gif":
    case ".ico":
    case ".jpg":
    case ".jpeg":
    case ".png":
    case ".tif":
    case ".tiff":
      return true;
    default:
      return false;
  }
}

export function isMetaFile(path: string) {
  const ext = getExtension(path);
  switch (ext) {
    case ".emf":
    case ".wmf":
      return true;
    default:
      return false;
  }
}

export function isVideo(ext: string) {
  switch (ext) {
    case ".3g2":
    case ".asx":
    case ".asf":
    case ".avi":
    case ".flv":
    case ".mk3d":
    case ".mkv":
    case ".mov":
    case ".mp4":
    case ".mpeg":
    case ".mpg":
    case ".ogm":
    case ".ogv":
    case ".ogx":
    case ".qt":
    case ".rm":
    case ".rv":
    case ".smi":
    case ".smil":
    case ".swf":
    case ".webm":
    case ".wmv":
    case ".xaml":
      return true;
    default:
      return false;
  }
}

export function isMarkdown(ext: string) {
  switch (ext) {
    case ".markdown":
    case ".md":
      return true;
    default:
      return false;
  }
}

export function isMarkup(ext: string) {
  switch (ext) {
    case ".htm":
    case ".html":
    case ".xhtml":
    case ".xml":
      return true;
    default:
      return false;
  }
}

export function isCode(ext: string) {
  if (isMarkup(ext)) {
    return true;
  }
  switch (ext) {
    case ".as":
    case ".as3":
    case ".asm":
    case ".aspx":
    case ".bat":
    case ".c":
    case ".cc":
    case ".cmake":
    case ".coffee":
    case ".cpp":
    case ".cs":
    case ".css":
    case ".cxx":
    case ".diff":
    case ".erb":
    case ".erl":
    case ".groovy":
    case ".gvy":
    case ".h":
    case ".haml":
    case ".hh":
    case ".hpp":
    case ".hxx":
    case ".java":
    case ".js":
    case ".json":
    case ".jsx":
    case ".less":
    case ".lst":
    case ".m":
    case ".make":
    case ".ml":
    case ".mm":
    case ".out":
    case ".patch":
    case ".php":
    case ".pl":
    case ".plist":
    case ".properties":
    case ".py":
    case ".rb":
    case ".sass":
    case ".scala":
    case ".scm":
    case ".script":
    case ".scss":
    case ".sh":
    case ".sml":
    case ".sql":
    case ".vb":
    case ".vi":
    case ".vim":
    case ".xsd":
    case ".xsl":
    case ".yaml":
    case ".yml":
      return true;
    default:
      return false;
  }
}

export function isText(ext: string) {
  if (isCode(ext) || isMarkdown(ext)) {
    return true;
  }
  switch (ext) {
    case ".txt":
      return true;
    default:
      return false;
  }
}
export function isOfficeDocument(path: string) {
  const ext = getExtension(path);

  switch (ext) {
    case ".doc":
    case ".docm":
    case ".docx":
    case ".dotm":
    case ".dotx":
    case ".ppt":
    case ".pptm":
    case ".pptx":
    case ".potx":
    case ".xls":
    case ".xlsm":
    case ".xlsx":
    case ".xltx":
      return true;
    default:
      return false;
  }
}

export function getIcon(name: string): { icon: string; color?: string } {
  const ext = getExtension(name);

  if (ext === "") return { icon: "file" };

  if (isAudio(ext)) {
    return { icon: "file-music", color: "indigo" };
  } else if (isImage(ext)) {
    return { icon: "file-image", color: "cyan" };
  } else if (isVideo(ext)) {
    return { icon: "file-video", color: "pink" };
  } else if (isMarkup(ext)) {
    return { icon: "file-xml", color: "purple" };
  } else if (isCode(ext)) {
    return { icon: "file-code", color: "purple" };
  } else if (isText(ext)) {
    return { icon: "file-document" };
  } else {
    switch (ext) {
      case ".7z":
      case ".zip":
        return { icon: "file-compressed", color: "orange" };
      case ".doc":
      case ".docm":
      case ".docx":
      case ".dotm":
      case ".dotx":
        return { icon: "file-word", color: "native" };
      case ".eml":
      case ".msg":
        return { icon: "email", color: "" };
      case ".xls":
      case ".xlsm":
      case ".xlsx":
      case ".xltx":
        return { icon: "file-excel", color: "native" };
      case ".pdf":
        return { icon: "file-pdf", color: "native" };
      case ".ppt":
      case ".pptm":
      case ".pptx":
      case ".potx":
        return { icon: "file-powerpoint", color: "native" };
      case ".pages":
        return { icon: "file", color: "orange" };
      case ".numbers":
        return { icon: "file", color: "green" };
      case ".keynote":
        return { icon: "file", color: "blue" };
    }
  }

  // fallback
  return { icon: "file" };
}

/**
 * Returns preview formats that can be rendered directly in the browser
 *
 * @param {string} name - Name of the file
 * @returns PreviewFormatType
 */
export function getWebPreviewFormat(name: string): PreviewFormatType {
  const ext = getExtension(name);

  if (ext === "") return "none";

  // TODO: Handle embed?

  if (isWebImage(ext)) {
    return "image";
  } else if (isCode(ext)) {
    return "code";
  } else if (isText(ext)) {
    return "text";
  } else if (isAudio(ext)) {
    return "audio";
  } else if (isVideo(ext)) {
    return "video";
  }

  return "none";
}

export function getProvider(provider: string | undefined): ProviderType | "" {
  switch (provider) {
    case "Google Drive":
      return "google-drive";
    case "Dropbox":
      return "dropbox";
    case "OneDrive":
      return "onedrive";
    case "Box":
      return "box";
    default:
      return "";
  }
}

export function getKind(name: string): FileKindType {
  let kind: FileKindType = "file";
  const ext = getExtension(name);

  switch (ext) {
    case ".7z":
    case ".zip":
      kind = "archive";
      break;
    case ".aac":
    case ".aif":
    case ".aiff":
    case ".au":
    case ".gsm":
    case ".m4a":
    case ".mid":
    case ".midi":
    case ".mka":
    case ".mp3":
    case ".oga":
    case ".ogg":
    case ".ra":
    case ".ram":
    case ".snd":
    case ".spx":
    case ".wav":
    case ".wma":
      kind = "audio";
      break;
    case ".c":
    case ".cgi":
    case ".cpp":
    case ".cs":
    case ".cshtml":
    case ".css":
    case ".html":
    case ".java":
    case ".js":
    case ".json":
    case ".less":
    case ".php":
    case ".pl":
    case ".ps1":
    case ".py":
    case ".rb":
    case ".rs":
    case ".scss":
    case ".sh":
    case ".swift":
    case ".sql":
    case ".ts":
    case ".xml":
    case ".yaml":
    case ".yml":
      kind = "code";
      break;
    case ".doc":
    case ".docm":
    case ".docx":
    case ".dotm":
    case ".dotx":
    case ".gdoc":
    case ".pages":
    case ".pdf":
      kind = "document";
      break;
    case ".eml":
    case ".msg":
      kind = "email";
      break;
    case ".gslides":
    case ".keynote":
    case ".ppt":
    case ".pptm":
    case ".pptx":
    case ".potx":
      kind = "presentation";
      break;
    case ".gsheet":
    case ".numbers":
    case ".xls":
    case ".xlsm":
    case ".xlsx":
    case ".xltx":
      kind = "spreadsheet";
      break;
    case ".ai":
    case ".apng":
    case ".bmp":
    case ".emf":
    case ".eps":
    case ".gif":
    case ".heic":
    case ".ico":
    case ".jpg":
    case ".jpeg":
    case ".png":
    case ".psd":
    case ".svg":
    case ".tif":
    case ".tiff":
    case ".webp":
    case ".wmf":
      kind = "image";
      break;
    case ".md":
    case ".markdown":
    case ".txt":
      kind = "text";
      break;
    case ".3g2":
    case ".asx":
    case ".asf":
    case ".avi":
    case ".flv":
    case ".mk3d":
    case ".mkv":
    case ".mov":
    case ".mp4":
    case ".mpeg":
    case ".mpg":
    case ".ogm":
    case ".ogv":
    case ".ogx":
    case ".qt":
    case ".rm":
    case ".rv":
    case ".smi":
    case ".smil":
    case ".swf":
    case ".webm":
    case ".wmv":
    case ".xaml":
      kind = "video";
      break;
  }

  return kind;
}

export function handleSelectFilename(e: Event) {
  const target = e.target as HTMLInputElement | null;
  const i = target?.value.lastIndexOf(".");
  if (i === -1) {
    target?.select();
  } else {
    target?.setSelectionRange(0, i!);
  }
}