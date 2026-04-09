import { Config } from './config.js';
import { Auth, GOOGLE_CLIENT_ID } from './auth.js';
import { Drive }  from './drive.js';
import { Sheets, TAB } from './sheets.js';
import { AppsScript } from './appsScript.js';

// ── Helpers ──────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

function showLoading(text = 'Cargando...') {
  $('loading-text').textContent = text;
  $('loading-overlay').classList.add('open');
}
function hideLoading() { $('loading-overlay').classList.remove('open'); }

function showToast(msg, type = '') {
  const t = $('toast');
  t.textContent = msg;
  t.className = `${type}`;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function openDialog(id)  { $(id).classList.add('open'); }
function closeDialog(id) { $(id).classList.remove('open'); }

function logLine(msg, type = '') {
  const log = $('log');
  const row = document.createElement('div');
  row.className = `log-line ${type}`;
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  row.innerHTML = `<span class="log-time">${hh}:${mm}:${ss}</span> <span class="log-msg">${msg}</span>`;
  log.insertBefore(row, log.firstChild);
}

function confirmAction(title, message) {
  return new Promise(resolve => {
    $('confirm-title').textContent   = title;
    $('confirm-message').textContent = message;
    const ok     = $('confirm-ok');
    const cancel = $('confirm-cancel');
    const done = (result) => {
      ok.onclick     = null;
      cancel.onclick = null;
      closeDialog('confirm-dialog');
      resolve(result);
    };
    ok.onclick     = () => done(true);
    cancel.onclick = () => done(false);
    openDialog('confirm-dialog');
  });
}

// ── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  Auth.onSignIn(() => {
    updateHeader();
    updateUI();
    showToast('Sesión iniciada', 'success');
    logLine('Sesión iniciada');
  });
  Auth.onSignOut(() => {
    updateHeader();
    updateUI();
    showToast('Sesión cerrada');
    logLine('Sesión cerrada');
  });
  Auth.onError(err => {
    showToast(`Error de autenticación: ${err}`, 'error');
    logLine(`Error de autenticación: ${err}`, 'error');
  });

  await Auth.init().catch(err => {
    console.error('Auth init failed', err);
  });

  wireEvents();
  updateHeader();
  updateUI();

  if (GOOGLE_CLIENT_ID.startsWith('YOUR_')) {
    logLine(
      'Configura tu Google OAuth Client ID en js/auth.js para habilitar el inicio de sesión.',
      'error',
    );
  }
}

// ── UI updates ───────────────────────────────────────────────────────────────
function updateHeader() {
  const user = Config.getUser();
  const signedIn = !!user.email;
  $('btn-signin').style.display   = signedIn ? 'none' : '';
  $('account-badge').style.display = signedIn ? 'flex' : 'none';
  $('account-email').textContent   = user.email || '';
}

function updateUI() {
  const signedIn   = Config.isSignedIn();
  const configured = Config.isConfigured();
  const sheet      = Config.getSpreadsheet();

  $('warn-signin').style.display = signedIn ? 'none' : 'block';
  $('warn-sheet').style.display  = (signedIn && !configured) ? 'block' : 'none';

  $('cfg-sheet-name').value = sheet.name || '';
  $('cfg-sheet-id').value   = sheet.id   || '';

  // Only enable action buttons when signed in AND a sheet is picked
  const ready = signedIn && configured;
  ['btn-generate', 'btn-separate', 'btn-assign'].forEach(id => {
    $(id).disabled = !ready;
  });
  $('btn-pick-sheet').disabled = !signedIn;
}

// ── Sheet picker ─────────────────────────────────────────────────────────────
async function openSheetPicker() {
  if (!Config.isSignedIn()) { showToast('Inicia sesión primero', 'error'); return; }
  showLoading('Cargando hojas...');
  try {
    const files = await Drive.listSpreadsheets();
    const list  = $('sheet-picker-list');
    list.innerHTML = '';
    if (!files.length) {
      list.innerHTML = '<p class="empty-msg">No se encontraron hojas de cálculo.</p>';
    }
    files.forEach(f => {
      const item = document.createElement('div');
      item.className = 'dialog-item';
      item.innerHTML = `<span class="item-icon">📄</span><span class="item-name">${f.name}</span>`;
      item.onclick = () => {
        Config.setSpreadsheet(f.id, f.name);
        updateUI();
        closeDialog('sheet-picker-dialog');
        showToast(`Hoja "${f.name}" seleccionada`, 'success');
        logLine(`Hoja seleccionada: <strong>${f.name}</strong>`);
      };
      list.appendChild(item);
    });
    openDialog('sheet-picker-dialog');
  } catch (e) {
    showToast('Error al cargar hojas: ' + e.message, 'error');
    logLine('Error al cargar hojas: ' + e.message, 'error');
  } finally {
    hideLoading();
  }
}

// ── Action handlers ──────────────────────────────────────────────────────────
async function handleGenerate() {
  const { id, name } = Config.getSpreadsheet();
  if (!id) return;

  const existing = await Sheets.findSheet(id, TAB.TOTAL).catch(() => null);
  if (existing) {
    const ok = await confirmAction(
      'Reemplazar pestaña',
      `La pestaña "${TAB.TOTAL}" ya existe. ¿Deseas reemplazarla con 1,000 compañías nuevas?`,
    );
    if (!ok) return;
  }

  showLoading('Generando 1,000 compañías...');
  try {
    await Sheets.generateTotalCompanias(id);
    await ensureSyncScript(id);
    showToast(`Pestaña "${TAB.TOTAL}" creada`, 'success');
    logLine(`Creada <strong>${TAB.TOTAL}</strong> en "${name}" con 1,000 compañías`, 'success');
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
    logLine('Error al generar compañías: ' + e.message, 'error');
  } finally {
    hideLoading();
  }
}

async function handleSeparate() {
  const { id, name } = Config.getSpreadsheet();
  if (!id) return;

  const existing = await Sheets.findSheet(id, TAB.TRABAJO).catch(() => null);
  if (existing) {
    const ok = await confirmAction(
      'Reemplazar pestaña',
      `La pestaña "${TAB.TRABAJO}" ya existe. ¿Deseas reemplazarla?`,
    );
    if (!ok) return;
  }

  showLoading('Creando pestaña Trabajo...');
  try {
    await Sheets.separarCompanias(id);
    showToast(`Pestaña "${TAB.TRABAJO}" creada`, 'success');
    logLine(`Creada <strong>${TAB.TRABAJO}</strong> en "${name}" con 280 compañías vinculadas`, 'success');
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
    logLine('Error al separar compañías: ' + e.message, 'error');
  } finally {
    hideLoading();
  }
}

async function handleAssign() {
  const { id, name } = Config.getSpreadsheet();
  if (!id) return;

  // Check if any Ejecutivo tab exists
  const meta = await Sheets.getSpreadsheetMeta(id).catch(() => null);
  const existing = meta?.sheets?.some(s => /^Ejecutivo \d+$/.test(s.properties.title));
  if (existing) {
    const ok = await confirmAction(
      'Reemplazar pestañas',
      'Ya existen pestañas "Ejecutivo N". ¿Deseas reemplazarlas?',
    );
    if (!ok) return;
  }

  showLoading('Creando 8 pestañas de ejecutivos...');
  try {
    const tabs = await Sheets.asignarEmpresas(id);
    const total = tabs.reduce((s, t) => s + t.count, 0);
    showToast(`8 pestañas creadas (${total} compañías)`, 'success');
    logLine(
      `Creadas 8 pestañas <strong>Ejecutivo 1..8</strong> en "${name}" (${tabs.map(t => t.count).join(' + ')} = ${total} compañías)`,
      'success',
    );
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
    logLine('Error al asignar empresas: ' + e.message, 'error');
  } finally {
    hideLoading();
  }
}

// ── Apps Script sync ─────────────────────────────────────────────────
async function ensureSyncScript(spreadsheetId) {
  if (Config.isSyncScriptInstalled(spreadsheetId)) return;
  try {
    logLine('Instalando script de sincronización de Estado...');
    await AppsScript.install(spreadsheetId);
    Config.markSyncScriptInstalled(spreadsheetId);
    logLine('Script de sincronización instalado', 'success');
  } catch (e) {
    logLine(
      'No se pudo instalar script de sincronización: ' + e.message,
      'error',
    );
  }
}

// ── Wire events ──────────────────────────────────────────────────────────────
function wireEvents() {
  $('btn-signin').onclick  = () => Auth.signIn();
  $('btn-signout').onclick = () => Auth.signOut();

  $('btn-pick-sheet').onclick = openSheetPicker;
  $('sheet-picker-cancel').onclick = () => closeDialog('sheet-picker-dialog');

  $('btn-generate').onclick = handleGenerate;
  $('btn-separate').onclick = handleSeparate;
  $('btn-assign').onclick   = handleAssign;
}

// ── Boot ─────────────────────────────────────────────────────────────────────
async function boot() {
  try {
    await init();
  } catch (e) {
    console.error('init failed:', e);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
