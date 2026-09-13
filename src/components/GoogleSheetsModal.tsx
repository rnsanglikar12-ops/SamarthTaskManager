import React, { useState, useEffect } from 'react';
import {
  X,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  UploadCloud,
  DownloadCloud,
  ExternalLink,
  HelpCircle,
  Link,
  Sparkles,
  Camera
} from 'lucide-react';
import {
  getGoogleSheetUrl,
  setGoogleSheetUrl,
  isGoogleSheetConnected,
  testGoogleSheetConnection,
  fetchActionsFromGoogleSheet,
  pushAllActionsToGoogleSheet,
  getAppsScriptCode,
  getLastSyncTime
} from '../utils/googleSheetsService';
import { ActionItem } from '../types';

interface GoogleSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  actions: ActionItem[];
  onSyncCompleted: (newActions: ActionItem[], message: string) => void;
}

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({
  isOpen,
  onClose,
  actions,
  onSyncCompleted
}) => {
  const [urlInput, setUrlInput] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'status' | 'setup' | 'code'>('status');
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [isPushing, setIsPushing] = useState<boolean>(false);
  const [isPulling, setIsPulling] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; rowCount?: number } | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setUrlInput(getGoogleSheetUrl());
      setLastSync(getLastSyncTime());
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveUrl = async () => {
    setGoogleSheetUrl(urlInput);
    if (!urlInput.trim()) {
      setTestResult({ success: true, message: 'Disconnected Google Sheet. Reverted to built-in cloud matrix.' });
      return;
    }
    setIsTesting(true);
    const res = await testGoogleSheetConnection(urlInput.trim());
    setIsTesting(false);
    setTestResult(res);
  };

  const handleTestPing = async () => {
    setIsTesting(true);
    const res = await testGoogleSheetConnection(urlInput.trim());
    setIsTesting(false);
    setTestResult(res);
  };

  const handlePushToSheet = async () => {
    if (!urlInput.trim()) {
      alert('Please save a valid Google Sheet Web App URL first.');
      return;
    }
    const confirmed = window.confirm(
      `Push all ${actions.length} active tasks into your Google Sheet? This will format the sheet with standard headers and replace existing rows.`
    );
    if (!confirmed) return;

    setIsPushing(true);
    try {
      setGoogleSheetUrl(urlInput);
      const success = await pushAllActionsToGoogleSheet(actions);
      if (success) {
        setLastSync(new Date().toLocaleString());
        onSyncCompleted(actions, `Pushed ${actions.length} tasks successfully to Google Sheet!`);
        setTestResult({
          success: true,
          message: `Successfully uploaded ${actions.length} rows to Google Sheet.`
        });
      } else {
        setTestResult({ success: false, message: 'Google Sheet returned error during batch upload.' });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err?.message || 'Failed to upload to Google Sheet' });
    } finally {
      setIsPushing(false);
    }
  };

  const handlePullFromSheet = async () => {
    if (!urlInput.trim()) {
      alert('Please save a valid Google Sheet Web App URL first.');
      return;
    }

    setIsPulling(true);
    try {
      setGoogleSheetUrl(urlInput);
      const freshActions = await fetchActionsFromGoogleSheet();
      if (freshActions && freshActions.length > 0) {
        setLastSync(new Date().toLocaleString());
        onSyncCompleted(freshActions, `Pulled ${freshActions.length} live tasks from Google Sheet!`);
        setTestResult({
          success: true,
          message: `Loaded ${freshActions.length} tasks from your Google Sheet.`
        });
      } else {
        setTestResult({
          success: true,
          message: 'Google Sheet is currently empty. Click "Push All Tasks to Sheet" to populate it.'
        });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err?.message || 'Failed to pull from Google Sheet.' });
    } finally {
      setIsPulling(false);
    }
  };

  const handleCopyCode = () => {
    const code = getAppsScriptCode();
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const isConnected = isGoogleSheetConnected();

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-xs">
              <FileSpreadsheet className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">Google Sheets Cloud Backend</h2>
                <span className="bg-emerald-400/30 text-emerald-100 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border border-white/20">
                  100% Free Lifetime
                </span>
              </div>
              <p className="text-xs text-emerald-100">
                Connect your master Google Sheet to store, sync, and edit all tasks with zero recurring fees.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('status')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'status'
                ? 'bg-white text-emerald-700 border-t-2 border-emerald-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Link className="w-3.5 h-3.5" />
            Connection & Live Sync
          </button>
          <button
            onClick={() => setActiveTab('setup')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'setup'
                ? 'bg-white text-emerald-700 border-t-2 border-emerald-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            3-Minute Setup Guide
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'code'
                ? 'bg-white text-emerald-700 border-t-2 border-emerald-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Copy className="w-3.5 h-3.5" />
            Google Apps Script Code
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          
          {/* TAB 1: CONNECTION & LIVE SYNC */}
          {activeTab === 'status' && (
            <div className="space-y-5">
              
              {/* Status Banner */}
              <div
                className={`p-4 rounded-xl border flex items-center justify-between ${
                  isConnected
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                    }`}
                  />
                  <div>
                    <h4 className="font-bold text-sm">
                      {isConnected ? 'Google Sheet Backend Connected' : 'Google Sheet Not Yet Connected'}
                    </h4>
                    <p className="text-xs opacity-90">
                      {isConnected
                        ? `Real-time synchronization active. Last sync: ${lastSync || 'Just now'}`
                        : 'Currently using built-in local store. Connect your Google Sheet URL below to enable cloud sync.'}
                    </p>
                  </div>
                </div>
                {isConnected && (
                  <span className="text-[11px] font-bold bg-emerald-200/80 text-emerald-800 px-2.5 py-1 rounded-full">
                    Active Webhook
                  </span>
                )}
              </div>

              {/* Web App URL Input */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Google Apps Script Web App URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                  <button
                    onClick={handleSaveUrl}
                    disabled={isTesting}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors shrink-0 flex items-center gap-1.5 shadow-xs"
                  >
                    {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Save & Test
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Must be deployed as <strong>Web app</strong> with access set to <strong>"Anyone"</strong>. See the Setup Guide tab.
                </p>
              </div>

              {/* Test Connection Message */}
              {testResult && (
                <div
                  className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
                    testResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <span className="font-semibold">{testResult.message}</span>
                    {testResult.rowCount !== undefined && (
                      <span className="block mt-0.5 text-slate-600">
                        Spreadsheet currently holds {testResult.rowCount} tasks.
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                  Two-Way Data Synchronization
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  
                  {/* Push button */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                        <UploadCloud className="w-4 h-4 text-emerald-600" />
                        Push All Tasks to Sheet
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Populates or overwrites the Google Sheet with the master matrix ({actions.length} tasks).
                      </p>
                    </div>
                    <button
                      onClick={handlePushToSheet}
                      disabled={isPushing || !urlInput.trim()}
                      className="mt-3 w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                    >
                      {isPushing ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Uploading Rows...
                        </>
                      ) : (
                        <>
                          <UploadCloud className="w-3.5 h-3.5" />
                          Upload {actions.length} Tasks
                        </>
                      )}
                    </button>
                  </div>

                  {/* Pull button */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                        <DownloadCloud className="w-4 h-4 text-blue-600" />
                        Pull All Tasks from Sheet
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Fetches live rows edited by team members directly in Google Sheets.
                      </p>
                    </div>
                    <button
                      onClick={handlePullFromSheet}
                      disabled={isPulling || !urlInput.trim()}
                      className="mt-3 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                    >
                      {isPulling ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Fetching Data...
                        </>
                      ) : (
                        <>
                          <DownloadCloud className="w-3.5 h-3.5" />
                          Fetch Live Tasks
                        </>
                      )}
                    </button>
                  </div>

                </div>
              </div>

            </div>
          )}

          {/* TAB 2: SETUP GUIDE */}
          {activeTab === 'setup' && (
            <div className="space-y-4 text-xs text-slate-700">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <h3 className="font-bold text-sm text-emerald-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  How to setup your Free Google Sheet Backend in 3 minutes
                </h3>
                <p className="text-emerald-800 mt-1 text-xs">
                  Follow these 5 simple steps. You only need a standard Google Account. No billing or credit card required.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                    1
                  </span>
                  <div>
                    <h4 className="font-bold text-slate-900">Open or Create a Google Sheet</h4>
                    <p className="text-slate-600 mt-0.5">
                      Go to <a href="https://sheets.new" target="_blank" rel="noreferrer" className="text-blue-600 underline font-semibold inline-flex items-center gap-0.5">sheets.new <ExternalLink className="w-3 h-3" /></a> and name your sheet (e.g. <em>"Samarth Industries - Master Action Matrix"</em>).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                    2
                  </span>
                  <div>
                    <h4 className="font-bold text-slate-900">Open Extensions &gt; Apps Script</h4>
                    <p className="text-slate-600 mt-0.5">
                      In the Google Sheets menu bar at the top, click <strong>Extensions</strong>, then click <strong>Apps Script</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                    3
                  </span>
                  <div>
                    <h4 className="font-bold text-slate-900">Paste the Provided Code</h4>
                    <p className="text-slate-600 mt-0.5">
                      Delete any existing code in the editor, switch to the <strong>Google Apps Script Code</strong> tab above, click <strong>Copy Code</strong>, and paste it into the editor. Press <kbd className="px-1.5 py-0.5 bg-slate-200 rounded text-[10px]">Ctrl+S</kbd> to save.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                    4
                  </span>
                  <div>
                    <h4 className="font-bold text-slate-900">Deploy as a Web App</h4>
                    <p className="text-slate-600 mt-0.5">
                      Click the blue <strong>Deploy</strong> button (top-right) &gt; <strong>New deployment</strong>.
                    </p>
                    <ul className="list-disc list-inside mt-1.5 space-y-1 text-slate-600 font-medium">
                      <li>Click the gear icon and choose <strong>Web app</strong>.</li>
                      <li>Execute as: <strong>Me</strong>.</li>
                      <li>Who has access: <strong>Anyone</strong> (critical so your team can sync tasks).</li>
                      <li>Click <strong>Deploy</strong> and approve Google permissions.</li>
                    </ul>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center shrink-0 text-xs">
                    5
                  </span>
                  <div>
                    <h4 className="font-bold text-slate-900">Copy the Web App URL &amp; Paste in this App</h4>
                    <p className="text-slate-600 mt-0.5">
                      Copy the generated URL ending with <code>/exec</code>, paste it into the input on the <strong>Connection &amp; Live Sync</strong> tab, and click <strong>Push All Tasks to Sheet</strong>!
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 bg-blue-50/70 rounded-xl border border-blue-200 text-blue-950">
                  <Camera className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-xs text-blue-900">How Photos Are Handled in Google Sheets</h4>
                    <p className="text-[11px] text-blue-800 mt-1 leading-relaxed">
                      Google Sheets cells have character limits and cannot directly embed raw image data. The Apps Script automatically creates a dedicated folder in your Google Drive (<strong>Samarth_Action_Photos</strong>), saves the before/after photos into Drive, and writes permanent, clickable direct links into the <em>"Problem Photo (Drive Link)"</em> and <em>"After Photo (Evidence Link)"</em> columns.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CODE VIEWER */}
          {activeTab === 'code' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                    Google Apps Script Webhook Code
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Paste this into Google Sheets &gt; Extensions &gt; Apps Script.
                  </p>
                </div>
                <button
                  onClick={handleCopyCode}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedCode ? 'Copied to Clipboard!' : 'Copy Entire Code'}
                </button>
              </div>

              <pre className="bg-slate-900 text-emerald-300 p-4 rounded-xl text-[11px] font-mono overflow-x-auto max-h-[360px] leading-relaxed border border-slate-800">
                {getAppsScriptCode()}
              </pre>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3.5 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Zero database subscriptions • Full spreadsheet ownership
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-xl text-xs transition-colors"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
