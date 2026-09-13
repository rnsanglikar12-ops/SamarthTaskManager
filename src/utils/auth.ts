// Role-Based Access Control for Samarth Industries
// Replaces the old link/password based model in the removed security.ts

import { ActionItem } from '../types';

export type Role = 'Viewer' | 'DeptHead' | 'PlantHead' | 'MD' | 'Admin';

export interface AuthUser {
  username: string;
  displayName: string;
  role: Role;
  department: string | null; // null = plant-wide (PlantHead / MD / Admin)
  mustChangePassword: boolean;
}

export type Permission =
  | 'view'
  | 'createTask'
  | 'editOwnDept'
  | 'editAnyDept'
  | 'reviseDeadline'
  | 'deleteTask'
  | 'manageUsers';

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  Viewer: ['view'],
  DeptHead: ['view', 'createTask', 'editOwnDept'],
  PlantHead: ['view', 'createTask', 'editOwnDept', 'editAnyDept', 'reviseDeadline', 'deleteTask'],
  MD: ['view', 'createTask', 'editOwnDept', 'editAnyDept', 'reviseDeadline', 'deleteTask'],
  Admin: ['view', 'createTask', 'editOwnDept', 'editAnyDept', 'reviseDeadline', 'deleteTask', 'manageUsers'],
};

type ScopedTask = Pick<ActionItem, 'dept' | 'originatorDept'>;

// A task is "in scope" for a department-scoped user if their department either
// owns it or raised it to another department (mirrors the existing CFT Handshake
// concept — isRaisedToOtherDept / originatorDept — so a DeptHead never loses
// visibility into tasks their own department raised elsewhere).
export function isDeptInScope(user: AuthUser, task: ScopedTask): boolean {
  if (!user.department) return true; // plant-wide role
  return task.dept === user.department || task.originatorDept === user.department;
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
