import { PermissionType } from "../types/app.types";

export const hasPermission = (permission: PermissionType, permissions?: PermissionType[]) => {  
  if (permission && permissions && permissions.indexOf(permission) !== -1) {
    return true;
  }
  return false;
};