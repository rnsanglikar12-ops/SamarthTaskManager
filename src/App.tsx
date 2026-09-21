import React, { useState, useMemo, useEffect, useCallback, Suspense, lazy } from 'react';
import { ActionItem, FilterState, SentinelStats, ActionStatus } from './types';
import {
  getInitialActions,
  saveActionsToStorage,
  isRaisedToOtherDept,
  isKaizenAction,
  getTodayStr
} from './data/sentinelDataLoader';
import {
  subscribeToTabBroadcast,
  broadcastLocalUpdate
} from './utils/syncService';
import { TASK_DEPARTMENTS, getDefaultAssignee } from './data/orgStructure';
import { Header, NavTab } from './components/Header';
import { StatsOverview } from './components/StatsOverview';
// Lazy-loaded: recharts (its only consumer) is a meaningful chunk of the
// bundle, and Cockpit isn't the default tab (Master Matrix is) — no reason
// to make every page load pay for it before the user ever visits Cockpit.
const AnalyticsView = lazy(() => import('./components/AnalyticsView').then((m) => ({ default: m.AnalyticsView })));
import { ActionRegisterView } from './components/ActionRegisterView';
import { DepartmentDirectoryView } from './components/DepartmentDirectoryView';
import { KaizenHubView } from './components/KaizenHubView';
import { ActionDetailModal } from './components/ActionDetailModal';
import { NewActionModal } from './components/NewActionModal';
import { UserManagementModal } from './components/UserManagementModal';
import { SupervisorManagementModal } from './components/SupervisorManagementModal';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { BulkDeleteCompletedModal } from './components/BulkDeleteCompletedModal';
import { LoginScreen } from './components/LoginScreen';
import {
  isGoogleSheetConnected,
  updateActionInGoogleSheet,
  createActionInGoogleSheet,
  deleteActionInGoogleSheet,
  fetchActionsFromGoogleSheet,
  fetchSupervisors,
  subscribeToTaskChanges,
  deleteCompletedTasksBefore,
  fetchPhotoDriveLinks,
  savePhotoDriveLinks,
  PhotoDriveLinks,
  Supervisor
} from './utils/dataService';
import { exportActionsToCsv, ExportRow } from './utils/exportUtils';
import { archivePhotoToDrive, runWithConcurrency } from './utils/driveArchive';
import { AuthUser, can, isDeptInScope, getSession, setSession as persistSession, clearSession } from './utils/auth';
import { CheckCircle2, Calendar, RotateCw, Users, Crown, Lock } from 'lucide-react';

export default function App() {
  const [session, setSession] = useState<AuthUser | null>(() => getSession());
  const [actions, setActions] = useState<ActionItem[]>(() => getInitialActions());
  // Default to 'matrix' (Master Matrix) to match the provided screenshot
  const [activeTab, setActiveTab] = useState<NavTab>('matrix');
  const [selectedAction, setSelectedAction] = useState<ActionItem | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState<boolean>(false);
  const [isUserMgmtModalOpen, setIsUserMgmtModalOpen] = useState<boolean>(false);
  const [isSupervisorMgmtModalOpen, setIsSupervisorMgmtModalOpen] = useState<boolean>(false);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState<boolean>(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Department scoping is derived directly from the signed-in session — there
  // is no more URL-param or password-bypass path to acquire a locked dept.
  // One person can head multiple departments, so this is a set, not a single
  // value; null means plant-wide (PlantHead/MD/Admin).
  const lockedDepts = session?.departments ?? null;
  const isRestrictedHodMode = lockedDepts !== null;

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  }, []);

  const [filters, setFilters] = useState<FilterState>({
    search: '',
    dept: '',
    priority: '',
    status: '',
    owner: '',
    recurrence: '',
    originator: '',
    onlyKaizen: false,
    onlyOverdue: false,
    onlyBroadcast: false
  });

  // Bulletproof filter updater: rejects any attempt to filter to a department
  // outside the signed-in user's own set (visibleActions is already scoped by
  // isDeptInScope, so leaving filters.dept at '' shows the union of all their
  // departments — no need to force a specific one, even for multi-dept users).
  const setGuardedFilters = useCallback((updater: React.SetStateAction<FilterState>) => {
    setFilters(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (lockedDepts && next.dept && !lockedDepts.includes(next.dept)) {
        return prev;
      }
      return next;
    });
  }, [lockedDepts]);

  // Shared guard for any UI action that tries to switch the department view:
  // plant-wide users (lockedDepts === null) can go anywhere; dept-scoped
  // users (possibly heading several departments) are limited to their own set.
  const guardDeptSelect = useCallback((dept: string): boolean => {
    if (lockedDepts && dept && !lockedDepts.includes(dept)) {
      showToast(`Access Restricted: ${dept} is not one of your assigned departments.`);
      return false;
    }
    return true;
  }, [lockedDepts, showToast]);

  const handleLogout = useCallback(() => {
    clearSession();
    setSession(null);
    setFilters(prev => ({ ...prev, dept: '' }));
  }, []);

  // Supervisors (name-only, department-scoped assignee options) — fetched
  // once alongside tasks below, and re-fetched after an add/remove via
  // SupervisorManagementModal's onSupervisorsChanged callback.
  const loadSupervisors = useCallback(async () => {
    if (!isGoogleSheetConnected()) return;
    try {
      const fresh = await fetchSupervisors();
      setSupervisors(fresh || []);
    } catch (err) {
      console.warn('Failed to load supervisors:', err);
    }
  }, []);

  // Task data loading: fetched once when the page opens, and again only when
  // the user explicitly clicks Refresh (handleRefresh) — no background
  // polling. Cross-tab propagation of THIS tab's own edits (via
  // BroadcastChannel/localStorage) still applies instantly and costs no
  // network request, since it's just relaying data this tab already has.
  useEffect(() => {
    let isMounted = true;

    (async () => {
      if (!isGoogleSheetConnected()) return;
      // A single failed attempt isn't necessarily a real outage — retry once
      // before giving up. On a brand-new device (no localStorage cache) a
      // silently-swallowed failure here used to leave the whole dashboard
      // looking permanently empty, with nothing telling the user a retry
      // might fix it.
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const fresh = await fetchActionsFromGoogleSheet();
          // An empty database is a valid state (e.g. right after a reset) —
          // just show zero tasks rather than seeding it with anything.
          if (isMounted) {
            setActions(fresh || []);
            saveActionsToStorage(fresh || []);
          }
          return;
        } catch (err) {
          console.warn(`Backend sync failed (attempt ${attempt + 1}/2):`, err);
          if (attempt === 0) {
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        }
      }
      if (isMounted) {
        showToast('Could not load the latest data — showing cached data if available. Click Refresh to try again.');
      }
    })();

    loadSupervisors();

    // Instant cross-tab messaging via BroadcastChannel (local relay only)
    const unsubscribeBroadcast = subscribeToTabBroadcast((data) => {
      if (data.type === 'UPDATE' && data.payload) {
        const item: ActionItem = data.payload;
        setActions(prev => {
          const idx = prev.findIndex(a => a.id === item.id);
          const next = idx >= 0 ? [...prev] : [item, ...prev];
          if (idx >= 0) next[idx] = item;
          saveActionsToStorage(next);
          return next;
        });
      } else if (data.type === 'DELETE' && data.payload?.id) {
        const delId = data.payload.id;
        setActions(prev => {
          const next = prev.filter(a => a.id !== delId);
          saveActionsToStorage(next);
          return next;
        });
      }
    });

    // Cross-tab localStorage event listener (local relay only)
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === 'samarth_industries_matrix_v4' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setActions(parsed);
          }
        } catch (err) {}
      }
    };
    window.addEventListener('storage', handleStorageEvent);

    // Live push of other clients' task changes, replacing manual-Refresh as
    // the way updates propagate. Same upsert-by-id / filter-by-id merge as
    // the BroadcastChannel handler above — this tab receiving its own writes
    // back over Realtime is harmless (idempotent).
    const unsubscribeRealtime = subscribeToTaskChanges((event) => {
      if (event.type === 'INSERT' || event.type === 'UPDATE') {
        const item = event.row as ActionItem;
        setActions(prev => {
          const idx = prev.findIndex(a => a.id === item.id);
          const next = idx >= 0 ? [...prev] : [item, ...prev];
          if (idx >= 0) next[idx] = item;
          saveActionsToStorage(next);
          return next;
        });
      } else if (event.type === 'DELETE') {
        const delId = event.row.id;
        setActions(prev => {
          const next = prev.filter(a => a.id !== delId);
          saveActionsToStorage(next);
          return next;
        });
      }
    });

    return () => {
      isMounted = false;
      unsubscribeBroadcast();
      unsubscribeRealtime();
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, []);

  // Every view is scoped to what the signed-in user is actually allowed to see:
  // plant-wide roles (PlantHead/MD/Admin) see everything, department-scoped
  // roles (DeptHead/Viewer) see tasks their department owns OR raised to
  // another department (handshake visibility in both directions).
  const visibleActions = useMemo(() => {
    if (!session || !session.departments) return actions;
    return actions.filter(a => isDeptInScope(session, a));
  }, [actions, session]);

  // Compute live KPI stats
  const stats: SentinelStats = useMemo(() => {
    let completed = 0;
    let inProcess = 0;
    let pending = 0;
    let underVerification = 0;
    let onHold = 0;
    let criticalPriorityA = 0;
    let standardPriorityB = 0;
    let kaizenCount = 0;
    let overdueCount = 0;

    const today = getTodayStr();

    visibleActions.forEach(a => {
      if (a.status === 'Completed') completed++;
      else if (a.status === 'In process') inProcess++;
      else if (a.status === 'Under Verification') underVerification++;
      else if (a.status === 'Hold') onHold++;
      else pending++;

      if (a.priority === 'A') criticalPriorityA++;
      else standardPriorityB++;

      if (isKaizenAction(a)) kaizenCount++;

      if (a.status !== 'Completed' && a.deadline && a.deadline <= today) {
        overdueCount++;
      }
    });

    const total = visibleActions.length;
    const complianceRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      totalActions: total,
      completed,
      inProcess,
      pending,
      underVerification,
      onHold,
      criticalPriorityA,
      standardPriorityB,
      overdueCount,
      complianceRate,
      kaizenCount
    };
  }, [visibleActions]);

  // Update status directly & sync across links
  const handleUpdateStatus = useCallback(async (id: string, newStatus: ActionStatus): Promise<boolean> => {
    const target = actions.find(a => a.id === id);
    if (!target || !can(session, 'editOwnDept', target)) {
      showToast('Access denied: you do not have permission to update this task.');
      return false;
    }
    let updatedItem: ActionItem | null = null;
    setActions(prev => {
      const next = prev.map(item => {
        if (item.id === id) {
          updatedItem = { ...item, status: newStatus };
          return updatedItem;
        }
        return item;
      });
      saveActionsToStorage(next);
      return next;
    });
    if (updatedItem) {
      broadcastLocalUpdate('UPDATE', updatedItem);
      if (isGoogleSheetConnected()) {
        const photoLinks = await updateActionInGoogleSheet(updatedItem);
        if (!photoLinks) {
          showToast(`Task #${id} updated locally but failed to sync — please retry.`);
          return false;
        }
        // The backend may have converted a base64 photo into a canonical
        // Drive link — replace local state with it so the image actually
        // renders (a raw Drive viewer-page URL isn't embeddable as <img>).
        if (photoLinks.attachedPhoto !== updatedItem.attachedPhoto || photoLinks.afterPhoto !== updatedItem.afterPhoto) {
          const finalItem = { ...updatedItem, ...photoLinks };
          setActions(prev => {
            const next = prev.map(item => item.id === id ? finalItem : item);
            saveActionsToStorage(next);
            return next;
          });
        }
      }
    }
    showToast(`Task #${id} status changed to "${newStatus}" & synced`);
    return true;
  }, [actions, session, showToast]);

  // Delete item (Plant Head / MD / Admin authority only) & sync across links
  const handleDeleteAction = useCallback(async (id: string): Promise<boolean> => {
    if (!can(session, 'deleteTask')) {
      showToast('Access denied: you do not have permission to delete tasks.');
      return false;
    }
    if (isGoogleSheetConnected()) {
      const ok = await deleteActionInGoogleSheet(id);
      if (!ok) {
        showToast(`Failed to delete Task #${id} — sync error. Please try again.`);
        return false;
      }
    }
    setActions(prev => {
      const next = prev.filter(item => item.id !== id);
      saveActionsToStorage(next);
      return next;
    });
    setSelectedAction(null);
    broadcastLocalUpdate('DELETE', { id });
    showToast(`Task #${id} permanently deleted`);
    return true;
  }, [session, showToast]);

  // Save full edited action & sync across links
  const handleSaveAction = useCallback(async (updated: ActionItem): Promise<boolean> => {
    if (!can(session, 'editOwnDept', updated)) {
      showToast('Access denied: you do not have permission to edit this task.');
      return false;
    }
    let finalItem = updated;
    if (isGoogleSheetConnected()) {
      const photoLinks = await updateActionInGoogleSheet(updated);
      if (!photoLinks) {
        showToast(`Failed to save Task #${updated.id} — sync error. Please try again.`);
        return false;
      }
      // Replace any raw base64 photo with the backend's canonical Drive link
      // (a Drive viewer-page URL isn't embeddable as <img>, so without this
      // the photo would render fine here but vanish after the next refresh).
      finalItem = { ...updated, ...photoLinks };
    }
    setActions(prev => {
      const next = prev.map(item => item.id === finalItem.id ? finalItem : item);
      saveActionsToStorage(next);
      return next;
    });
    broadcastLocalUpdate('UPDATE', finalItem);
    showToast(`Task #${updated.id} successfully updated & synced across links`);
    return true;
  }, [session, showToast]);

  // Add new item & sync across links. ID is assigned server-side (atomic,
  // department-prefixed, e.g. "PDC-47") to avoid collisions between
  // concurrent users — see createActionInGoogleSheet.
  const handleAddAction = useCallback(async (newItemData: Omit<ActionItem, 'id'>): Promise<boolean> => {
    if (!can(session, 'createTask')) {
      showToast('Access denied: you do not have permission to create tasks.');
      return false;
    }
    if (!isGoogleSheetConnected()) {
      showToast('Database backend is not configured. Contact your administrator.');
      return false;
    }

    // Broadcast: NewActionModal sends one Omit<ActionItem,'id'> tagged
    // dept: 'All Departments' — that's a placeholder, not a real department,
    // so a task saved with it as-is would never match any DeptHead's actual
    // dept-scoped filter (isDeptInScope compares against real dept names)
    // and would only ever be visible to plant-wide roles. Fan it out into
    // one real, independently-trackable row per department instead — each
    // gets its own dept-prefixed ID and default assignee, same as if it had
    // been created individually for that department.
    if (newItemData.isBroadcast) {
      const results = await Promise.all(
        TASK_DEPARTMENTS.map(deptName =>
          createActionInGoogleSheet({
            ...newItemData,
            dept: deptName,
            owner: getDefaultAssignee(deptName)
          })
        )
      );

      const newItems: ActionItem[] = [];
      results.forEach((created, idx) => {
        if (!created) return;
        newItems.push({
          ...newItemData,
          dept: TASK_DEPARTMENTS[idx],
          owner: getDefaultAssignee(TASK_DEPARTMENTS[idx]),
          id: created.id,
          attachedPhoto: created.attachedPhoto ?? newItemData.attachedPhoto,
          afterPhoto: created.afterPhoto ?? newItemData.afterPhoto
        });
      });

      if (newItems.length === 0) {
        showToast('Failed to broadcast task — sync error. Please try again.');
        return false;
      }

      setActions(prev => {
        const next = [...newItems, ...prev];
        saveActionsToStorage(next);
        return next;
      });
      newItems.forEach(item => broadcastLocalUpdate('UPDATE', item));

      const failedCount = TASK_DEPARTMENTS.length - newItems.length;
      showToast(
        failedCount === 0
          ? `Broadcasted to all ${newItems.length} departments & synced`
          : `Broadcasted to ${newItems.length} of ${TASK_DEPARTMENTS.length} departments — ${failedCount} failed, please retry those separately`
      );
      return true;
    }

    const created = await createActionInGoogleSheet(newItemData);
    if (!created) {
      showToast('Failed to create task — sync error. Please try again.');
      return false;
    }
    // Use the backend's canonical Drive photo links (if any) instead of the
    // raw base64 this modal collected — a Drive viewer-page URL isn't
    // embeddable as <img>, so without this the photo would vanish on refresh.
    const newItem: ActionItem = {
      ...newItemData,
      id: created.id,
      attachedPhoto: created.attachedPhoto ?? newItemData.attachedPhoto,
      afterPhoto: created.afterPhoto ?? newItemData.afterPhoto
    };
    setActions(prev => {
      const next = [newItem, ...prev];
      saveActionsToStorage(next);
      return next;
    });
    broadcastLocalUpdate('UPDATE', newItem);
    showToast(`Created new Action #${created.id} & broadcasted to all links`);
    return true;
  }, [session, showToast]);

  // Every role can export, scoped to what they can see: plant-wide roles get
  // everything, department-scoped users get their own departments' tasks plus
  // CFT tasks raised to/from them (visibleActions, via isDeptInScope) — as a
  // CSV for compliance record-keeping. Photo evidence is archived into
  // Google Drive first (see driveArchive.ts) so the export is independent
  // of Supabase staying up — a cache on the task row (attached/after
  // PhotoDriveLink) means a photo is only ever copied to Drive once, not
  // re-uploaded on every subsequent export.
  const handleExportCsv = useCallback(async () => {
    if (!can(session, 'exportData')) {
      showToast('Access denied: you do not have permission to export data.');
      return;
    }

    const photosToArchive = visibleActions.filter(a => a.attachedPhoto || a.afterPhoto).length;
    if (photosToArchive > 0) {
      showToast(`Preparing export — archiving ${photosToArchive} photo${photosToArchive === 1 ? '' : 's'} to Drive, this may take a minute...`);
    }

    let cached: Record<string, PhotoDriveLinks> = {};
    try {
      cached = await fetchPhotoDriveLinks();
    } catch (err) {
      console.warn('Failed to fetch cached Drive links, archiving fresh for every photo:', err);
    }

    const exportRows: ExportRow[] = new Array(visibleActions.length);
    const newlyCached: { id: string; attachedPhotoDriveLink?: string; afterPhotoDriveLink?: string }[] = [];

    await runWithConcurrency(visibleActions, async (a: ActionItem) => {
      const idx = visibleActions.indexOf(a);
      const existing = cached[a.id] || {};
      let attachedDrive = existing.attachedPhotoDriveLink;
      let afterDrive = existing.afterPhotoDriveLink;

      if (a.attachedPhoto && !attachedDrive) {
        attachedDrive = (await archivePhotoToDrive(a.attachedPhoto, `${a.id}_before.jpg`)) || undefined;
      }
      if (a.afterPhoto && !afterDrive) {
        afterDrive = (await archivePhotoToDrive(a.afterPhoto, `${a.id}_after.jpg`)) || undefined;
      }

      exportRows[idx] = { ...a, attachedPhotoDriveLink: attachedDrive, afterPhotoDriveLink: afterDrive };
      if (attachedDrive !== existing.attachedPhotoDriveLink || afterDrive !== existing.afterPhotoDriveLink) {
        newlyCached.push({ id: a.id, attachedPhotoDriveLink: attachedDrive, afterPhotoDriveLink: afterDrive });
      }
    }, 4);

    if (newlyCached.length > 0) {
      try {
        await savePhotoDriveLinks(newlyCached);
      } catch (err) {
        console.warn('Failed to cache newly-archived Drive links:', err);
      }
    }

    exportActionsToCsv(exportRows, `samarth_compliance_export_${getTodayStr()}.csv`);
    showToast(`Exported ${visibleActions.length} tasks to CSV${photosToArchive > 0 ? ' with Drive-archived photo links' : ''}`);
  }, [session, visibleActions, showToast]);

  // Admin-only bulk cleanup: permanently removes every Completed task
  // created before the given date. Removes the deleted rows from local
  // state directly (same criteria the backend used) rather than refetching.
  const handleDeleteCompletedBefore = useCallback(async (cutoffDate: string): Promise<number> => {
    if (!can(session, 'bulkDeleteCompleted')) {
      showToast('Access denied: you do not have permission to bulk-delete tasks.');
      return 0;
    }
    const deletedCount = await deleteCompletedTasksBefore(cutoffDate);
    setActions(prev => {
      const next = prev.filter(a => !(a.status === 'Completed' && a.timestamp < cutoffDate));
      saveActionsToStorage(next);
      return next;
    });
    showToast(`Permanently deleted ${deletedCount} completed task${deletedCount === 1 ? '' : 's'} created before ${cutoffDate}`);
    return deletedCount;
  }, [session, showToast]);

  // Manual refresh (Header's Refresh button): the only way — besides initial
  // page load — that the app fetches from the backend, now that background
  // polling has been removed. One-directional: backend -> app only. Never
  // pushes local state back, even when the backend comes back empty — an
  // empty result is a valid real state (e.g. right after a reset), not a
  // signal to reseed it with whatever happens to be loaded locally.
  const handleRefresh = useCallback(async () => {
    if (!isGoogleSheetConnected()) {
      showToast('Database backend is not configured. Contact your administrator.');
      return;
    }
    try {
      const fresh = await fetchActionsFromGoogleSheet();
      setActions(fresh || []);
      saveActionsToStorage(fresh || []);
      showToast(`Refreshed — ${fresh?.length ?? 0} records loaded`);
    } catch (err) {
      showToast('Refresh failed — check your connection settings.');
    }
  }, [showToast]);

  // Specific filtered lists for dedicated tabs — all scoped to visibleActions
  const momActions = useMemo(() => visibleActions.filter(a => a.isMOM), [visibleActions]);
  const recurringActions = useMemo(() => visibleActions.filter(a => a.recurrence !== 'One-Time'), [visibleActions]);
  // CFT Handshake: strictly tasks raised to another department only (originatorDept != dept)
  const cftActions = useMemo(() => visibleActions.filter(a => isRaisedToOtherDept(a.originatorDept, a.dept)), [visibleActions]);

  if (!session) {
    return <LoginScreen onLoginSuccess={setSession} />;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-2.5 text-xs font-semibold animate-in slide-in-from-bottom-5 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Header matching image.png */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        totalCount={stats.totalActions}
        completedCount={stats.completed}
        cftCount={cftActions.length}
        momCount={momActions.length}
        recurringCount={recurringActions.length}
        kaizenCount={stats.kaizenCount}
        overdueCount={stats.overdueCount}
        onOpenNewModal={() => setIsNewModalOpen(true)}
        onRefresh={handleRefresh}
        session={session}
        onLogout={handleLogout}
        onOpenUserManagement={() => setIsUserMgmtModalOpen(true)}
        onOpenSupervisorManagement={() => setIsSupervisorMgmtModalOpen(true)}
        onOpenChangePassword={() => setIsChangePasswordModalOpen(true)}
        onExportCsv={handleExportCsv}
        onOpenBulkDeleteCompleted={() => setIsBulkDeleteModalOpen(true)}
        currentDept={filters.dept}
        onSelectDept={(dept) => {
          if (!guardDeptSelect(dept)) return;
          setGuardedFilters(prev => ({ ...prev, dept }));
        }}
        isRestrictedHodMode={isRestrictedHodMode}
        lockedDepts={lockedDepts}
      />

      {/* Restricted Department Mode Notice */}
      {isRestrictedHodMode && (
        <div className="bg-amber-50/95 border-b border-amber-300 px-4 sm:px-8 py-2.5 flex items-center gap-2 text-xs text-amber-950 animate-in fade-in">
          <span className="px-2 py-0.5 rounded bg-amber-200/90 text-amber-950 font-bold text-[10px] tracking-wide uppercase flex items-center gap-1 shadow-2xs">
            <Lock className="w-3 h-3 text-amber-800" />
            {session.role} Access: {lockedDepts!.join(', ')}
          </span>
          <span>
            Signed in as <strong>{session.displayName}</strong>. View is locked to {lockedDepts!.join(', ')} (and tasks they've raised to other departments).
          </span>
        </div>
      )}

      {/* Executive Session Banner */}
      {!isRestrictedHodMode && (session.role === 'PlantHead' || session.role === 'MD' || session.role === 'Admin') && (
        <div className="bg-gradient-to-r from-amber-50 via-emerald-50 to-blue-50 border-b border-amber-200 px-4 sm:px-8 py-2 flex items-center gap-2 text-xs text-slate-800 animate-in fade-in">
          <span className="px-2 py-0.5 rounded bg-amber-200/90 text-amber-950 font-bold text-[10px] tracking-wide uppercase flex items-center gap-1 shadow-2xs">
            <Crown className="w-3 h-3 text-amber-800" />
            {session.role} Portal
          </span>
          <span>
            Signed in as <strong>{session.displayName}</strong> • Full plant oversight active.
          </span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-5">

        {/* Cockpit View (Executive Analytics & KPI Cards) */}
        {activeTab === 'cockpit' && (
          <div className="space-y-6">
            <StatsOverview
              stats={stats}
              onFilterClick={(type, val) => {
                setActiveTab('matrix');
                if (type === 'status') setGuardedFilters(prev => ({ ...prev, status: val }));
                if (type === 'priority') setGuardedFilters(prev => ({ ...prev, priority: val }));
                if (type === 'kaizen') setGuardedFilters(prev => ({ ...prev, onlyKaizen: true }));
              }}
            />
            <Suspense fallback={<div className="text-center py-10 text-xs text-slate-400">Loading analytics…</div>}>
              <AnalyticsView
                actions={visibleActions}
                lockedDept={lockedDepts?.[0] ?? null}
                onSelectDept={(dept) => {
                  if (!guardDeptSelect(dept)) return;
                  setGuardedFilters(prev => ({ ...prev, dept }));
                  setActiveTab('matrix');
                }}
                onSelectPriority={(priority) => {
                  if (lockedDepts) return;
                  setGuardedFilters(prev => ({ ...prev, priority }));
                  setActiveTab('matrix');
                }}
              />
            </Suspense>
          </div>
        )}

        {/* Master Matrix View (Matches screenshot directly) */}
        {activeTab === 'matrix' && (
          <ActionRegisterView
            actions={visibleActions}
            filters={filters}
            setFilters={setGuardedFilters}
            onOpenDetail={(action) => setSelectedAction(action)}
            onUpdateStatus={handleUpdateStatus}
            onOpenNewModal={() => setIsNewModalOpen(true)}
            onDelete={handleDeleteAction}
            lockedDepts={lockedDepts}
            supervisors={supervisors}
          />
        )}

        {/* Saturday MOM Tab (10 items) */}
        {activeTab === 'saturday_mom' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-blue-200/80 p-4 sm:p-5 shadow-xs flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <h2 className="font-bold text-base text-slate-900">Saturday MOM Action Register (Weekly Review)</h2>
                  <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-0.5 rounded-full">
                    {momActions.length} Actions
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Minutes of Meeting action points reviewed weekly with Mr. Sanglikar & Department Heads.
                </p>
              </div>
              <button
                onClick={() => setIsNewModalOpen(true)}
                className="bg-[#1d64ec] hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-xl"
              >
                + Add MOM Action
              </button>
            </div>
            <ActionRegisterView
              actions={momActions}
              filters={filters}
              setFilters={setGuardedFilters}
              onOpenDetail={(action) => setSelectedAction(action)}
              onUpdateStatus={handleUpdateStatus}
              onOpenNewModal={() => setIsNewModalOpen(true)}
              onDelete={handleDeleteAction}
              lockedDepts={lockedDepts}
              supervisors={supervisors}
            />
          </div>
        )}

        {/* Recurring PM Tab (2 items) */}
        {activeTab === 'recurring_pm' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-amber-200/80 p-4 sm:p-5 shadow-xs flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <RotateCw className="w-4 h-4 text-amber-600" />
                  <h2 className="font-bold text-base text-slate-900">Preventive Maintenance & Recurring Actions (PM)</h2>
                  <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
                    {recurringActions.length} Scheduled
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Cyclic routines, weekly machine calibrations, and autonomous maintenance checks.
                </p>
              </div>
              <button
                onClick={() => setIsNewModalOpen(true)}
                className="bg-[#1d64ec] hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-xl"
              >
                + Add Recurring PM
              </button>
            </div>
            <ActionRegisterView
              actions={recurringActions}
              filters={filters}
              setFilters={setGuardedFilters}
              onOpenDetail={(action) => setSelectedAction(action)}
              onUpdateStatus={handleUpdateStatus}
              onOpenNewModal={() => setIsNewModalOpen(true)}
              onDelete={handleDeleteAction}
              lockedDepts={lockedDepts}
              supervisors={supervisors}
            />
          </div>
        )}

        {/* CFT Handshake Tab (Inter-Departmental Tasks Only) */}
        {activeTab === 'cft_handshake' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-purple-200/80 p-4 sm:p-5 shadow-xs flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-600" />
                  <h2 className="font-bold text-base text-slate-900">CFT Handshake Register (Inter-Departmental)</h2>
                  <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2.5 py-0.5 rounded-full">
                    {cftActions.length} Cross-Dept Handshakes
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Exclusively showing tasks raised across departments only (Originator Dept ≠ Target Dept) for cross-functional alignment.
                </p>
              </div>
              <button
                onClick={() => setIsNewModalOpen(true)}
                className="bg-[#1d64ec] hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-xl"
              >
                + Add Handshake Task
              </button>
            </div>
            <ActionRegisterView
              actions={cftActions}
              filters={filters}
              setFilters={setGuardedFilters}
              onOpenDetail={(action) => setSelectedAction(action)}
              onUpdateStatus={handleUpdateStatus}
              onOpenNewModal={() => setIsNewModalOpen(true)}
              onDelete={handleDeleteAction}
              lockedDepts={lockedDepts}
              supervisors={supervisors}
            />
          </div>
        )}

        {/* Kaizen / DSI Tab (52 items) */}
        {activeTab === 'kaizen' && (
          <KaizenHubView
            actions={visibleActions}
            onOpenDetail={(action) => setSelectedAction(action)}
            onOpenNewModal={() => setIsNewModalOpen(true)}
            lockedDepts={lockedDepts}
          />
        )}

        {/* Dept Leaders & 4-V Tab */}
        {activeTab === 'dept_leaders' && (
          <DepartmentDirectoryView
            actions={visibleActions}
            lockedDepts={lockedDepts}
            supervisors={supervisors}
            onSelectDepartment={(dept) => {
              if (!guardDeptSelect(dept)) return;
              setGuardedFilters(prev => ({ ...prev, dept }));
              setActiveTab('matrix');
            }}
          />
        )}
      </main>

      {/* Action Detail Modal (with Plant Head/MD/Admin date revision & deletion controls and Handshake verification).
          Only mounted while an action is actually selected — each of these
          modals initializes state hooks from props (e.g. action.status)
          that aren't safe to read before that data exists, so the modal
          must mount fresh (all hooks together) rather than always being
          present and toggling an isOpen/action prop on the same instance. */}
      {selectedAction && (
        <ActionDetailModal
          action={selectedAction}
          onClose={() => setSelectedAction(null)}
          onSave={handleSaveAction}
          onDelete={handleDeleteAction}
          session={session}
        />
      )}

      {/* New Action Item Modal */}
      {isNewModalOpen && (
        <NewActionModal
          isOpen={isNewModalOpen}
          onClose={() => setIsNewModalOpen(false)}
          onAdd={handleAddAction}
          lockedDepts={lockedDepts}
          supervisors={supervisors}
        />
      )}

      {/* User Management Modal (Admin only) */}
      {can(session, 'manageUsers') && isUserMgmtModalOpen && (
        <UserManagementModal
          isOpen={isUserMgmtModalOpen}
          onClose={() => setIsUserMgmtModalOpen(false)}
          currentUsername={session.username}
        />
      )}

      {/* Supervisor Management Modal (Admin/PlantHead/MD/DeptHead) */}
      {can(session, 'manageSupervisors') && isSupervisorMgmtModalOpen && (
        <SupervisorManagementModal
          isOpen={isSupervisorMgmtModalOpen}
          onClose={() => setIsSupervisorMgmtModalOpen(false)}
          lockedDepts={lockedDepts}
          onSupervisorsChanged={loadSupervisors}
        />
      )}

      {/* Self-Service Change Password Modal */}
      {isChangePasswordModalOpen && (
        <ChangePasswordModal
          isOpen={isChangePasswordModalOpen}
          onClose={() => setIsChangePasswordModalOpen(false)}
          username={session.username}
        />
      )}

      {/* Bulk Delete Completed Tasks Modal (Admin only) */}
      {can(session, 'bulkDeleteCompleted') && isBulkDeleteModalOpen && (
        <BulkDeleteCompletedModal
          isOpen={isBulkDeleteModalOpen}
          onClose={() => setIsBulkDeleteModalOpen(false)}
          actions={actions}
          onDeleteBefore={handleDeleteCompletedBefore}
        />
      )}
    </div>
  );
}
