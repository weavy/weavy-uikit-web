import { AccessType, PermissionType } from "../types/app.types";

export const hasAccess = (requiredAccess: AccessType, appAccess: AccessType, permissions?: PermissionType[]) => {  
  if(requiredAccess === AccessType.Read && (permissions?.indexOf(PermissionType.Read) != -1 || permissions?.indexOf(PermissionType.Create) != -1)) return true;
  if(requiredAccess === AccessType.Write && permissions?.indexOf(PermissionType.Create) != -1) return true;
  if(requiredAccess === AccessType.Admin && permissions?.indexOf(PermissionType.Admin) != -1) return true;

  return false;
};
