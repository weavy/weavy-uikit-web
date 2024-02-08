export type HttpMethodType = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export type HttpUploadMethodType = "POST" | "PUT" | "PATCH";

export enum HeaderContentType {
    JSON = "application/json;charset=utf-8",
    FormData = "multipart/form-data;charset=utf-8",
    URLEncoded = "application/x-www-form-urlencoded;charset=utf-8",
    Text = "text/plain;charset=utf-8",
    Auto = "",
}
