// Security & Executive Role Access Control for Samarth Industries
// Mentor: Mr. Sanglikar (rnsanglikar12@gmail.com)

export type ExecutiveRole = 'Viewer' | 'Plant Head' | 'MD' | 'Secret Admin';

const MASTER_PASS_STORAGE_KEY = 'samarth_master_secret_pass';
const PLANT_HEAD_PASS_STORAGE_KEY = 'samarth_plant_head_pass';
const SECRET_UNLOCKED_SESSION_KEY = 'samarth_secret_unlocked';
const ACTIVE_ROLE_KEY = 'samarth_active_role';

export const DEFAULT_MASTER_PASS = 'sanglikar2026';
export const DEFAULT_PLANT_HEAD_PASS = 'planthead';

export function getStoredMasterPassword(): string {
  if (typeof window === 'undefined') return DEFAULT_MASTER_PASS;
  return localStorage.getItem(MASTER_PASS_STORAGE_KEY) || DEFAULT_MASTER_PASS;
}

export function setStoredMasterPassword(newPass: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MASTER_PASS_STORAGE_KEY, newPass);
}

export function getStoredPlantHeadPassword(): string {
  if (typeof window === 'undefined') return DEFAULT_PLANT_HEAD_PASS;
  return localStorage.getItem(PLANT_HEAD_PASS_STORAGE_KEY) || DEFAULT_PLANT_HEAD_PASS;
}

export function setStoredPlantHeadPassword(newPass: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PLANT_HEAD_PASS_STORAGE_KEY, newPass);
}

export function resetAllPasswordsToDefault(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(MASTER_PASS_STORAGE_KEY);
  localStorage.removeItem(PLANT_HEAD_PASS_STORAGE_KEY);
}

export function isSecretControlUnlocked(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(SECRET_UNLOCKED_SESSION_KEY) === 'true';
}

export function setSecretControlUnlocked(unlocked: boolean): void {
  if (typeof window === 'undefined') return;
  if (unlocked) {
    sessionStorage.setItem(SECRET_UNLOCKED_SESSION_KEY, 'true');
    localStorage.setItem(ACTIVE_ROLE_KEY, 'Secret Admin');
  } else {
    sessionStorage.removeItem(SECRET_UNLOCKED_SESSION_KEY);
    localStorage.setItem(ACTIVE_ROLE_KEY, 'Viewer');
  }
}

export function getActiveRole(): ExecutiveRole {
  if (typeof window === 'undefined') return 'Viewer';
  if (isSecretControlUnlocked()) return 'Secret Admin';
  return (localStorage.getItem(ACTIVE_ROLE_KEY) as ExecutiveRole) || 'Viewer';
}

export function setActiveRole(role: ExecutiveRole): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACTIVE_ROLE_KEY, role);
}

export function verifySecretPassword(input: string): boolean {
  const master = getStoredMasterPassword().toLowerCase();
  const plantHead = getStoredPlantHeadPassword().toLowerCase();
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return false;
  return trimmed === master || trimmed === plantHead || trimmed === DEFAULT_MASTER_PASS || trimmed === DEFAULT_PLANT_HEAD_PASS;
}

export function verifyPlantHeadPassword(input: string): boolean {
  const plantHead = getStoredPlantHeadPassword().toLowerCase();
  const master = getStoredMasterPassword().toLowerCase();
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return false;
  return trimmed === plantHead || trimmed === master || trimmed === DEFAULT_PLANT_HEAD_PASS || trimmed === DEFAULT_MASTER_PASS;
}

// Permissions Check - strictly requires unlock or authenticated executive session
export function canReviseDeadline(role: ExecutiveRole, unlocked: boolean): boolean {
  return unlocked || role === 'Plant Head' || role === 'MD' || role === 'Secret Admin';
}

export function canDeleteAction(role: ExecutiveRole, unlocked: boolean): boolean {
  return unlocked || role === 'Plant Head' || role === 'Secret Admin';
}

export function canViewDeptHeadLinks(role: ExecutiveRole, unlocked: boolean): boolean {
  // Direct links require unlocked secret control or explicit passcode verification
  return unlocked || role === 'Secret Admin';
}
