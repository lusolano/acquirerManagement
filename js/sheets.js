import { Auth } from './auth.js';
import { Companies } from './companies.js';

const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

// Tab names used across the app
export const TAB = {
  TOTAL:    'Total compañías',
  TRABAJO:  'Trabajo',
  EJECUTIVO: (n) => `Ejecutivo ${n}`,
};

// Master columns: A=Id, B=Nombre, C=Estado, D=Ejecutivo
const HEADERS = ['Id', 'Nombre', 'Estado', 'Ejecutivo'];
const COL_COUNT = HEADERS.length;

const NUM_COMPANIES  = 1000;
const NUM_TRABAJO    = 280;
const NUM_EJECUTIVOS = 8;

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
    throw new Error(`Sheets API ${resp.status}: ${body}`);
  }
  if (resp.status === 204) return null;
  return resp.json();
}

// Quote a sheet name for use inside a formula reference / A1 range.
// 'Total compañías' → "'Total compañías'"
function quoteSheet(name) {
  return `'${name.replace(/'/g, "''")}'`;
}

// Build a formula that references a single cell in the Total compañías tab.
function formulaRef(column, row) {
  return `=${quoteSheet(TAB.TOTAL)}!${column}${row}`;
}

// Build a full row of formulas that mirrors row `r` of Total compañías.
function linkedRow(r) {
  return [
    formulaRef('A', r),
    formulaRef('B', r),
    formulaRef('C', r),
    formulaRef('D', r),
  ];
}

export const Sheets = {
  // ── Metadata ────────────────────────────────────────────────────────
  async getSpreadsheetMeta(spreadsheetId) {
    const url = `${BASE}/${spreadsheetId}?fields=sheets(properties(sheetId,title,gridProperties))`;
    return apiFetch(url);
  },

  async findSheet(spreadsheetId, title) {
    const meta = await this.getSpreadsheetMeta(spreadsheetId);
    return meta.sheets?.find(s => s.properties.title === title) || null;
  },

  // ── Values read / write ─────────────────────────────────────────────
  async readValues(spreadsheetId, range) {
    const encoded = encodeURIComponent(range);
    const data = await apiFetch(`${BASE}/${spreadsheetId}/values/${encoded}`);
    return data.values || [];
  },

  async writeValues(spreadsheetId, range, values, valueInputOption = 'USER_ENTERED') {
    const encoded = encodeURIComponent(range);
    return apiFetch(
      `${BASE}/${spreadsheetId}/values/${encoded}?valueInputOption=${valueInputOption}`,
      { method: 'PUT', body: JSON.stringify({ values }) }
    );
  },

  async batchWriteValues(spreadsheetId, data, valueInputOption = 'RAW') {
    if (!data.length) return null;
    return apiFetch(`${BASE}/${spreadsheetId}/values:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ valueInputOption, data }),
    });
  },

  // ── batchUpdate helper (structural changes) ─────────────────────────
  async batchUpdate(spreadsheetId, requests) {
    if (!requests.length) return null;
    return apiFetch(`${BASE}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ requests }),
    });
  },

  // ── Create / recreate a tab ─────────────────────────────────────────
  /**
   * Ensures a fresh empty tab exists with the given title.
   * If a tab with this title already exists it is deleted first.
   * Returns the new sheetId.
   */
  async recreateTab(spreadsheetId, title, gridProps = {}) {
    const existing = await this.findSheet(spreadsheetId, title);
    const requests = [];
    if (existing) {
      requests.push({ deleteSheet: { sheetId: existing.properties.sheetId } });
    }
    requests.push({
      addSheet: {
        properties: {
          title,
          gridProperties: {
            rowCount: gridProps.rowCount || 2000,
            columnCount: gridProps.columnCount || COL_COUNT,
            frozenRowCount: 1,
          },
        },
      },
    });
    const result = await this.batchUpdate(spreadsheetId, requests);
    const addReply = result.replies?.find(r => r.addSheet)?.addSheet;
    return addReply?.properties?.sheetId;
  },

  // ── Data validation: dropdown on Estado column (column C) ───────────
  estadoValidationRequest(sheetId, rowCount) {
    return {
      setDataValidation: {
        range: {
          sheetId,
          startRowIndex: 1,            // skip header
          endRowIndex: rowCount + 1,   // inclusive of last data row
          startColumnIndex: 2,         // column C
          endColumnIndex: 3,
        },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: Companies.ESTADOS.map(v => ({ userEnteredValue: v })),
          },
          showCustomUi: true,
          strict: true,
        },
      },
    };
  },

  // ── Header styling ──────────────────────────────────────────────────
  headerFormatRequest(sheetId) {
    return {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: COL_COUNT,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.12, green: 0.23, blue: 0.37 },
            horizontalAlignment: 'CENTER',
            textFormat: {
              foregroundColor: { red: 1, green: 1, blue: 1 },
              bold: true,
            },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
      },
    };
  },

  autoResizeRequest(sheetId) {
    return {
      autoResizeDimensions: {
        dimensions: {
          sheetId,
          dimension: 'COLUMNS',
          startIndex: 0,
          endIndex: COL_COUNT,
        },
      },
    };
  },

  // ── Read Pendiente indices from Total compañías ─────────────────────
  /**
   * Reads A2:D{n+1} of Total compañías and returns the 1-indexed sheet
   * row numbers (matching formula references) of rows whose Estado is
   * exactly 'Pendiente'. Throws if Total compañías does not exist.
   */
  async readPendienteRows(spreadsheetId) {
    const total = await this.findSheet(spreadsheetId, TAB.TOTAL);
    if (!total) {
      throw new Error(`Primero genera la pestaña "${TAB.TOTAL}".`);
    }
    const rowCount = total.properties.gridProperties?.rowCount || (NUM_COMPANIES + 10);
    const range = `${quoteSheet(TAB.TOTAL)}!A2:D${rowCount}`;
    const values = await this.readValues(spreadsheetId, range);

    const pendiente = [];
    values.forEach((row, i) => {
      // row[2] is Estado. Empty rows / trimmed trailing rows show up as undefined.
      if ((row[2] || '') === Companies.DEFAULT_ESTADO) {
        pendiente.push(i + 2); // +1 for 0-indexed, +1 for header
      }
    });
    return pendiente;
  },

  // ══════════════════════════════════════════════════════════════════
  // PUBLIC OPERATIONS (mapped to the three SPA buttons)
  // ══════════════════════════════════════════════════════════════════

  /**
   * Button 1 — "Generar compañías"
   * Creates the "Total compañías" tab with 1000 random companies.
   *   Estado defaults to 'Pendiente'.
   *   Ejecutivo starts empty.
   */
  async generateTotalCompanias(spreadsheetId) {
    const sheetId = await this.recreateTab(spreadsheetId, TAB.TOTAL, {
      rowCount: NUM_COMPANIES + 10,
      columnCount: COL_COUNT,
    });

    const rows   = Companies.generate(NUM_COMPANIES);
    const values = [HEADERS, ...rows];
    await this.writeValues(
      spreadsheetId,
      `${quoteSheet(TAB.TOTAL)}!A1:D${values.length}`,
      values,
      'RAW', // literal values — no formula parsing needed
    );

    await this.batchUpdate(spreadsheetId, [
      this.headerFormatRequest(sheetId),
      this.estadoValidationRequest(sheetId, NUM_COMPANIES),
      this.autoResizeRequest(sheetId),
    ]);

    return { sheetId, count: NUM_COMPANIES };
  },

  /**
   * Button 2 — "Separar Compañias"
   * Creates "Trabajo" with 280 randomly-picked companies whose Estado
   * is currently 'Pendiente', linked to Total compañías via formulas
   * so updates to the master flow through.
   */
  async separarCompanias(spreadsheetId) {
    const pendingRows = await this.readPendienteRows(spreadsheetId);
    if (pendingRows.length < NUM_TRABAJO) {
      throw new Error(
        `Solo hay ${pendingRows.length} compañías con Estado "Pendiente" ` +
        `(se necesitan ${NUM_TRABAJO}).`,
      );
    }

    const sheetId = await this.recreateTab(spreadsheetId, TAB.TRABAJO, {
      rowCount: NUM_TRABAJO + 10,
      columnCount: COL_COUNT,
    });

    const picks = Companies.sampleFromArray(pendingRows, NUM_TRABAJO);
    const body  = picks.map(linkedRow);
    const values = [HEADERS, ...body];

    await this.writeValues(
      spreadsheetId,
      `${quoteSheet(TAB.TRABAJO)}!A1:D${values.length}`,
      values,
      'USER_ENTERED', // formulas must be parsed
    );

    await this.batchUpdate(spreadsheetId, [
      this.headerFormatRequest(sheetId),
      this.estadoValidationRequest(sheetId, NUM_TRABAJO),
      this.autoResizeRequest(sheetId),
    ]);

    return { sheetId, count: NUM_TRABAJO };
  },

  /**
   * Button 3 — "Asignar Empresas"
   * Reads all companies with Estado 'Pendiente', shuffles them, and
   * distributes them as evenly as possible across 8 "Ejecutivo N" tabs
   * via formula references. Then, for every assigned company, writes
   * back to Total compañías: Estado → 'Asignado' and Ejecutivo → tab name.
   */
  async asignarEmpresas(spreadsheetId) {
    const pendingRows = await this.readPendienteRows(spreadsheetId);
    if (pendingRows.length === 0) {
      throw new Error('No hay compañías con Estado "Pendiente" para asignar.');
    }

    // Shuffle (copy first so we don't mutate the cached array)
    const shuffled = Companies.sampleFromArray(pendingRows, pendingRows.length);

    // Balanced split: first (k - r) buckets get `base` rows,
    // the remaining r buckets get `base + 1` rows.
    const n    = shuffled.length;
    const base = Math.floor(n / NUM_EJECUTIVOS);
    const rem  = n % NUM_EJECUTIVOS;
    const buckets = [];
    let cursor = 0;
    for (let i = 0; i < NUM_EJECUTIVOS; i++) {
      const size = base + (i < rem ? 1 : 0);
      buckets.push(shuffled.slice(cursor, cursor + size));
      cursor += size;
    }

    const perTab = [];
    // Pending edits to Total compañías columns C:D
    // (Estado → 'Asignado', Ejecutivo → tab name) for each assigned row.
    const masterWrites = [];

    for (let i = 0; i < NUM_EJECUTIVOS; i++) {
      const title  = TAB.EJECUTIVO(i + 1);
      const bucket = buckets[i];

      const sheetId = await this.recreateTab(spreadsheetId, title, {
        rowCount: Math.max(bucket.length, 1) + 10,
        columnCount: COL_COUNT,
      });

      const body   = bucket.map(linkedRow);
      const values = [HEADERS, ...body];

      await this.writeValues(
        spreadsheetId,
        `${quoteSheet(title)}!A1:D${values.length}`,
        values,
        'USER_ENTERED',
      );

      await this.batchUpdate(spreadsheetId, [
        this.headerFormatRequest(sheetId),
        this.estadoValidationRequest(sheetId, bucket.length),
        this.autoResizeRequest(sheetId),
      ]);

      perTab.push({ title, sheetId, count: bucket.length });

      // Queue one C:D range write per assigned company.
      // Estado → 'Asignado', Ejecutivo → tab name.
      bucket.forEach(r => {
        masterWrites.push({
          range: `${quoteSheet(TAB.TOTAL)}!C${r}:D${r}`,
          values: [['Asignado', title]],
        });
      });
    }

    // Flush master writeback in a single batch call.
    // Using RAW so values land as literals (not formulas).
    await this.batchWriteValues(spreadsheetId, masterWrites, 'RAW');

    return perTab;
  },
};
