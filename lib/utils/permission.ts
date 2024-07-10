import { PermissionTypes } from "../types/app.types";

export const hasPermission = (permission: PermissionTypes, permissions?: PermissionTypes[]) => {  
  if (permission && permissions && permissions.indexOf(permission) !== -1) {
    return true;
  }
  return false;
};