import { ActionItem } from '../types';

export function exportActionsToCsv(actions: ActionItem[], filename = 'samarth_industries_actions.csv'): void {
  const headers = [
    'ID',
    'Priority',
    'Recurrence',
    'Department',
    'Description',
    'Owner / Assignee',
    'Deadline',
    'Evidence Requirement',
    'Status',
    'Action Notes',
    'Originator Department',
    'Is Kaizen',
    'Kaizen Benefit'
  ];

  // Free-text fields (desc, actionNotes, owner, ...) come from real users and
  // can start with =, +, -, or @ — Excel/Sheets treats a cell starting with
  // one of those as a formula on open, not literal text (CSV/formula
  // injection). Prefixing with a straight quote forces it to stay literal
  // without changing the visible value.
  const escapeCsv = (str: string | number | boolean | undefined | null) => {
    if (str === undefined || str === null) return '""';
    let s = String(str);
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    s = s.replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = actions.map(a => [
    escapeCsv(a.id),
    escapeCsv(a.priority),
    escapeCsv(a.recurrence),
    escapeCsv(a.dept),
    escapeCsv(a.desc),
    escapeCsv(a.owner),
    escapeCsv(a.deadline),
    escapeCsv(a.evidence),
    escapeCsv(a.status),
    escapeCsv(a.actionNotes),
    escapeCsv(a.originatorDept),
    escapeCsv(a.isKaizen ? 'Yes' : 'No'),
    escapeCsv(a.kaizenBenefit || '')
  ].join(','));

  const csvContent = [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportActionsToJson(actions: ActionItem[], filename = 'samarth_industries_actions.json'): void {
  const jsonContent = JSON.stringify(actions, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
