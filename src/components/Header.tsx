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
  UserCog
} from 'lucide-react';
import { isGoogleSheetConnected } from '../utils/googleSheetsService';
import { AuthUser, can } from '../utils/auth';

export type NavTab = 'cockpit' | 'matrix' | 'saturday_mom' | 'recurring_pm' | 'cft_handshake' | 'kaizen' | 'dept_leaders';

interface HeaderProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  totalCount: number;
  completedCount: number;
  onOpenNewModal: () => void;
  onSyncSheet?: () => void;
  session: AuthUser;
  onLogout: () => void;
  onOpenUserManagement: () => void;
  onOpenChangePassword: () => void;
  currentDept?: string;
  onSelectDept?: (dept: string) => void;
  isRestrictedHodMode?: boolean;
  lockedDept?: string | null;
  cftCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  totalCount = 1050,
  completedCount,
  onOpenNewModal,
  onSyncSheet,
  session,
  onLogout,
  onOpenUserManagement,
  onOpenChangePassword,
  currentDept = '',
  onSelectDept,
  isRestrictedHodMode = false,
  lockedDept = null,
  cftCount
}) => {
  const [showDeptMenu, setShowDeptMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  const isSpecificDeptSelected = Boolean(currentDept && currentDept !== '' && currentDept !== 'All Departments');

  const deptScopes = [
    'All Departments',
    'Quality',
    'Store',
    'PDC',
    'Die Maint',
    'SPM',
    'Fettling',
    'Machine shop-01',
    'Machine shop-02',
    'PPC',
    'MC Maint',
    'NPD',
    'Tool Room',
    'HR',
    'Account',
    'Purchase',
    'Plant Head'
  ];

  const displayScopeName = isSpecificDeptSelected
    ? `Dept: ${currentDept}`
    : 'All Departments (Executive View)';

  const handleSync = async () => {
    setIsSyncing(true);
    if (onSyncSheet) {
      await onSyncSheet();
    }
    setIsSyncing(false);
    setSyncToast(`Cloud Synced: Central matrix up to date`);
    setTimeout(() => setSyncToast(null), 3000);
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200/90 shadow-sm select-none">
      {/* Top Bar matching image.png */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-2 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100">
        
        {/* Left: Manufacturing Logo, Branding, Badges, Location */}
        <div className="flex items-center gap-3">
          {/* Samarth Industries Logo (has company name within logo graphic) */}
          <div className="flex items-center">
            <img 
              src="/samarth_logo.png" 
              alt="Samarth Industries" 
              className="h-10 sm:h-11 w-auto max-w-[210px] object-contain cursor-pointer hover:opacity-95 transition-opacity drop-shadow-2xs"
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

        {/* Right: Controls matching image.png */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Department Scope Dropdown */}
          <div className="relative">
            {lockedDept ? (
              <div
                className="border border-amber-300 bg-amber-50 text-amber-950 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-2xs cursor-not-allowed select-none"
                title={`Restricted view permanently locked to ${lockedDept}. Department switching is disabled.`}
              >
                <span className="text-amber-700 text-xs">🔒</span>
                <span className="max-w-[130px] sm:max-w-[165px] truncate">
                  {lockedDept} (Locked)
                </span>
              </div>
            ) : (
              <button
                onClick={() => {
                  if (!isRestrictedHodMode) setShowDeptMenu(!showDeptMenu);
                }}
                disabled={isRestrictedHodMode}
                className={`border bg-white text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-2xs transition-colors ${
                  isRestrictedHodMode 
                    ? 'border-amber-300 bg-amber-50/60 text-amber-900 cursor-not-allowed'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                }`}
                title={isRestrictedHodMode ? `Restricted view locked to ${currentDept}` : 'Filter department view'}
              >
                <span className="text-amber-500 text-xs">{isRestrictedHodMode ? '🔒' : '🌟'}</span>
                <span className="max-w-[130px] sm:max-w-[165px] truncate text-slate-800">
                  {isRestrictedHodMode ? `${currentDept} (HOD Only)` : displayScopeName}
                </span>
                {!isRestrictedHodMode && <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
              </button>
            )}

            {showDeptMenu && !isRestrictedHodMode && !lockedDept && (
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
                {deptScopes.map((scope) => {
                  const isSelected = (scope === 'All Departments' && !isSpecificDeptSelected) || currentDept === scope;
                  return (
                    <button
                      key={scope}
                      onClick={() => {
                        if (onSelectDept) {
                          onSelectDept(scope === 'All Departments' ? '' : scope);
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

          {/* Google Sheets / Master Matrix Sync Controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="border border-emerald-300 hover:border-emerald-400 bg-emerald-50/80 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-2xs transition-colors"
              title="Synchronize with Central Master Matrix & Google Sheet"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-700 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Sync Sheet</span>
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
                  <div className="text-[11px] text-slate-500">{session.role}{session.department ? ` • ${session.department}` : ' • Plant-wide'}</div>
                </div>
                {can(session, 'manageUsers') && (
                  <button
                    onClick={() => {
                      onOpenUserManagement();
                      setShowUserMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-slate-50 transition-colors"
                  >
                    <UserCog className="w-3.5 h-3.5 text-blue-600" />
                    <span>Manage Users</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    onOpenChangePassword();
                    setShowUserMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-slate-50 transition-colors"
                >
                  <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                  <span>Change Password</span>
                </button>
                <button
                  onClick={() => {
                    onLogout();
                    setShowUserMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-red-50 text-red-600 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Logout</span>
                </button>
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
      </div>

      {/* Row 2: Navigation Tabs matching image.png */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-1.5 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        
        {/* Cockpit Tab */}
        <button
          onClick={() => setActiveTab('cockpit')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'cockpit'
              ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <LayoutGrid className="w-3.5 h-3.5 text-slate-500" />
          <span>Cockpit</span>
          <span className="bg-red-50 text-red-600 border border-red-200/80 text-[10px] font-bold px-2 py-0.5 rounded-full">
            167 alert
          </span>
        </button>

        {/* Master Matrix Tab (Active by default) */}
        <button
          onClick={() => setActiveTab('matrix')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'matrix'
              ? 'bg-[#eff6ff] text-[#2563eb] border border-blue-200 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#2563eb]" />
          <span>Master Matrix</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            activeTab === 'matrix' ? 'bg-[#dbeafe] text-[#1d4ed8]' : 'bg-slate-100 text-slate-600'
          }`}>
            {totalCount}
          </span>
        </button>

        {/* Saturday MOM Tab */}
        <button
          onClick={() => setActiveTab('saturday_mom')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'saturday_mom'
              ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Calendar className="w-3.5 h-3.5 text-slate-500" />
          <span>Saturday MOM</span>
          <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
            10
          </span>
        </button>

        {/* Recurring PM Tab */}
        <button
          onClick={() => setActiveTab('recurring_pm')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'recurring_pm'
              ? 'bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <RotateCw className="w-3.5 h-3.5 text-slate-500" />
          <span>Recurring PM</span>
          <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
            2
          </span>
        </button>

        {/* CFT Handshake Tab */}
        <button
          onClick={() => setActiveTab('cft_handshake')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'cft_handshake'
              ? 'bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Users className="w-3.5 h-3.5 text-slate-500" />
          <span>CFT Handshake</span>
          <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
            {cftCount ?? 915}
          </span>
        </button>

        {/* Kaizen / DSI Tab */}
        <button
          onClick={() => setActiveTab('kaizen')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'kaizen'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-slate-500" />
          <span>Kaizen / DSI</span>
          <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
            52
          </span>
        </button>

        {/* Dept Leaders & 4-V Tab */}
        <button
          onClick={() => setActiveTab('dept_leaders')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === 'dept_leaders'
              ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5 text-slate-500" />
          <span>Dept Leaders & 4-V</span>
        </button>
      </div>

      {/* Toast Notification when Syncing */}
      {syncToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 border border-slate-800 animate-in fade-in">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>{syncToast}</span>
        </div>
      )}
    </header>
  );
};
