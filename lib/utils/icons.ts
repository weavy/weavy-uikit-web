import * as mdi from "@mdi/js"
import { FileActionType } from "../types/files.types"

export const defaultIcon = mdi.mdiSelect

// Custom mapping to MDI instead of symbols
export const iconMapping: { [index: string]: string } = {
  "shield-star": mdi.mdiShieldStar,
  "account-minus": mdi.mdiAccountMinus,
  "account-plus": mdi.mdiAccountPlus,
  "alert": mdi.mdiAlert,
  "alert-circle": mdi.mdiAlertCircle,
  "alert-octagon": mdi.mdiAlertOctagon,
  "attachment": mdi.mdiAttachment,
  "back": mdi.mdiArrowLeft,
  "backup-restore": mdi.mdiBackupRestore,
  "bell": mdi.mdiBell,
  "bell-off": mdi.mdiBellOff,
  "check": mdi.mdiCheck,
  "check-circle-outline": mdi.mdiCheckCircleOutline,  
  "checkbox-blank": mdi.mdiCheckboxBlankOutline,
  "checkbox-marked": mdi.mdiCheckboxMarkedOutline,
  "circle-outline": mdi.mdiCircleOutline,
  "check-circle": mdi.mdiCheckCircle,
  "close": mdi.mdiClose,
  "close-circle": mdi.mdiCloseCircle,
  "comment": mdi.mdiComment,
  "comment-outline": mdi.mdiCommentOutline,
  "content-save": mdi.mdiContentSave,
  "delete": mdi.mdiDelete,
  "delete-restore": mdi.mdiDeleteRestore,
  "delete-forever": mdi.mdiDeleteForever,
  "dots-vertical": mdi.mdiDotsVertical,
  "download": mdi.mdiDownload,
  "emoticon-plus": "M 19 0 L 19 3 L 16 3 L 16 5 L 19 5 L 19 8 L 21 8 L 21 5 L 24 5 L 24 3 L 21 3 L 21 0 L 19 0 z M 12 2 C 6.5 2 2 6.5 2 12 C 2 17.5 6.5 22 12 22 C 17.5 22 22 17.5 22 12 L 20 12 C 20 16.4 16.4 20 12 20 C 7.6 20 4 16.4 4 12 C 4 7.6 7.6 4 12 4 L 12 2 z M 8.5 8 C 7.7 8 7 8.7 7 9.5 C 7 10.3 7.7 11 8.5 11 C 9.3 11 10 10.3 10 9.5 C 10 8.7 9.3 8 8.5 8 z M 15.5 8 C 14.7 8 14 8.7 14 9.5 C 14 10.3 14.7 11 15.5 11 C 16.3 11 17 10.3 17 9.5 C 17 8.7 16.3 8 15.5 8 z M 6.9 14 C 7.7 16 9.7 17.5 12 17.5 C 14.3 17.5 16.3 16 17.1 14 L 6.9 14 z",
  "fit-screen": mdi.mdiFitToScreen,
  "fit-width": mdi.mdiFitToPage,
  "help-circle": mdi.mdiHelpCircle,
  "information": mdi.mdiInformationOutline,    
  "magnify": mdi.mdiMagnify,
  "menu-down": mdi.mdiMenuDown,
  "menu-up": mdi.mdiMenuUp,
  "minus": mdi.mdiMinus,
  "next": mdi.mdiArrowRight,
  "open-in-new": mdi.mdiOpenInNew,
  "pencil": mdi.mdiPencil,
  "pin": mdi.mdiPin,
  "unpin": mdi.mdiPinOff,
  "plus": mdi.mdiPlus,
  "plus-circle-outline": mdi.mdiPlusCircleOutline,
  "poll": mdi.mdiChartBox,
  "previous": mdi.mdiArrowLeft,
  "read": mdi.mdiMessageBadge,
  "restore": mdi.mdiRestore,
  "unread": mdi.mdiCheck,
  "send": mdi.mdiSend,
  "server-network-off": mdi.mdiServerNetworkOff,
  "sort": mdi.mdiSort,
  "star": mdi.mdiStar,
  "unstar": mdi.mdiStarOff,
  "swap-horizontal": mdi.mdiSwapHorizontal,
  "textbox": mdi.mdiFormTextbox,
  "thumb-up": mdi.mdiThumbUp,
  "thumb-up-outline": mdi.mdiThumbUpOutline,
  "trashcan": mdi.mdiTrashCan,
  "video": mdi.mdiVideo,
  "view-list-outline": mdi.mdiViewListOutline,
  "view-module-outline": mdi.mdiViewModuleOutline,
  "wifi-off": mdi.mdiWifiOff,
  // Files
  "email": mdi.mdiEmail,
  "file": mdi.mdiFile,
  "file-upload": mdi.mdiFileUpload,
  "file-music": mdi.mdiFileMusic,
  "file-image": mdi.mdiFileImage,
  "file-video": mdi.mdiFileVideo,
  "file-code": mdi.mdiFileCode,
  "file-xml": mdi.mdiFileCode,
  "file-document": mdi.mdiFileDocument,
  "file-word": mdi.mdiFileWord,
  "file-excel": mdi.mdiFileExcel,
  "file-pdf": mdi.mdiFileDocument,
  "file-powerpoint": mdi.mdiFilePowerpoint,
  "file-compressed": mdi.mdiFolderZip,
  // Providers
  "dropbox": mdi.mdiDropbox,
  "onedrive": mdi.mdiMicrosoftOnedrive,
  "box": mdi.mdiBox,
  "google-drive": mdi.mdiGoogleDrive,
  "zoom": "m12 2c-5.6 0-10 4.5-10 10 0 5.6 4.5 10 10 10 5.5 0 9.9-4.5 9.9-10 .1-5.6-4.4-10-9.9-10zm2.6 13.1c0 .2-.1.3-.3.3h-6.9c-1.1 0-1.9-.8-1.9-1.9v-4.6c0-.2.1-.3.3-.3h6.9c1 0 1.9.8 1.9 1.9zm3.8.1c0 .4-.2.4-.5.2l-2.8-2.1v-2.6l2.8-2.1c.2-.2.5-.1.5.2z",
  "cloud": mdi.mdiCloud
}

export const fileActionIconMapping: { [index in FileActionType]: string } = {
  "attach": mdi.mdiAttachment,
  "create": mdi.mdiPlus,
  "delete-forever": mdi.mdiDeleteForever,
  "edit": mdi.mdiPencil,
  "modify": mdi.mdiPencil,
  "rename": mdi.mdiCursorText,
  "replace": mdi.mdiSwapVertical,
  "restore": mdi.mdiRestore,
  "subscribe":mdi.mdiBell,
  "trash": mdi.mdiDelete,
  "unsubscribe": mdi.mdiBellOff,
  "upload": mdi.mdiUpload,
  "version": mdi.mdiHistory
}

export const nativeColors: { [index: string]: string } = {
  "dropbox": "#0061fe",
  "onedrive": "#0078d4",
  "box": "#0161d5",
  "google-drive": "#1a73e8",
  "zoom": "#4a8cff"
}

export function getIconName(name: string) {
  return name.split("+")
}

export function getIconMapping(name?: string) {
  return name && name in iconMapping ? iconMapping[name] : ""
}

export function getFileActionIconMapping(action?: FileActionType) {
  return action && action in fileActionIconMapping ? fileActionIconMapping[action] : ""
}
