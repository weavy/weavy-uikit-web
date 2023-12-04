"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.openUrl = void 0;
const child_process_1 = require("child_process");
const openCmd = process.platform === 'darwin'
    ? 'open'
    : process.platform === 'win32'
        ? 'start'
        : 'xdg-open';
function openUrl(url) {
    (0, child_process_1.exec)(`${openCmd} ${url}`);
}
exports.openUrl = openUrl;
