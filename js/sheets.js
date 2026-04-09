import { Auth } from './auth.js';
import { Companies } from './companies.js';

const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

// Tab names used across the app
export const TAB = {
  TOTAL:    'Total compañías',
  TRABAJO:  'Trabajo',
  EJECUTIVO: (n) => `Ejecutivo ${n}`,
};

const NUM_COMPANIES = 1000;
const NUM_TRABAJO   = 280;
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

// Quote a sheet name for use inside a formula reference.
// 'Total compañías' → "'Total compañías'"
function quoteSheet(name) {
  return `'${name.replace(/'/g, "''")}'`;
}

// Build a formula that references a single cell in the Total compañías tab.
function formulaRef(column, row) {
  return `=${quoteSheet(TAB.TOTAL)}!${column}${row}`;
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

  // ── batchUpdate helper ──────────────────────────────────────────────
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
    // Delete existing tab if present
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
            columnCount: gridProps.columnCount || 8,
            frozenRowCount: 1,
          },
        },
      },
    });
    const result = await this.batchUpdate(spreadsheetId, requests);
    // Find the addSheet reply
    const addReply = result.replies?.find(r => r.addSheet)?.addSheet;
    return addReply?.properties?.sheetId;
  },

  // ── Values write ────────────────────────────────────────────────────
  async writeValues(spreadsheetId, range, values, valueInputOption = 'USER_ENTERED') {
    const encoded = encodeURIComponent(range);
    return apiFetch(
      `${BASE}/${spreadsheetId}/values/${encoded}?valueInputOption=${valueInputOption}`,
      { method: 'PUT', body: JSON.stringify({ values }) }
    );
  },

  // ── Data validation: dropdown on Estado column ──────────────────────
  estadoValidationRequest(sheetId, rowCount) {
    return {
      setDataValidation: {
        range: {
          sheetId,
          startRowIndex: 1,            // skip header
          endRowIndex: rowCount + 1,   // inclusive of last data row
          startColumnIndex: 2,         // column C (Estado)
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

  // ── Header styling + freeze ─────────────────────────────────────────
  headerFormatRequest(sheetId) {
    return {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: 3,
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
          endIndex: 3,
        },
      },
    };
  },

  // ══════════════════════════════════════════════════════════════════
  // PUBLIC OPERATIONS (mapped to the three SPA buttons)
  // ══════════════════════════════════════════════════════════════════

  /**
   * Button 1 — "Generar compañías"
   * Creates the "Total compañías" tab with 1000 random companies
   * and applies a dropdown data validation on the Estado column.
   */
  async generateTotalCompanias(spreadsheetId) {
    const sheetId = await this.recreateTab(spreadsheetId, TAB.TOTAL, {
      rowCount: NUM_COMPANIES + 10,
      columnCount: 4,
    });

    // 1. Write headers + 1000 rows
    const headers = ['Id', 'Nombre', 'Estado'];
    const rows    = Companies.generate(NUM_COMPANIES);
    const values  = [headers, ...rows];
    await this.writeValues(
      spreadsheetId,
      `${quoteSheet(TAB.TOTAL)}!A1:C${values.length}`,
      values,
      'RAW', // ids/names/estados are literal; no formula parsing needed
    );

    // 2. Format header + add dropdown + resize columns
    await this.batchUpdate(spreadsheetId, [
      this.headerFormatRequest(sheetId),
      this.estadoValidationRequest(sheetId, NUM_COMPANIES),
      this.autoResizeRequest(sheetId),
    ]);

    return { sheetId, count: NUM_COMPANIES };
  },

  /**
   * Button 2 — "Separar Compañias"
   * Creates "Trabajo" tab with 280 randomly selected rows from
   * "Total compañías", using formulas so changes flow between tabs.
   */
  async separarCompanias(spreadsheetId) {
    // Verify source exists
    const total = await this.findSheet(spreadsheetId, TAB.TOTAL);
    if (!total) {
      throw new Error(`Primero genera la pestaña "${TAB.TOTAL}".`);
    }

    const sheetId = await this.recreateTab(spreadsheetId, TAB.TRABAJO, {
      rowCount: NUM_TRABAJO + 10,
      columnCount: 4,
    });

    // Randomly pick 280 row indices (0..999) from the master tab
    const picks = Companies.sampleIndices(NUM_COMPANIES, NUM_TRABAJO);

    // Build rows of formulas: =Total compañías!A{r}, !B{r}, !C{r}
    const headers = ['Id', 'Nombre', 'Estado'];
    const body = picks.map(idx => {
      const row = idx + 2; // +1 for 0-indexed, +1 for header row
      return [
        formulaRef('A', row),
        formulaRef('B', row),
        formulaRef('C', row),
      ];
    });
    const values = [headers, ...body];

    await this.writeValues(
      spreadsheetId,
      `${quoteSheet(TAB.TRABAJO)}!A1:C${values.length}`,
      values,
      'USER_ENTERED', // formulas must be parsed
    );

    // Format header, add dropdown on Estado, resize
    await this.batchUpdate(spreadsheetId, [
      this.headerFormatRequest(sheetId),
      this.estadoValidationRequest(sheetId, NUM_TRABAJO),
      this.autoResizeRequest(sheetId),
    ]);

    return { sheetId, count: NUM_TRABAJO };
  },

  /**
   * Button 3 — "Asignar Empresas"
   * Creates 8 "Ejecutivo N" tabs, each containing a balanced share
   * of companies from "Total compañías", using formulas so the
   * derived tabs stay in sync with the master.
   */
  async asignarEmpresas(spreadsheetId) {
    const total = await this.findSheet(spreadsheetId, TAB.TOTAL);
    if (!total) {
      throw new Error(`Primero genera la pestaña "${TAB.TOTAL}".`);
    }

    // 1. Shuffle 0..999 and split into 8 balanced buckets
    const shuffled = Companies.shuffle(
      Array.from({ length: NUM_COMPANIES }, (_, i) => i),
    );
    const buckets = Companies.balancedSplit(shuffled, NUM_EJECUTIVOS);

    // 2. Recreate each tab, then write its slice
    const perTab = [];
    for (let i = 0; i < NUM_EJECUTIVOS; i++) {
      const title = TAB.EJECUTIVO(i + 1);
      const bucket = buckets[i];
      const sheetId = await this.recreateTab(spreadsheetId, title, {
        rowCount: bucket.length + 10,
        columnCount: 4,
      });

      const headers = ['Id', 'Nombre', 'Estado'];
      const body = bucket.map(idx => {
        const row = idx + 2;
        return [
          formulaRef('A', row),
          formulaRef('B', row),
          formulaRef('C', row),
        ];
      });
      const values = [headers, ...body];

      await this.writeValues(
        spreadsheetId,
        `${quoteSheet(title)}!A1:C${values.length}`,
        values,
        'USER_ENTERED',
      );

      await this.batchUpdate(spreadsheetId, [
        this.headerFormatRequest(sheetId),
        this.estadoValidationRequest(sheetId, bucket.length),
        this.autoResizeRequest(sheetId),
      ]);

      perTab.push({ title, sheetId, count: bucket.length });
    }

    return perTab;
  },
};
