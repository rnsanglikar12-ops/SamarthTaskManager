import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ActionItem, FilterState, SentinelStats, ActionStatus } from './types';
import { 
  getInitialActions, 
  saveActionsToStorage, 
  loadBaseSentinelActions,
  isRaisedToOtherDept 
} from './data/sentinelDataLoader';
import { 
  fetchServerActions, 
  checkServerVersion, 
  pushAllActionsToServer, 
  pushSingleActionUpdate, 
  pushSingleActionDelete, 
  subscribeToTabBroadcast,
  getLocalVersion,
  setLocalVersion 
} from './utils/syncService';
import { exportActionsToCsv, exportActionsToJson } from './utils/exportUtils';
import { Header, NavTab } from './components/Header';
import { StatsOverview } from './components/StatsOverview';
import { AnalyticsView } from './components/AnalyticsView';
import { ActionRegisterView } from './components/ActionRegisterView';
import { DepartmentDirectoryView } from './components/DepartmentDirectoryView';
import { KaizenHubView } from './components/KaizenHubView';
import { ActionDetailModal } from './components/ActionDetailModal';
import { NewActionModal } from './components/NewActionModal';
import { SecretControlModal } from './components/SecretControlModal';
import { DeptHeadLinksModal } from './components/DeptHeadLinksModal';
import { GoogleSheetsModal } from './components/GoogleSheetsModal';
import { 
  isGoogleSheetConnected, 
  updateActionInGoogleSheet, 
  createActionInGoogleSheet, 
  deleteActionInGoogleSheet, 
  fetchActionsFromGoogleSheet 
} from './utils/googleSheetsService';
import { isSecretControlUnlocked, setActiveRole, getActiveRole } from './utils/security';
import { CheckCircle2, AlertCircle, Sparkles, Calendar, RotateCw, Users, Crown, Lock } from 'lucide-react';

export default function App() {
  const [actions, setActions] = useState<ActionItem[]>(() => getInitialActions());
  // Default to 'matrix' (Master Matrix) to match the provided screenshot
  const [activeTab, setActiveTab] = useState<NavTab>('matrix');
  const [selectedAction, setSelectedAction] = useState<ActionItem | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState<boolean>(false);
  const [isSecretModalOpen, setIsSecretModalOpen] = useState<boolean>(false);
  const [isDeptLinksModalOpen, setIsDeptLinksModalOpen] = useState<boolean>(false);
  const [isGoogleSheetsModalOpen, setIsGoogleSheetsModalOpen] = useState<boolean>(false);
  const [isSecretUnlocked, setIsSecretUnlocked] = useState<boolean>(() => isSecretControlUnlocked());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isRestrictedHodMode, setIsRestrictedHodMode] = useState<boolean>(false);
  const [lockedDept, setLockedDept] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<string>(() => getActiveRole());

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

  // Handle URL query parameters for direct HOD links and Plant Head role
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const deptParam = params.get('dept');
      const accessParam = params.get('access');
      const roleParam = params.get('role');

      // Check if opened as Plant Head
      if (roleParam === 'planthead' || (deptParam?.toLowerCase() === 'plant head' && accessParam !== 'hod')) {
        setActiveRole('Plant Head');
        setCurrentRole('Plant Head');
        setIsRestrictedHodMode(false);
        setLockedDept(null);
        showToast('Plant Head Executive Portal Activated (Awari B.) — Full Plant Access');
        // If specific department is not selected, show all departments across plant
        if (deptParam && deptParam !== 'Plant Head' && deptParam !== 'All') {
          setFilters(prev => ({ ...prev, dept: deptParam }));
        } else {
          setFilters(prev => ({ ...prev, dept: '' }));
        }
        return;
      }

      if (deptParam && deptParam !== 'All') {
        setLockedDept(deptParam);
        setIsRestrictedHodMode(true);
        setFilters(prev => ({ ...prev, dept: deptParam }));
        showToast(`🔒 Department View Locked to ${deptParam}`);
      } else if (accessParam === 'hod') {
        setIsRestrictedHodMode(true);
      }
    }
  }, [showToast]);

  // Real-Time Task Synchronization across links, devices, and browser tabs
  useEffect(() => {
    let isMounted = true;

    // 1. Initial sync with central server
    async function initialServerSync() {
      try {
        const serverResult = await fetchServerActions();
        if (serverResult && serverResult.actions && serverResult.actions.length > 0) {
          if (isMounted) {
            setActions(serverResult.actions);
            saveActionsToStorage(serverResult.actions);
            setLocalVersion(serverResult.version);
          }
        } else {
          // Central store is empty on first boot: seed with base 1,050 records
          const base = getInitialActions();
          const seedVer = await pushAllActionsToServer(base);
          if (seedVer) setLocalVersion(seedVer);
        }
      } catch (err) {
        console.warn('Initial server sync failed, using local cache:', err);
      }
    }

    initialServerSync();

    // 2. Periodic background sync polling (every 3.5 seconds)
    const pollInterval = setInterval(async () => {
      try {
        const versionInfo = await checkServerVersion();
        if (versionInfo && versionInfo.version > getLocalVersion()) {
          const freshData = await fetchServerActions();
          if (freshData && freshData.actions && isMounted) {
            setActions(freshData.actions);
            saveActionsToStorage(freshData.actions);
            setLocalVersion(freshData.version);
          }
        }
      } catch (err) {
        // Silently swallow polling glitches
      }
    }, 3500);

    // 3. Immediate sync on window focus / tab switch
    const handleFocusSync = async () => {
      try {
        const versionInfo = await checkServerVersion();
        if (versionInfo && versionInfo.version > getLocalVersion()) {
          const freshData = await fetchServerActions();
          if (freshData && freshData.actions && isMounted) {
            setActions(freshData.actions);
            saveActionsToStorage(freshData.actions);
            setLocalVersion(freshData.version);
          }
        }
      } catch (err) {}
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
      } else if (data.type === 'FULL_SYNC') {
        fetchServerActions().then(fresh => {
          if (fresh && fresh.actions && isMounted) {
            setActions(fresh.actions);
            saveActionsToStorage(fresh.actions);
          }
        });
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

    actions.forEach(a => {
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

    const total = actions.length;
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
  }, [actions]);

  // Update status directly & sync across links
  const handleUpdateStatus = useCallback((id: number, newStatus: ActionStatus) => {
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
      pushSingleActionUpdate(updatedItem);
      if (isGoogleSheetConnected()) {
        updateActionInGoogleSheet(updatedItem);
      }
    }
    showToast(`Task #${id} status changed to "${newStatus}" & synced`);
  }, [showToast]);

  // Delete item (Authority with Plant Head / Secret Control) & sync across links
  const handleDeleteAction = useCallback((id: number) => {
    setActions(prev => {
      const next = prev.filter(item => item.id !== id);
      saveActionsToStorage(next);
      return next;
    });
    setSelectedAction(null);
    pushSingleActionDelete(id);
    if (isGoogleSheetConnected()) {
      deleteActionInGoogleSheet(id);
    }
    showToast(`Task #${id} permanently deleted under Plant Head authority`);
  }, [showToast]);

  // Save full edited action & sync across links
  const handleSaveAction = useCallback((updated: ActionItem) => {
    setActions(prev => {
      const next = prev.map(item => item.id === updated.id ? updated : item);
      saveActionsToStorage(next);
      return next;
    });
    pushSingleActionUpdate(updated);
    if (isGoogleSheetConnected()) {
      updateActionInGoogleSheet(updated);
    }
    showToast(`Task #${updated.id} successfully updated & synced across links`);
  }, [showToast]);

  // Add new item & sync across links
  const handleAddAction = useCallback((newItemData: Omit<ActionItem, 'id'>) => {
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
    pushSingleActionUpdate(newItem);
    if (isGoogleSheetConnected()) {
      createActionInGoogleSheet(newItem);
    }
    showToast(`Created new Action #${nextId} & broadcasted to all links`);
  }, [actions, showToast]);

  // Sync Sheet simulation & pull from Google Sheets / central server
  const handleSyncSheet = useCallback(async () => {
    if (isGoogleSheetConnected()) {
      try {
        const fresh = await fetchActionsFromGoogleSheet();
        if (fresh && fresh.length > 0) {
          setActions(fresh);
          saveActionsToStorage(fresh);
          pushAllActionsToServer(fresh);
          showToast(`Synchronized with Google Sheet — ${fresh.length} records updated`);
          return;
        }
      } catch (err) {
        console.warn('Google Sheet fetch error:', err);
      }
    }

    try {
      const res = await fetchServerActions();
      if (res && res.actions && res.actions.length > 0) {
        setActions(res.actions);
        saveActionsToStorage(res.actions);
        setLocalVersion(res.version);
        showToast(`Synchronized with Central Cloud Server — ${res.actions.length} records active`);
      } else {
        await pushAllActionsToServer(actions);
        showToast(`Master operational matrix synchronized — ${actions.length} records up to date`);
      }
    } catch (err) {
      showToast(`Master matrix synchronized — ${actions.length} records active`);
    }
  }, [actions, showToast]);

  // Specific filtered lists for dedicated tabs
  const momActions = useMemo(() => actions.filter(a => a.isMOM), [actions]);
  const recurringActions = useMemo(() => actions.filter(a => a.recurrence !== 'One-Time'), [actions]);
  // CFT Handshake: strictly tasks raised to another department only (originatorDept != dept)
  const cftActions = useMemo(() => actions.filter(a => isRaisedToOtherDept(a.originatorDept, a.dept)), [actions]);
  const kaizenActions = useMemo(() => actions.filter(a => a.isKaizen), [actions]);

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
        onOpenGoogleSheetsModal={() => setIsGoogleSheetsModalOpen(true)}
        onOpenSecretControl={() => setIsSecretModalOpen(true)}
        onOpenDeptLinks={() => setIsDeptLinksModalOpen(true)}
        isSecretUnlocked={isSecretUnlocked}
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

      {/* Restricted HOD Mode Notice */}
      {isRestrictedHodMode && (
        <div className="bg-amber-50/95 border-b border-amber-300 px-4 sm:px-8 py-2.5 flex items-center justify-between text-xs text-amber-950 animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-amber-200/90 text-amber-950 font-bold text-[10px] tracking-wide uppercase flex items-center gap-1 shadow-2xs">
              <Lock className="w-3 h-3 text-amber-800" />
              Locked HOD Access: {lockedDept || filters.dept}
            </span>
            <span>
              Direct link mode active for <strong>{lockedDept || filters.dept}</strong>. Inter-departmental links and administrative tools are restricted.
            </span>
          </div>
          {isSecretUnlocked && (
            <button
              onClick={() => {
                setIsRestrictedHodMode(false);
                setLockedDept(null);
                setFilters(prev => ({ ...prev, dept: '' }));
                if (typeof window !== 'undefined') {
                  window.history.replaceState({}, document.title, window.location.pathname);
                }
              }}
              className="text-blue-700 hover:text-blue-900 font-bold underline text-xs ml-4 shrink-0"
            >
              Unlock Master View
            </button>
          )}
        </div>
      )}

      {/* Plant Head Executive Active Banner */}
      {currentRole === 'Plant Head' && !isRestrictedHodMode && (
        <div className="bg-gradient-to-r from-amber-50 via-emerald-50 to-blue-50 border-b border-amber-200 px-4 sm:px-8 py-2 flex items-center justify-between text-xs text-slate-800 animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-amber-200/90 text-amber-950 font-bold text-[10px] tracking-wide uppercase flex items-center gap-1 shadow-2xs">
              <Crown className="w-3 h-3 text-amber-800" />
              Plant Head Executive Portal
            </span>
            <span>
              Active as <strong>Awari B. (Plant Head)</strong> • Full plant oversight active • Target date revision & task deletion authorized.
            </span>
          </div>
          <button
            onClick={() => {
              setActiveRole('Viewer');
              setCurrentRole('Viewer');
              if (typeof window !== 'undefined') {
                window.history.replaceState({}, document.title, window.location.pathname);
              }
            }}
            className="text-slate-600 hover:text-slate-900 font-semibold underline text-xs ml-4 shrink-0"
          >
            Exit Plant Head Mode
          </button>
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
              actions={actions}
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
                setGuardedFilters(prev => ({ ...prev, priority }));
                setActiveTab('matrix');
              }}
            />
          </div>
        )}

        {/* Master Matrix View (Matches screenshot directly) */}
        {activeTab === 'matrix' && (
          <ActionRegisterView
            actions={actions}
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
            actions={actions}
            onOpenDetail={(action) => setSelectedAction(action)}
            onOpenNewModal={() => setIsNewModalOpen(true)}
            lockedDept={lockedDept}
          />
        )}

        {/* Dept Leaders & 4-V Tab */}
        {activeTab === 'dept_leaders' && (
          <DepartmentDirectoryView
            actions={actions}
            lockedDept={lockedDept}
            onSelectDepartment={(dept) => {
              if (lockedDept && dept !== lockedDept) {
                showToast(`Access Restricted: You are locked to ${lockedDept}.`);
                return;
              }
              setGuardedFilters(prev => ({ ...prev, dept }));
              setActiveTab('matrix');
            }}
            onOpenSecretControl={() => setIsSecretModalOpen(true)}
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
              Live Matrix v4.2.1 • Cloud Synced
            </span>
            <span>•</span>
            <span>IATF 16949:2016 Certified</span>
            <span>•</span>
            <span>Mentor: Mr. Sanglikar</span>
          </div>
        </div>
      </footer>

      {/* Action Detail Modal (with Plant Head date revision & deletion controls and Handshake verification) */}
      <ActionDetailModal
        action={selectedAction}
        onClose={() => setSelectedAction(null)}
        onSave={handleSaveAction}
        onDelete={handleDeleteAction}
        onOpenSecretControl={() => setIsSecretModalOpen(true)}
        currentDept={filters.dept}
        currentRole={currentRole}
        isRestrictedHodMode={isRestrictedHodMode}
        isSecretUnlocked={isSecretUnlocked}
      />

      {/* New Action Item Modal */}
      <NewActionModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onAdd={handleAddAction}
        nextId={actions.reduce((max, a) => Math.max(max, a.id), 0) + 1}
      />

      {/* Secret Control Modal (Requirement 8) */}
      <SecretControlModal
        isOpen={isSecretModalOpen}
        onClose={() => {
          setIsSecretModalOpen(false);
          setIsSecretUnlocked(isSecretControlUnlocked());
        }}
        onRoleChanged={() => {
          setIsSecretUnlocked(isSecretControlUnlocked());
        }}
      />

      {/* Department Head Restricted Direct Links Modal (Requirement 7) */}
      <DeptHeadLinksModal
        isOpen={isDeptLinksModalOpen}
        onClose={() => setIsDeptLinksModalOpen(false)}
        onSelectDept={(dept) => {
          if (lockedDept && dept !== lockedDept) {
            showToast(`Access Restricted: Locked to ${lockedDept}.`);
            return;
          }
          setGuardedFilters(prev => ({ ...prev, dept }));
          setActiveTab('matrix');
        }}
        onOpenSecretControl={() => {
          setIsDeptLinksModalOpen(false);
          setIsSecretModalOpen(true);
        }}
      />

      {/* Google Sheets Cloud Backend Integration Modal */}
      <GoogleSheetsModal
        isOpen={isGoogleSheetsModalOpen}
        onClose={() => setIsGoogleSheetsModalOpen(false)}
        actions={actions}
        onSyncCompleted={(newActions, msg) => {
          setActions(newActions);
          saveActionsToStorage(newActions);
          pushAllActionsToServer(newActions);
          showToast(msg);
        }}
      />
    </div>
  );
}
