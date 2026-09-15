// Role-Based Access Control for Samarth Industries
// Replaces the old link/password based model in the removed security.ts

import { ActionItem } from '../types';

export type Role = 'Viewer' | 'DeptHead' | 'PlantHead' | 'MD' | 'Admin';

export interface AuthUser {
  username: string;
  displayName: string;
  role: Role;
  departments: string[] | null; // null = plant-wide (PlantHead / MD / Admin); 1+ entries for DeptHead/Viewer — one person can head multiple departments
  mustChangePassword: boolean;
}

export type Permission =
  | 'view'
  | 'createTask'
  | 'editOwnDept'
  | 'editAnyDept'
  | 'reviseDeadline'
  | 'deleteTask'
  | 'manageUsers'
  | 'manageSupervisors'
  | 'exportData'
  | 'bulkDeleteCompleted';

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  Viewer: ['view'],
  DeptHead: ['view', 'createTask', 'editOwnDept', 'manageSupervisors'],
  PlantHead: ['view', 'createTask', 'editOwnDept', 'editAnyDept', 'reviseDeadline', 'deleteTask', 'manageSupervisors', 'exportData'],
  MD: ['view', 'createTask', 'editOwnDept', 'editAnyDept', 'reviseDeadline', 'deleteTask', 'manageSupervisors', 'exportData'],
  Admin: ['view', 'createTask', 'editOwnDept', 'editAnyDept', 'reviseDeadline', 'deleteTask', 'manageUsers', 'manageSupervisors', 'exportData', 'bulkDeleteCompleted'],
};

type ScopedTask = Pick<ActionItem, 'dept' | 'originatorDept'>;

// A task is "in scope" for a department-scoped user if any of their
// departments either owns it or raised it to another department (mirrors the
// existing CFT Handshake concept — isRaisedToOtherDept / originatorDept — so
// a DeptHead never loses visibility into tasks their own department raised
// elsewhere). A user can be scoped to multiple departments (e.g. one person
// heading several depts), so this checks membership, not equality.
export function isDeptInScope(user: AuthUser, task: ScopedTask): boolean {
  if (!user.departments) return true; // plant-wide role
  return user.departments.includes(task.dept) || user.departments.includes(task.originatorDept);
}

export function can(user: AuthUser | null, permission: Permission, task?: ScopedTask): boolean {
  if (!user) return false;
  const perms = ROLE_PERMISSIONS[user.role];
  if (!perms.includes(permission)) return false;
  if (permission === 'editOwnDept' && task && !isDeptInScope(user, task)) {
    return perms.includes('editAnyDept');
  }
  return true;
}

const SESSION_KEY = 'samarth_auth_session';

export function getSession(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setSession(user: AuthUser): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(SESSION_KEY);
}

// Passwords are never sent or stored in plaintext — the Apps Script "Users" tab
// only ever sees this hash, since its endpoint is technically public.
export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
