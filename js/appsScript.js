import { Auth } from './auth.js';

const BASE = 'https://script.googleapis.com/v1';

async function authHeaders() {
  const token = await Auth.getAccessToken();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function apiFetch(url, options = {}) {
  const headers = { ...(await authHeaders()), ...(options.headers || {}) };
  const resp = await fetch(url, { ...options, headers });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Apps Script API ${resp.status}: ${body}`);
  }
  return resp.json();
}

const MANIFEST = JSON.stringify({
  timeZone: 'America/Costa_Rica',
  dependencies: {},
  exceptionLogging: 'STACKDRIVER',
  runtimeVersion: 'V8',
});

// Apps Script onEdit simple trigger: when Estado (col C) changes on a
// derived tab (Trabajo or Ejecutivo N), push the new value to the master
// row in Total compañías and restore the formula so the cell stays linked.
const SYNC_CODE = [
  "var TOTAL = 'Total compañías';",
  "var TRABAJO = 'Trabajo';",
  "var EJ_RE = /^Ejecutivo \\d+$/;",
  "",
  "function onEdit(e) {",
  "  if (!e) return;",
  "  try {",
  "    var range = e.range;",
  "    var sheet = range.getSheet();",
  "    var name  = sheet.getName();",
  "    var col   = range.getColumn();",
  "    var row   = range.getRow();",
  "    if (col !== 3 || row < 2) return;",
  "    var isDerived = name === TRABAJO || EJ_RE.test(name);",
  "    if (!isDerived) return;",
  "    var newValue = e.value;",
  "    var aFormula = sheet.getRange(row, 1).getFormula();",
  "    var m = aFormula.match(/!A(\\d+)/);",
  "    if (!m) return;",
  "    var masterRow = parseInt(m[1], 10);",
  "    var totalSheet = e.source.getSheetByName(TOTAL);",
  "    if (!totalSheet) return;",
  "    totalSheet.getRange(masterRow, 3).setValue(newValue);",
  "    var q = \"'\" + TOTAL.replace(/'/g, \"''\") + \"'\";",
  "    sheet.getRange(row, 3).setFormula('=' + q + '!C' + masterRow);",
  "  } catch (err) {",
  "    console.error('onEdit sync error:', err);",
  "  }",
  "}",
].join('\n');

export const AppsScript = {
  /** Create a bound Apps Script project on the spreadsheet with
   *  an onEdit trigger that syncs Estado changes bidirectionally. */
  async install(spreadsheetId) {
    const project = await apiFetch(`${BASE}/projects`, {
      method: 'POST',
      body: JSON.stringify({
        title: 'Acquirer Management Sync',
        parentId: spreadsheetId,
      }),
    });

    await apiFetch(`${BASE}/projects/${project.scriptId}/content`, {
      method: 'PUT',
      body: JSON.stringify({
        files: [
          { name: 'appsscript', type: 'JSON',      source: MANIFEST },
          { name: 'sync',       type: 'SERVER_JS',  source: SYNC_CODE },
        ],
      }),
    });

    return project.scriptId;
  },
};
