import { PermissionType } from "../types/app.types";

/**
 * Check if a permission is present in the given permission list
 * 
 * @param permission - The permission to check
 * @param appPermissions - The list of given permissions.
 * @returns Whether the permission is enabled
 */
export function hasPermission(permission: PermissionType, appPermissions?: PermissionType[]) {  
  if (permission && appPermissions && appPermissions.indexOf(permission) !== -1) {
    return true;
  }
  return false;
};

/**
 * Checks if one of the given permissions are present in the given permission list.
 * 
 * @param permissions - A list of permissions to check for. 
 * @param appPermissions - The list of given permissions.
 * @returns Whether any permission is given.
 */
export function hasAnyPermission(permissions: PermissionType[], appPermissions?: PermissionType[]) {
  return permissions.some((permission) => hasPermission(permission, appPermissions))
}