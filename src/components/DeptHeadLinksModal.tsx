import React, { useState } from 'react';
import { 
  Link2, 
  Copy, 
  Check, 
  ExternalLink, 
  Lock, 
  ShieldCheck, 
  X, 
  Building2, 
  UserCheck,
  AlertTriangle,
  Info,
  Globe,
  Share2,
  Crown
} from 'lucide-react';
import { SAMARTH_ORG_STRUCTURE } from '../data/orgStructure';
import { 
  canViewDeptHeadLinks, 
  getActiveRole, 
  isSecretControlUnlocked, 
  verifySecretPassword 
} from '../utils/security';

interface DeptHeadLinksModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDept: (dept: string) => void;
  onOpenSecretControl: () => void;
}

// Automatically resolve public shareable URL, replacing private ais-dev with ais-pre to eliminate Google Error 403 Forbidden
export function getShareableBaseUrl(): string {
  if (typeof window === 'undefined') {
    return 'https://ais-pre-ypodqag266rhybs55pu22y-866441732950.asia-east1.run.app';
  }
  let origin = window.location.origin;
  if (origin.includes('ais-dev-')) {
    origin = origin.replace('ais-dev-', 'ais-pre-');
  }
  return origin;
}

export const DeptHeadLinksModal: React.FC<DeptHeadLinksModalProps> = ({
  isOpen,
  onClose,
  onSelectDept,
  onOpenSecretControl
}) => {
  if (!isOpen) return null;

  const [copiedDept, setCopiedDept] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [tempAuthorized, setTempAuthorized] = useState(false);
  const [showTroubleshoot, setShowTroubleshoot] = useState(true);
  const [urlType, setUrlType] = useState<'shared' | 'direct'>('shared');

  const activeRole = getActiveRole();
  const unlocked = isSecretControlUnlocked();
  const sessionLinksUnlocked = typeof window !== 'undefined' && sessionStorage.getItem('samarth_links_unlocked') === 'true';
  const isAuthorized = tempAuthorized || sessionLinksUnlocked || unlocked;

  const publicBaseUrl = getShareableBaseUrl();
  const directBaseUrl = typeof window !== 'undefined' ? window.location.origin : publicBaseUrl;
  const activeBaseUrl = urlType === 'shared' ? publicBaseUrl : directBaseUrl;

  const handleCopyLink = (deptName: string, isPlantHead = false) => {
    let url: string;
    if (isPlantHead) {
      url = `${activeBaseUrl}/?role=planthead`;
    } else {
      url = `${activeBaseUrl}/?dept=${encodeURIComponent(deptName)}&access=hod`;
    }
    navigator.clipboard.writeText(url);
    setCopiedDept(deptName);
    setTimeout(() => setCopiedDept(null), 2500);
  };

  const handleAuthorize = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifySecretPassword(pinInput)) {
      setTempAuthorized(true);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('samarth_links_unlocked', 'true');
      }
      setAuthError(null);
    } else {
      setAuthError('Invalid Secret Passcode. Authorized for MD, Plant Head, and Mentor only.');
    }
  };

  // Find Plant Head structure
  const plantHeadDept = SAMARTH_ORG_STRUCTURE.find(d => d.deptName === 'Plant Head');
  // 15 Operational HOD departments (excluding MD and Plant Head which has its executive card)
  const operationalDepts = SAMARTH_ORG_STRUCTURE.filter(d => d.deptName !== 'MD' && d.deptName !== 'Plant Head');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div 
        className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900">
                  Plant Head & HOD Direct Access Portals
                </h3>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  Public Shared URLs
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Direct access links generated for Plant Head (Awari B.) & 15 Department Heads • Error 403 Protected
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Error Troubleshooting Guide Banner */}
          <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-2xl space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Fixing "Requested URL not found" (404) & "Access Denied" (403)</span>
              </div>
              <button
                type="button"
                onClick={() => setShowTroubleshoot(!showTroubleshoot)}
                className="text-[11px] text-amber-800 font-semibold underline hover:text-amber-900 shrink-0"
              >
                {showTroubleshoot ? 'Collapse' : 'Show Fix'}
              </button>
            </div>

            {showTroubleshoot && (
              <div className="space-y-2.5 text-xs text-amber-950">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {/* Case 1: 404 Not Found */}
                  <div className="p-3 bg-white/90 rounded-xl border border-amber-200/80 space-y-1">
                    <div className="font-bold text-red-700 flex items-center gap-1.5 text-[11px]">
                      <span>1. "Requested URL was not found on this server" (404)</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-normal">
                      The public link (<code className="text-blue-700 font-mono">ais-pre-...</code>) is inactive until published in AI Studio.
                    </p>
                    <div className="mt-1.5 p-1.5 bg-emerald-50 border border-emerald-200 rounded text-[11px] font-semibold text-emerald-800">
                      👉 <strong>Action:</strong> Click the <strong>"Share"</strong> button at the top-right corner of Google AI Studio to publish it.
                    </div>
                  </div>

                  {/* Case 2: 403 Forbidden */}
                  <div className="p-3 bg-white/90 rounded-xl border border-amber-200/80 space-y-1">
                    <div className="font-bold text-amber-800 flex items-center gap-1.5 text-[11px]">
                      <span>2. "Error 403: Forbidden"</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-normal">
                      Happens when sending the private <code className="text-amber-700 font-mono">ais-dev-...</code> link to another person's device.
                    </p>
                    <div className="mt-1.5 p-1.5 bg-blue-50 border border-blue-200 rounded text-[11px] font-semibold text-blue-800">
                      👉 <strong>Action:</strong> Use the <strong>Public Shared Link</strong> below once published via the Share button.
                    </div>
                  </div>
                </div>

                {/* Target URL Selector */}
                <div className="pt-2 border-t border-amber-200/70 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-slate-700">Link Generation Mode:</span>
                  <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setUrlType('shared')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        urlType === 'shared'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      Public Shared (ais-pre)
                    </button>
                    <button
                      type="button"
                      onClick={() => setUrlType('direct')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        urlType === 'direct'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      Direct Workspace (Current)
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {!isAuthorized ? (
            <div className="py-6 px-4 text-center max-w-md mx-auto space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center mx-auto shadow-xs">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-base text-slate-900">Restricted Executive Access</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Department Head direct links are confidential and managed by the Managing Director (Mr. Sangram), Plant Head (Awari B.), or Mentor (Mr. Sanglikar).
                </p>
              </div>

              {authError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  {authError}
                </div>
              )}

              <form onSubmit={handleAuthorize} className="space-y-3 pt-2">
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="Enter Master Passcode or Plant Head PIN..."
                  className="w-full py-2.5 px-3 bg-white border border-slate-300 rounded-xl text-xs font-mono text-center outline-none focus:border-blue-500 shadow-2xs"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs"
                  >
                    Unlock Portals
                  </button>
                  <button
                    type="button"
                    onClick={onOpenSecretControl}
                    className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                  >
                    Secret Control
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="space-y-5">
              {/* VIP CARD: Plant Head (Awari B.) */}
              <div className="p-4 bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-blue-500/10 border-2 border-amber-300 rounded-2xl shadow-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                      <Crown className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-base text-slate-900">
                          Plant Head Executive Portal (Awari B.)
                        </h4>
                        <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 font-bold px-2 py-0.5 rounded-full">
                          Top Authority
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">
                        Full plant oversight across all 16 departments • Target date revision & task deletion privileges
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-2.5 bg-white/90 rounded-xl border border-amber-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-mono">
                        {urlType === 'shared' ? 'ais-pre (Public Shared)' : 'ais-dev (Direct Workspace)'}
                      </span>
                    </div>
                    <div className="font-mono text-[11px] text-slate-700 truncate max-w-md">
                      {activeBaseUrl}/?role=planthead
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyLink('Plant Head', true)}
                      className={`py-2 px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs ${
                        copiedDept === 'Plant Head'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-amber-600 hover:bg-amber-700 text-white'
                      }`}
                    >
                      {copiedDept === 'Plant Head' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedDept === 'Plant Head' ? 'Link Copied!' : 'Copy Plant Head Link'}</span>
                    </button>
                    <a
                      href={`${activeBaseUrl}/?role=planthead`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-slate-600 hover:text-slate-900 hover:bg-white rounded-xl border border-slate-200 transition-colors"
                      title="Test Plant Head Link in New Tab"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>

              {/* 15 Department Heads Direct Links Grid */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500">
                    Individual Department Head Direct Links (15 Departments)
                  </h4>
                  <span className="text-[11px] text-slate-500 font-semibold">
                    Pre-filtered to their respective sections
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {operationalDepts.map((dept) => {
                    const isCopied = copiedDept === dept.deptName;
                    return (
                      <div 
                        key={dept.srNo}
                        className="p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-300 transition-all shadow-2xs space-y-2 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1 text-[10px]">
                            <span className="font-mono font-bold text-slate-400">
                              DEPT #{dept.srNo}
                            </span>
                            <span className="font-semibold text-slate-600 truncate max-w-[120px]">
                              HOD: {dept.deptHead}
                            </span>
                          </div>
                          <h4 className="font-bold text-xs text-slate-900 mt-1">
                            {dept.deptName}
                          </h4>
                        </div>

                        <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => handleCopyLink(dept.deptName)}
                            className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-all ${
                              isCopied 
                                ? 'bg-emerald-600 text-white shadow-xs' 
                                : 'bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200'
                            }`}
                          >
                            {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            <span>{isCopied ? 'Copied!' : 'Copy HOD Link'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              onSelectDept(dept.deptName);
                              onClose();
                            }}
                            className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                            title={`View ${dept.deptName} Dashboard`}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>Public Link Resolution Active • Protected against Google Error 403</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

