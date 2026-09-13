import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ActionItem, FilterState, SentinelStats, ActionStatus } from './types';
import {
  getInitialActions,
  saveActionsToStorage,
  isRaisedToOtherDept
} from './data/sentinelDataLoader';
import {
  subscribeToTabBroadcast,
  broadcastLocalUpdate
} from './utils/syncService';
import { Header, NavTab } from './components/Header';
import { StatsOverview } from './components/StatsOverview';
import { AnalyticsView } from './components/AnalyticsView';
import { ActionRegisterView } from './components/ActionRegisterView';
import { DepartmentDirectoryView } from './components/DepartmentDirectoryView';
import { KaizenHubView } from './components/KaizenHubView';
import { ActionDetailModal } from './components/ActionDetailModal';
import { NewActionModal } from './components/NewActionModal';
import { UserManagementModal } from './components/UserManagementModal';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { LoginScreen } from './components/LoginScreen';
import {
  isGoogleSheetConnected,
  updateActionInGoogleSheet,
  createActionInGoogleSheet,
  deleteActionInGoogleSheet,
  fetchActionsFromGoogleSheet,
  pushAllActionsToGoogleSheet
} from './utils/googleSheetsService';
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
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Department scoping is derived directly from the signed-in session — there
  // is no more URL-param or password-bypass path to acquire a locked dept.
  const lockedDept = session?.department ?? null;
  const isRestrictedHodMode = lockedDept !== null;

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

  // Bulletproof filter updater: strictly preserves lockedDept if active
  const setGuardedFilters = useCallback((updater: React.SetStateAction<FilterState>) => {
    setFilters(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (lockedDept) {
        return { ...next, dept: lockedDept };
      }
      return next;
    });
  }, [lockedDept]);

  // Lock the department filter to the signed-in user's department as soon as
  // they log in (or when a fresh session with a department loads on mount).
  useEffect(() => {
    if (lockedDept) {
      setFilters(prev => ({ ...prev, dept: lockedDept }));
    }
  }, [lockedDept]);

  const handleLogout = useCallback(() => {
    clearSession();
    setSession(null);
    setFilters(prev => ({ ...prev, dept: '' }));
  }, []);

  // Real-Time Task Synchronization across links, devices, and browser tabs
  // Backed entirely by the connected Google Sheet — no app server involved.
  useEffect(() => {
    let isMounted = true;
    let lastSheetSnapshot = '';

    async function pullFromSheet(): Promise<boolean> {
      if (!isGoogleSheetConnected()) return false;
      try {
        const fresh = await fetchActionsFromGoogleSheet();
        if (fresh && fresh.length > 0) {
          const snapshot = JSON.stringify(fresh);
          if (snapshot !== lastSheetSnapshot) {
            lastSheetSnapshot = snapshot;
            if (isMounted) {
              setActions(fresh);
              saveActionsToStorage(fresh);
            }
          }
          return true;
        }
      } catch (err) {
        console.warn('Google Sheet sync failed, using local cache:', err);
      }
      return false;
    }

    // 1. Initial sync from the Google Sheet (falls back to local cache if not connected)
    (async () => {
      const pulled = await pullFromSheet();
      if (!pulled && isGoogleSheetConnected()) {
        // Sheet is connected but empty on first boot: seed it with the local matrix
        const base = getInitialActions();
        await pushAllActionsToGoogleSheet(base);
        lastSheetSnapshot = JSON.stringify(base);
      }
    })();

    // 2. Periodic background sync polling (every 20 seconds — Apps Script has daily call quotas)
    const pollInterval = setInterval(() => {
      pullFromSheet();
    }, 20000);

    // 3. Immediate sync on window focus / tab switch
    const handleFocusSync = () => {
      pullFromSheet();
    };

    window.addEventListener('focus', handleFocusSync);
    document.addEventListener('visibilitychange', handleFocusSync);

    // 4. Instant cross-tab messaging via BroadcastChannel
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
      } else if (data.type === 'FULL_SYNC' && isGoogleSheetConnected()) {
        fetchActionsFromGoogleSheet().then(fresh => {
          if (fresh && isMounted) {
            setActions(fresh);
            saveActionsToStorage(fresh);
          }
        }).catch(() => {});
      }
    });

    // 5. Cross-tab localStorage event listener
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

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      window.removeEventListener('focus', handleFocusSync);
      document.removeEventListener('visibilitychange', handleFocusSync);
      unsubscribeBroadcast();
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, []);

  // Every view is scoped to what the signed-in user is actually allowed to see:
  // plant-wide roles (PlantHead/MD/Admin) see everything, department-scoped
  // roles (DeptHead/Viewer) see tasks their department owns OR raised to
  // another department (handshake visibility in both directions).
  const visibleActions = useMemo(() => {
    if (!session || !session.department) return actions;
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

    const today = '2026-09-11';

    visibleActions.forEach(a => {
      if (a.status === 'Completed') completed++;
      else if (a.status === 'In process') inProcess++;
      else if (a.status === 'Under Verification') underVerification++;
      else if (a.status === 'Hold') onHold++;
      else pending++;

      if (a.priority === 'A') criticalPriorityA++;
      else standardPriorityB++;

      if (a.isKaizen) kaizenCount++;

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
  const handleUpdateStatus = useCallback((id: number, newStatus: ActionStatus) => {
    const target = actions.find(a => a.id === id);
    if (!target || !can(session, 'editOwnDept', target)) {
      showToast('Access denied: you do not have permission to update this task.');
      return;
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
        updateActionInGoogleSheet(updatedItem);
      }
    }
    showToast(`Task #${id} status changed to "${newStatus}" & synced`);
  }, [actions, session, showToast]);

  // Delete item (Plant Head / MD / Admin authority only) & sync across links
  const handleDeleteAction = useCallback((id: number) => {
    if (!can(session, 'deleteTask')) {
      showToast('Access denied: you do not have permission to delete tasks.');
      return;
    }
    setActions(prev => {
      const next = prev.filter(item => item.id !== id);
      saveActionsToStorage(next);
      return next;
    });
    setSelectedAction(null);
    broadcastLocalUpdate('DELETE', { id });
    if (isGoogleSheetConnected()) {
      deleteActionInGoogleSheet(id);
    }
    showToast(`Task #${id} permanently deleted`);
  }, [session, showToast]);

  // Save full edited action & sync across links
  const handleSaveAction = useCallback((updated: ActionItem) => {
    if (!can(session, 'editOwnDept', updated)) {
      showToast('Access denied: you do not have permission to edit this task.');
      return;
    }
    setActions(prev => {
      const next = prev.map(item => item.id === updated.id ? updated : item);
      saveActionsToStorage(next);
      return next;
    });
    broadcastLocalUpdate('UPDATE', updated);
    if (isGoogleSheetConnected()) {
      updateActionInGoogleSheet(updated);
    }
    showToast(`Task #${updated.id} successfully updated & synced across links`);
  }, [session, showToast]);

  // Add new item & sync across links
  const handleAddAction = useCallback((newItemData: Omit<ActionItem, 'id'>) => {
    if (!can(session, 'createTask')) {
      showToast('Access denied: you do not have permission to create tasks.');
      return;
    }
    const nextId = actions.reduce((max, a) => Math.max(max, a.id), 0) + 1;
    const newItem: ActionItem = {
      ...newItemData,
      id: nextId
    };
    setActions(prev => {
      const next = [newItem, ...prev];
      saveActionsToStorage(next);
      return next;
    });
    broadcastLocalUpdate('UPDATE', newItem);
    if (isGoogleSheetConnected()) {
      createActionInGoogleSheet(newItem);
    }
    showToast(`Created new Action #${nextId} & broadcasted to all links`);
  }, [actions, session, showToast]);

  // Pull the latest matrix from the connected Google Sheet, or push the local
  // matrix as the seed if the sheet is empty.
  const handleSyncSheet = useCallback(async () => {
    if (!isGoogleSheetConnected()) {
      showToast('Google Sheet backend is not configured. Contact your administrator.');
      return;
    }
    try {
      const fresh = await fetchActionsFromGoogleSheet();
      if (fresh && fresh.length > 0) {
        setActions(fresh);
        saveActionsToStorage(fresh);
        showToast(`Synchronized with Google Sheet — ${fresh.length} records updated`);
        return;
      }
      await pushAllActionsToGoogleSheet(actions);
      showToast(`Master operational matrix synchronized — ${actions.length} records pushed to Google Sheet`);
    } catch (err) {
      showToast('Google Sheet sync failed — check your connection settings.');
    }
  }, [actions, showToast]);

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
        onOpenNewModal={() => setIsNewModalOpen(true)}
        onSyncSheet={handleSyncSheet}
        session={session}
        onLogout={handleLogout}
        onOpenUserManagement={() => setIsUserMgmtModalOpen(true)}
        onOpenChangePassword={() => setIsChangePasswordModalOpen(true)}
        currentDept={filters.dept}
        onSelectDept={(dept) => {
          if (lockedDept && dept !== lockedDept) {
            showToast(`Access Restricted: Locked to ${lockedDept} department.`);
            return;
          }
          setGuardedFilters(prev => ({ ...prev, dept }));
        }}
        isRestrictedHodMode={isRestrictedHodMode}
        lockedDept={lockedDept}
      />

      {/* Restricted Department Mode Notice */}
      {isRestrictedHodMode && (
        <div className="bg-amber-50/95 border-b border-amber-300 px-4 sm:px-8 py-2.5 flex items-center gap-2 text-xs text-amber-950 animate-in fade-in">
          <span className="px-2 py-0.5 rounded bg-amber-200/90 text-amber-950 font-bold text-[10px] tracking-wide uppercase flex items-center gap-1 shadow-2xs">
            <Lock className="w-3 h-3 text-amber-800" />
            {session.role} Access: {lockedDept}
          </span>
          <span>
            Signed in as <strong>{session.displayName}</strong>. View is locked to {lockedDept} (and tasks {lockedDept} has raised to other departments).
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
            <AnalyticsView
              actions={visibleActions}
              lockedDept={lockedDept}
              onSelectDept={(dept) => {
                if (lockedDept && dept !== lockedDept) {
                  showToast(`Access Restricted: Locked to ${lockedDept} department.`);
                  return;
                }
                setGuardedFilters(prev => ({ ...prev, dept }));
                setActiveTab('matrix');
              }}
              onSelectPriority={(priority) => {
                if (lockedDept) return;
                setGuardedFilters(prev => ({ ...prev, priority }));
                setActiveTab('matrix');
              }}
            />
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
            lockedDept={lockedDept}
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
              lockedDept={lockedDept}
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
              lockedDept={lockedDept}
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
              lockedDept={lockedDept}
            />
          </div>
        )}

        {/* Kaizen / DSI Tab (52 items) */}
        {activeTab === 'kaizen' && (
          <KaizenHubView
            actions={visibleActions}
            onOpenDetail={(action) => setSelectedAction(action)}
            onOpenNewModal={() => setIsNewModalOpen(true)}
            lockedDept={lockedDept}
          />
        )}

        {/* Dept Leaders & 4-V Tab */}
        {activeTab === 'dept_leaders' && (
          <DepartmentDirectoryView
            actions={visibleActions}
            lockedDept={lockedDept}
            onSelectDepartment={(dept) => {
              if (lockedDept && dept !== lockedDept) {
                showToast(`Access Restricted: You are locked to ${lockedDept}.`);
                return;
              }
              setGuardedFilters(prev => ({ ...prev, dept }));
              setActiveTab('matrix');
            }}
          />
        )}
      </main>

      {/* Footer matching corporate standards */}
      <footer className="bg-white border-t border-slate-200 py-3.5 text-center text-xs text-slate-500 select-none">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <span>
            Samarth Industries © {new Date().getFullYear()} • Chakan Industrial Area, Phase II, Pune
          </span>
          <div className="flex items-center gap-3 text-slate-500 text-[11px]">
            <span className="text-emerald-700 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Live Matrix v5.0 • Cloud Synced
            </span>
            <span>•</span>
            <span>IATF 16949:2016 Certified</span>
            <span>•</span>
            <span>Mentor: Mr. Sanglikar</span>
          </div>
        </div>
      </footer>

      {/* Action Detail Modal (with Plant Head/MD/Admin date revision & deletion controls and Handshake verification) */}
      <ActionDetailModal
        action={selectedAction}
        onClose={() => setSelectedAction(null)}
        onSave={handleSaveAction}
        onDelete={handleDeleteAction}
        currentDept={filters.dept}
        session={session}
      />

      {/* New Action Item Modal */}
      <NewActionModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onAdd={handleAddAction}
        nextId={actions.reduce((max, a) => Math.max(max, a.id), 0) + 1}
        lockedDept={lockedDept}
      />

      {/* User Management Modal (Admin only) */}
      {can(session, 'manageUsers') && (
        <UserManagementModal
          isOpen={isUserMgmtModalOpen}
          onClose={() => setIsUserMgmtModalOpen(false)}
          currentUsername={session.username}
        />
      )}

      {/* Self-Service Change Password Modal */}
      <ChangePasswordModal
        isOpen={isChangePasswordModalOpen}
        onClose={() => setIsChangePasswordModalOpen(false)}
        username={session.username}
      />
    </div>
  );
}
