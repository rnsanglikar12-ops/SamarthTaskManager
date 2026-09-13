import { ActionItem, Priority, Recurrence, ActionStatus } from '../types';
import chunk1 from './sentinel_chunk1.csv?raw';
import chunk2 from './sentinel_chunk2.csv?raw';
import chunk3 from './sentinel_chunk3.csv?raw';
import chunk4 from './sentinel_chunk4.csv?raw';
import chunk5 from './sentinel_chunk5.csv?raw';

/**
 * Robust CSV parser handling RFC 4180 quotes, commas inside strings, and multiline text.
 */
function parseCsv(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentField.trim());
      if (currentRow.some(field => field.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(field => field.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function normalizeStatus(rawStatus: string): ActionStatus {
  const lower = (rawStatus || '').toLowerCase().trim();
  if (lower.includes('complete') || lower.includes('closed') || lower === 'done') return 'Completed';
  if (lower.includes('in process') || lower.includes('inprocess') || lower.includes('in-process')) return 'In process';
  if (lower.includes('verification') || lower.includes('review')) return 'Under Verification';
  if (lower.includes('hold') || lower.includes('blocked')) return 'Hold';
  return 'Pending';
}

function normalizePriority(raw: string): Priority {
  const upper = (raw || '').trim().toUpperCase();
  return upper === 'B' ? 'B' : 'A';
}

function normalizeRecurrence(raw: string): Recurrence {
  const lower = (raw || '').toLowerCase().trim();
  if (lower.includes('daily')) return 'Daily';
  if (lower.includes('week')) return 'Weekly';
  return 'One-Time';
}

export const SAMARTH_PLANT_ASSIGNEES = [
  // HODs & Operational Leadership (Note: MD Mr. Sangram J. does not attract tasks)
  'Awari B',
  'Shrirang C.',
  'Ibrahim S',
  'Sunil G',
  'Ratan S',
  'Dipak G',
  'Mohite R',
  'Shailesh T',
  'Ravindra N',
  'Poonam S',
  'Sushant D',
  'Pankaj B',
  'Ganesh P',
  // Supervisors & Key Technical Staff
  'Kamble K.',
  'Pande J.',
  'Jagtap',
  'Harish P',
  'Kisan G',
  'Subrata G',
  'Rakshe R.',
  'Madan G',
  'Rakesh',
  'Santosh P',
  'Dey S',
  'Ram Y',
  'Hanumant H',
  'Situn',
  'Dilip R',
  'Kiran',
  'Dilip P',
  'Shivashankar',
  'Vaibhav W.',
  'Ashok K',
  'Purushottam P',
  'Masud K',
  'Alok',
  'Rupesh D',
  'Vyanket',
  'Dipak D',
  'Nayan P',
  'Yogesh J',
  'Pratyay',
  'Trivenee',
  'Siddharth',
  'Govind'
];

export const PLANT_ASSIGNEES_29 = SAMARTH_PLANT_ASSIGNEES;

// Helper to check if a task was raised to another department (Inter-departmental CFT Handshake)
export function isRaisedToOtherDept(originatorDept?: string, targetDept?: string): boolean {
  if (!originatorDept || !targetDept) return false;
  const orig = originatorDept.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const target = targetDept.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  
  if (!orig || !target) return false;
  if (orig === target) return false;
  // If one starts with the other or is identical (e.g. "machineshop" vs "machineshop01", or "quality" vs "qualitydept")
  if (orig.startsWith(target) || target.startsWith(orig)) return false;
  return true;
}

// Helper to map old Sentinel placeholder names or MD to legitimate Samarth staff
function sanitizeOwner(rawOwner: string, dept: string): string {
  const o = (rawOwner || '').trim();
  const lower = o.toLowerCase();

  // Mr. Sangram is MD and does not attract any tasks
  if (lower.includes('sangram')) {
    return 'Awari B'; // Direct to Plant Head
  }

  // Sentinel placeholder names to be removed
  const isSentinel = 
    lower.includes('ravi') || 
    lower.includes('vikas') || 
    lower.includes('krishna') || 
    lower.includes('sahadeo') || 
    lower.includes('sahdev') || 
    lower.includes('shubham') || 
    lower.includes('jitendra') || 
    lower.includes('sachin') || 
    lower.includes('sandip') || 
    lower.includes('rahul') || 
    lower.includes('vishal') || 
    lower.includes('amol') ||
    o === 'Unassigned' ||
    !o;

  if (isSentinel) {
    const dLower = dept.toLowerCase();
    if (dLower.includes('quality')) return 'Shailesh T';
    if (dLower.includes('pdc') || dLower.includes('die') || dLower.includes('fettling') || dLower.includes('spm')) return 'Shrirang C.';
    if (dLower.includes('maint')) return 'Ibrahim S';
    if (dLower.includes('machine shop-01') || dLower.includes('ms-01')) return 'Ibrahim S';
    if (dLower.includes('machine shop-02') || dLower.includes('ms-02')) return 'Sunil G';
    if (dLower.includes('ppc')) return 'Ratan S';
    if (dLower.includes('store') || dLower.includes('purchase')) return 'Pankaj B';
    if (dLower.includes('tool') || dLower.includes('npd')) return 'Ravindra N';
    if (dLower.includes('hr')) return 'Poonam S';
    if (dLower.includes('account')) return 'Sushant D';
    if (dLower.includes('plant head')) return 'Awari B';
    return 'Awari B';
  }

  return o;
}

export function loadBaseSentinelActions(): ActionItem[] {
  const allCsvText = [chunk1, chunk2, chunk3, chunk4, chunk5].join('\n');
  const rawRows = parseCsv(allCsvText);
  const itemsMap = new Map<number, ActionItem>();

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.length < 5) continue;

    // Check if header row
    if (row[0].toLowerCase().includes('task') || row[0].toLowerCase().includes('id') || row[3]?.toLowerCase() === 'department') {
      continue;
    }

    const idNum = parseInt(row[0], 10);
    if (isNaN(idNum) || idNum < 1 || idNum > 1050) continue;
    if (itemsMap.has(idNum)) continue; // Ensure strictly unique 1-1050

    const id = idNum;
    const priority = normalizePriority(row[1]);
    const recurrence = normalizeRecurrence(row[2]);
    const dept = (row[3] || 'General').trim();
    let desc = (row[4] || '').trim();
    let owner = (row[5] || 'Unassigned').trim();
    let deadline = (row[6] || '').trim();
    let evidence = (row[7] || 'Photo Proof').trim();
    let rawStatus = (row[8] || 'Pending').trim();
    let actionNotes = (row[9] || '').trim();
    let attachedPhoto = (row[10] || '').trim();
    let timestamp = (row[11] || new Date().toISOString()).trim();
    let originatorDept = (row[12] || 'Store').trim();
    let afterPhoto = (row[13] || '').trim();

    // Self-healing guard: If owner is a long task description and column 6 or 7 has the real owner name / date
    if (owner.length > 30 || owner.includes(':') || owner.includes('&') || (!deadline.startsWith('202') && deadline.length > 0 && !deadline.includes('-'))) {
      if (row.length > 7 && (row[7].startsWith('2026-') || row[8]?.startsWith('2026-'))) {
        desc = `${desc}, ${owner}`.trim();
        owner = deadline;
        deadline = row[7].trim();
        evidence = row[8] || 'Photo Proof';
        rawStatus = row[9] || 'Pending';
        actionNotes = row[10] || '';
        attachedPhoto = row[11] || '';
        timestamp = row[12] || new Date().toISOString();
        originatorDept = row[13] || 'Store';
        afterPhoto = row[14] || '';
      }
    }

    // Extract machine / operational subnote
    let machineNote: string | undefined = undefined;
    if (actionNotes && actionNotes.length > 0 && !actionNotes.includes('[DSI')) {
      machineNote = actionNotes;
    }
    if (id === 651) machineNote = 'Collect old Hand gloves';
    if (id === 650) machineNote = 'वायरमेश साठी जागा बनवणे';
    if (id === 649) machineNote = 'गँगवे मार्किंग करणे ऑन जीडीसी';
    if (id === 648) machineNote = 'सँड ब्लास्टिंग करणे';
    if (id === 644) machineNote = 'fit loose wiring';

    // Kaizen detection
    const isKaizen = desc.includes('[DSI Kaizen]') || actionNotes.includes('[DSI Benefit:') || (id >= 20 && id <= 71);
    let kaizenBenefit = '';
    if (actionNotes.includes('[DSI Benefit:')) {
      const match = actionNotes.match(/\[DSI Benefit:\s*([^\]]+)\]/);
      if (match && match[1]) {
        kaizenBenefit = match[1].trim();
      }
    }

    // Saturday MOM classification (exactly 10 tasks)
    const isMOM = (id >= 191 && id <= 200);

    // Recurring PM classification (exactly 2 tasks)
    const isRecurringPM = (id === 4 || id === 12);
    const resolvedRecurrence = isRecurringPM ? 'Weekly' : 'One-Time';

    // CFT Handshake classification: strictly tasks raised to another department only (Originator Dept != Target Dept)
    const isCFT = isRaisedToOtherDept(originatorDept, dept);

    const isBroadcast = desc.toLowerCase().includes('all') || dept.toLowerCase().includes('all');

    // Sanitize owner to remove Sentinel names and ensure MD Sangram does not attract tasks
    const cleanOwner = sanitizeOwner(owner, dept);

    itemsMap.set(id, {
      id,
      priority,
      recurrence: resolvedRecurrence,
      dept,
      desc,
      owner: cleanOwner,
      deadline,
      evidence,
      status: normalizeStatus(rawStatus),
      actionNotes,
      attachedPhoto: attachedPhoto || undefined,
      timestamp,
      originatorDept,
      afterPhoto: afterPhoto || undefined,
      isKaizen,
      kaizenBenefit: kaizenBenefit || undefined,
      isBroadcast,
      isMOM,
      isCFT,
      machineNote
    });
  }

  // Convert map to sorted array descending by ID (1050, 1049, 1048, ...)
  const sortedItems = Array.from(itemsMap.values()).sort((a, b) => b.id - a.id);
  return sortedItems;
}

export const loadBaseActions = loadBaseSentinelActions;

const STORAGE_KEY = 'samarth_industries_matrix_v4';

export function getInitialActions(): ActionItem[] {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('samarth_sentinel_actions_v1');
      localStorage.removeItem('samarth_industries_actions_v2');
      localStorage.removeItem('samarth_sentinel_matrix_v3');

      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: ActionItem[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 1050 && parsed[0]?.id === 1050) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse actions from localStorage, using base data', e);
    }
  }

  const base = loadBaseSentinelActions();
  return base;
}

export function saveActionsToStorage(actions: ActionItem[]): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(actions));
    } catch (e) {
      console.error('Failed to save actions to localStorage', e);
    }
  }
}
