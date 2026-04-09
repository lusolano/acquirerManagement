// Persists settings in localStorage
const K = {
  SPREADSHEET_ID:   'am_sheet_id',
  SPREADSHEET_NAME: 'am_sheet_name',
  USER_EMAIL:       'am_user_email',
  USER_NAME:        'am_user_name',
};

export const Config = {
  _get(key)        { return localStorage.getItem(K[key]) || ''; },
  _set(key, value) { localStorage.setItem(K[key], value || ''); },
  _del(key)        { localStorage.removeItem(K[key]); },

  getSpreadsheet() {
    return { id: this._get('SPREADSHEET_ID'), name: this._get('SPREADSHEET_NAME') };
  },
  setSpreadsheet(id, name) {
    this._set('SPREADSHEET_ID', id);
    this._set('SPREADSHEET_NAME', name);
  },
  clearSpreadsheet() {
    this._del('SPREADSHEET_ID');
    this._del('SPREADSHEET_NAME');
  },

  getUser() {
    return { email: this._get('USER_EMAIL'), name: this._get('USER_NAME') };
  },
  setUser(email, name) {
    this._set('USER_EMAIL', email);
    this._set('USER_NAME', name || '');
  },
  clearUser() {
    this._del('USER_EMAIL');
    this._del('USER_NAME');
  },

  isSignedIn()   { return !!this._get('USER_EMAIL'); },
  isConfigured() { return !!this._get('SPREADSHEET_ID'); },

  isSyncScriptInstalled(spreadsheetId) {
    return !!localStorage.getItem(`am_sync_script_${spreadsheetId}`);
  },
  markSyncScriptInstalled(spreadsheetId) {
    localStorage.setItem(`am_sync_script_${spreadsheetId}`, '1');
  },
};
