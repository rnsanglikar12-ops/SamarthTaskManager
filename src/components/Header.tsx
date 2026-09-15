import React, { useState } from 'react';
import {
  MapPin,
  RefreshCw,
  Lock,
  Plus,
  LayoutGrid,
  SlidersHorizontal,
  Calendar,
  RotateCw,
  Users,
  Sparkles,
  UserCheck,
  ChevronDown,
  Check,
  ShieldCheck,
  LogOut,
  KeyRound,
  UserCog,
  Menu,
  X,
  Download,
  Trash2
} from 'lucide-react';
import { isGoogleSheetConnected } from '../utils/dataService';
import { AuthUser, can } from '../utils/auth';
import { TASK_DEPARTMENTS } from '../data/orgStructure';

export type NavTab = 'cockpit' | 'matrix' | 'saturday_mom' | 'recurring_pm' | 'cft_handshake' | 'kaizen' | 'dept_leaders';

interface HeaderProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  totalCount: number;
  completedCount: number;
  onOpenNewModal: () => void;
  onRefresh?: () => void;
  session: AuthUser;
  onLogout: () => void;
  onOpenUserManagement: () => void;
  onOpenSupervisorManagement: () => void;
  onOpenChangePassword: () => void;
  onExportCsv: () => void;
  onOpenBulkDeleteCompleted: () => void;
  currentDept?: string;
  onSelectDept?: (dept: string) => void;
  isRestrictedHodMode?: boolean;
  lockedDepts?: string[] | null;
  cftCount?: number;
  momCount?: number;
  recurringCount?: number;
  kaizenCount?: number;
  overdueCount?: number;
}

type TabColor = 'blue' | 'amber' | 'purple' | 'emerald';

const TAB_ACTIVE_CLASSES: Record<TabColor, string> = {
  blue: 'bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs',
  amber: 'bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs',
  purple: 'bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs',
  emerald: 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs'
};

const TAB_BADGE_CLASSES: Record<TabColor, string> = {
  blue: 'bg-blue-100 text-blue-700',
  amber: 'bg-amber-100 text-amber-800',
  purple: 'bg-purple-100 text-purple-700',
  emerald: 'bg-emerald-100 text-emerald-700'
};

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  totalCount = 0,
  completedCount,
  onOpenNewModal,
  onRefresh,
  session,
  onLogout,
  onOpenUserManagement,
  onOpenSupervisorManagement,
  onOpenChangePassword,
  onExportCsv,
  onOpenBulkDeleteCompleted,
  currentDept = '',
  onSelectDept,
  isRestrictedHodMode = false,
  lockedDepts = null,
  cftCount,
  momCount = 0,
  recurringCount = 0,
  kaizenCount = 0,
  overdueCount = 0
}) => {
  const [showDeptMenu, setShowDeptMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshToast, setRefreshToast] = useState<string | null>(null);

  const isSpecificDeptSelected = Boolean(currentDept && currentDept !== '' && currentDept !== 'All Departments');

  const deptScopes = ['All Departments', ...TASK_DEPARTMENTS];

  // One person can head several departments — a single dept stays a hard,
  // non-interactive lock (unchanged UX for the common case); more than one
  // becomes a dropdown constrained to just their own departments.
  const isSingleDept = (lockedDepts?.length ?? 0) === 1;
  const isMultiDept = (lockedDepts?.length ?? 0) > 1;
  const scopeOptions = lockedDepts ? ['All My Departments', ...lockedDepts] : deptScopes;

  const displayScopeName = isSpecificDeptSelected
    ? `Dept: ${currentDept}`
    : 'All Departments (Executive View)';

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      if (onRefresh) {
        await onRefresh();
      }
      setRefreshToast(`Refreshed: latest matrix loaded`);
      setTimeout(() => setRefreshToast(null), 3000);
    } finally {
      setIsRefreshing(false);
    }
  };

  const navTabs: { id: NavTab; label: string; icon: React.ElementType; badge: string; color: TabColor }[] = [
    { id: 'cockpit', label: 'Cockpit', icon: LayoutGrid, badge: overdueCount > 0 ? `${overdueCount} alert` : '', color: 'blue' },
    { id: 'matrix', label: 'Master Matrix', icon: SlidersHorizontal, badge: String(totalCount), color: 'blue' },
    { id: 'saturday_mom', label: 'Saturday MOM', icon: Calendar, badge: String(momCount), color: 'blue' },
    { id: 'recurring_pm', label: 'Recurring PM', icon: RotateCw, badge: String(recurringCount), color: 'amber' },
    { id: 'cft_handshake', label: 'CFT Handshake', icon: Users, badge: String(cftCount ?? 0), color: 'purple' },
    { id: 'kaizen', label: 'Kaizen / DSI', icon: Sparkles, badge: String(kaizenCount), color: 'emerald' },
    { id: 'dept_leaders', label: 'Dept Leaders & 4-V', icon: UserCheck, badge: '', color: 'blue' }
  ];

  const accountMenuItems = (closeMenu: () => void) => (
    <>
      {can(session, 'manageUsers') && (
        <button
          onClick={() => {
            onOpenUserManagement();
            closeMenu();
          }}
          className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-slate-50 transition-colors rounded-lg"
        >
          <UserCog className="w-3.5 h-3.5 text-blue-600" />
          <span>Manage Users</span>
        </button>
      )}
      {can(session, 'manageSupervisors') && (
        <button
          onClick={() => {
            onOpenSupervisorManagement();
            closeMenu();
          }}
          className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-slate-50 transition-colors rounded-lg"
        >
          <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Manage Supervisors</span>
        </button>
      )}
      {can(session, 'exportData') && (
        <button
          onClick={() => {
            onExportCsv();
            closeMenu();
          }}
          className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-slate-50 transition-colors rounded-lg"
        >
          <Download className="w-3.5 h-3.5 text-blue-600" />
          <span>Export All Data (CSV)</span>
        </button>
      )}
      {can(session, 'bulkDeleteCompleted') && (
        <button
          onClick={() => {
            onOpenBulkDeleteCompleted();
            closeMenu();
          }}
          className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-red-50 text-red-600 transition-colors rounded-lg"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete Completed Tasks...</span>
        </button>
      )}
      <button
        onClick={() => {
          onOpenChangePassword();
          closeMenu();
        }}
        className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-slate-50 transition-colors rounded-lg"
      >
        <KeyRound className="w-3.5 h-3.5 text-slate-500" />
        <span>Change Password</span>
      </button>
      <button
        onClick={() => {
          onLogout();
          closeMenu();
        }}
        className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-red-50 text-red-600 transition-colors rounded-lg"
      >
        <LogOut className="w-3.5 h-3.5" />
        <span>Logout</span>
      </button>
    </>
  );

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200/90 shadow-sm select-none">
      {/* Top Bar */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-2 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100">

        {/* Left: Manufacturing Logo, Branding, Badges, Location */}
        <div className="flex items-center gap-3">
          <div className="flex items-center">
            <img
              src="/samarth_logo.png"
              alt="Samarth Industries"
              className="h-8 sm:h-11 w-auto max-w-[150px] sm:max-w-[210px] object-contain cursor-pointer hover:opacity-95 transition-opacity drop-shadow-2xs"
              onClick={() => setActiveTab('matrix')}
            />
          </div>

          {/* Vertical Divider */}
          <div className="h-8 w-px bg-slate-200 mx-1 hidden sm:block"></div>

          {/* Badges & Location Subtitle */}
          <div className="hidden sm:flex flex-col justify-center">
            <div className="flex items-center gap-2">
              <span className="border border-slate-300 bg-white text-slate-700 font-mono text-[9.5px] font-bold px-2 py-0.5 rounded tracking-wider shadow-2xs">
                SAMARTH
              </span>
              <span className="border border-emerald-300 bg-emerald-50 text-emerald-700 text-[10px] font-medium px-2 py-0.5 rounded flex items-center gap-1.5 shadow-2xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Live Operations
              </span>
            </div>

            <div className="flex items-center gap-1 text-[11px] text-slate-500 font-normal mt-0.5">
              <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
              <span>Chakan Industrial Area, Phase II, Pune • Mentor: Mr. Sanglikar</span>
            </div>
          </div>
        </div>

        {/* Right: Full controls — desktop/tablet only (sm and up) */}
        <div className="hidden sm:flex items-center gap-2 sm:gap-2.5">
          {/* Department Scope Dropdown */}
          <div className="relative">
            {isSingleDept ? (
              <div
                className="border border-amber-300 bg-amber-50 text-amber-950 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-2xs cursor-not-allowed select-none"
                title={`Restricted view permanently locked to ${lockedDepts![0]}. Department switching is disabled.`}
              >
                <span className="text-amber-700 text-xs">🔒</span>
                <span className="max-w-[130px] sm:max-w-[165px] truncate">
                  {lockedDepts![0]} (Locked)
                </span>
              </div>
            ) : (
              <button
                onClick={() => setShowDeptMenu(!showDeptMenu)}
                className={`border text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-2xs transition-colors ${
                  isMultiDept
                    ? 'border-amber-300 bg-amber-50/60 text-amber-900 hover:bg-amber-100'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                }`}
                title={isMultiDept ? `Restricted to your departments: ${lockedDepts!.join(', ')}` : 'Filter department view'}
              >
                <span className="text-amber-500 text-xs">{isMultiDept ? '🔒' : '🌟'}</span>
                <span className="max-w-[130px] sm:max-w-[165px] truncate text-slate-800">
                  {isMultiDept
                    ? (isSpecificDeptSelected ? `Dept: ${currentDept}` : 'All My Departments')
                    : displayScopeName}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>
            )}

            {showDeptMenu && !isSingleDept && (
              <div className="absolute right-0 mt-1 w-72 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50 text-xs text-slate-700 animate-in fade-in slide-in-from-top-1">
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 flex items-center justify-between">
                  <span>Select Scope View</span>
                  {isSpecificDeptSelected && (
                    <button
                      onClick={() => {
                        if (onSelectDept) onSelectDept('');
                        setShowDeptMenu(false);
                      }}
                      className="text-blue-600 hover:underline text-[10px]"
                    >
                      Reset to All
                    </button>
                  )}
                </div>
                {scopeOptions.map((scope) => {
                  const isAllOption = scope === 'All Departments' || scope === 'All My Departments';
                  const isSelected = (isAllOption && !isSpecificDeptSelected) || currentDept === scope;
                  return (
                    <button
                      key={scope}
                      onClick={() => {
                        if (onSelectDept) {
                          onSelectDept(isAllOption ? '' : scope);
                        }
                        setShowDeptMenu(false);
                      }}
                      className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-50 transition-colors ${
                        isSelected ? 'text-blue-600 font-semibold bg-blue-50/50' : 'text-slate-700'
                      }`}
                    >
                      <span>{scope}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Refresh: pulls the latest data from the Google Sheet on demand */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="border border-emerald-300 hover:border-emerald-400 bg-emerald-50/80 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-2xs transition-colors disabled:opacity-60"
              title="Refresh: fetch the latest data from the Google Sheet"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-700 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
              <span className={`w-2 h-2 rounded-full ${isGoogleSheetConnected() ? 'bg-emerald-500 shadow-sm animate-pulse' : 'bg-amber-400'}`}></span>
            </button>
          </div>

          {/* Signed-in User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-2xs transition-colors text-slate-700"
              title={`Signed in as ${session.displayName} (${session.role})`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              <span className="max-w-[120px] truncate">{session.displayName}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-1 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50 text-xs text-slate-700 animate-in fade-in slide-in-from-top-1">
                <div className="px-3 py-1.5 border-b border-slate-100">
                  <div className="font-bold text-slate-900">{session.displayName}</div>
                  <div className="text-[11px] text-slate-500">{session.role}{session.departments ? ` • ${session.departments.join(', ')}` : ' • Plant-wide'}</div>
                </div>
                {accountMenuItems(() => setShowUserMenu(false))}
              </div>
            )}
          </div>

          {/* New Task Blue Button */}
          <button
            onClick={onOpenNewModal}
            className="bg-[#1d64ec] hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs px-3.5 sm:px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>New Task</span>
          </button>
        </div>

        {/* Right: Compact controls — mobile only (below sm) */}
        <div className="flex sm:hidden items-center gap-2">
          <button
            onClick={onOpenNewModal}
            className="bg-[#1d64ec] hover:bg-blue-700 active:bg-blue-800 text-white p-2 rounded-lg shadow-sm transition-all"
            title="New Task"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
          </button>
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="border border-slate-200 bg-white text-slate-700 p-2 rounded-lg shadow-2xs relative"
            title="Menu"
          >
            <Menu className="w-4 h-4" />
            <span className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${isGoogleSheetConnected() ? 'bg-emerald-500' : 'bg-amber-400'}`}></span>
          </button>
        </div>
      </div>

      {/* Row 2: Navigation Tabs — desktop/tablet only, horizontal scroll if needed */}
      <div className="hidden sm:flex w-full px-4 sm:px-6 lg:px-8 py-1.5 items-center gap-1.5 overflow-x-auto scrollbar-none">
        {navTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                isActive ? TAB_ACTIVE_CLASSES[tab.color] : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5 text-slate-500" />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isActive ? TAB_BADGE_CLASSES[tab.color] : 'bg-slate-100 text-slate-600'}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Mobile Menu Drawer — everything (dept scope, sync, account, nav tabs) in one place */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div
            className="absolute inset-0 bg-slate-900/50 animate-in fade-in duration-150"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="absolute right-0 top-0 bottom-0 w-[85%] max-w-sm bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 shrink-0">
              <span className="font-bold text-slate-900">Menu</span>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs text-slate-700">
              {/* Signed-in user */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span className="font-bold text-sm text-slate-900">{session.displayName}</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  {session.role}{session.departments ? ` • ${session.departments.join(', ')}` : ' • Plant-wide'}
                </div>
              </div>

              {/* Department Scope */}
              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Department Scope
                </div>
                {isSingleDept ? (
                  <div className="border border-amber-300 bg-amber-50 text-amber-950 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-700" />
                    <span>{lockedDepts![0]} (Locked)</span>
                  </div>
                ) : (
                  <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                    {isMultiDept && (
                      <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50/60">
                        🔒 Restricted to your departments
                      </div>
                    )}
                    {scopeOptions.map((scope) => {
                      const isAllOption = scope === 'All Departments' || scope === 'All My Departments';
                      const isSelected = (isAllOption && !isSpecificDeptSelected) || currentDept === scope;
                      return (
                        <button
                          key={scope}
                          onClick={() => {
                            onSelectDept?.(isAllOption ? '' : scope);
                          }}
                          className={`w-full text-left px-3 py-2 flex items-center justify-between transition-colors ${
                            isSelected ? 'text-blue-600 font-semibold bg-blue-50/50' : 'text-slate-700'
                          }`}
                        >
                          <span>{scope}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Refresh */}
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="w-full border border-emerald-300 bg-emerald-50/80 text-emerald-800 text-xs font-semibold px-3 py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-2xs disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-emerald-700 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
                <span className={`w-2 h-2 rounded-full ${isGoogleSheetConnected() ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`}></span>
              </button>

              {/* Account actions */}
              <div className="border-t border-slate-200 pt-3 space-y-1">
                {accountMenuItems(() => setIsMobileMenuOpen(false))}
              </div>

              {/* Nav tabs */}
              <div className="border-t border-slate-200 pt-3 space-y-1">
                {navTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                        isActive ? TAB_ACTIVE_CLASSES[tab.color] : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-slate-500" />
                        {tab.label}
                      </span>
                      {tab.badge && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isActive ? TAB_BADGE_CLASSES[tab.color] : 'bg-slate-100 text-slate-600'}`}>
                          {tab.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification when Refreshing */}
      {refreshToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 border border-slate-800 animate-in fade-in">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>{refreshToast}</span>
        </div>
      )}
    </header>
  );
};
