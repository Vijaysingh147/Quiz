// ============================================================
// storage.js — ALL localStorage + rename/hide for banks
// ============================================================

const KEYS = {
  LANGUAGE: 'brahmastra_quiz_language_v2',
  Q_LANGUAGE: 'brahmastra_quiz_qlanguage_v2',
  THEME: 'brahmastra_quiz_theme_v2',
  CUSTOM_BANKS: 'brahmastra_quiz_custom_banks_v2',
  CUSTOM_BANK_DATA: (bankId) => `brahmastra_quiz_bank_data_${bankId}`,
  TEST_HISTORY: 'brahmastra_test_history_v2',
  BANK_RENAMES: 'brahmastra_bank_renames_v2',
  HIDDEN_BANKS: 'brahmastra_hidden_banks_v2'
};

function safeGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (e) { return fallback; }
}
function safeSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch (e) { return false; }
}

// ---- Settings ----
export function getLanguage() { return localStorage.getItem(KEYS.LANGUAGE) || 'hi'; }
export function setLanguage(lang) { try { localStorage.setItem(KEYS.LANGUAGE, lang); } catch(e){} }

export function getQuestionLanguage() { return localStorage.getItem(KEYS.Q_LANGUAGE) || 'hi'; }
export function setQuestionLanguage(lang) { try { localStorage.setItem(KEYS.Q_LANGUAGE, lang); } catch(e){} }

export function getTheme() { return localStorage.getItem(KEYS.THEME) || 'dark'; }
export function setTheme(theme) { try { localStorage.setItem(KEYS.THEME, theme); } catch(e){} }

// ---- Custom Banks ----
export function getCustomBankRegistry() { return safeGet(KEYS.CUSTOM_BANKS, []); }
export function saveCustomBankRegistry(reg) { return safeSet(KEYS.CUSTOM_BANKS, reg); }
export function addCustomBankToRegistry(meta) {
  const reg = getCustomBankRegistry();
  if (!reg.some(b => b.id === meta.id)) { reg.push(meta); saveCustomBankRegistry(reg); }
  return reg;
}
export function removeCustomBankFromRegistry(bankId) {
  saveCustomBankRegistry(getCustomBankRegistry().filter(b => b.id !== bankId));
  try { localStorage.removeItem(KEYS.CUSTOM_BANK_DATA(bankId)); } catch(e){}
  // also cleanup renames/hidden
  const renames = getBankRenames();
  if (renames[bankId]) { delete renames[bankId]; saveBankRenames(renames); }
  const hidden = new Set(getHiddenBanks());
  if (hidden.has(bankId)) { hidden.delete(bankId); saveHiddenBanks([...hidden]); }
}
export function getCustomBankQuestions(bankId) { return safeGet(KEYS.CUSTOM_BANK_DATA(bankId), []); }
export function saveCustomBankQuestions(bankId, qs) { return safeSet(KEYS.CUSTOM_BANK_DATA(bankId), qs); }

export function updateCustomBankMeta(bankId, updates) {
  const reg = getCustomBankRegistry();
  const idx = reg.findIndex(b=>b.id===bankId);
  if (idx>=0) {
    reg[idx] = {...reg[idx], ...updates};
    saveCustomBankRegistry(reg);
    return reg[idx];
  }
  return null;
}

// ---- Bank Renames (for built-in + custom) ----
export function getBankRenames() { return safeGet(KEYS.BANK_RENAMES, {}); }
export function saveBankRenames(map) { return safeSet(KEYS.BANK_RENAMES, map); }
export function setBankRename(bankId, newTitle) {
  const renames = getBankRenames();
  if (!newTitle || !newTitle.trim()) {
    delete renames[bankId];
  } else {
    renames[bankId] = newTitle.trim();
  }
  saveBankRenames(renames);
  return renames;
}
export function getDisplayTitle(bank) {
  const renames = getBankRenames();
  if (renames[bank.id]) return renames[bank.id];
  return bank.title;
}
export function getDisplayTitleHi(bank) {
  const renames = getBankRenames();
  // if user renamed, use same rename for both languages (simpler). Or you could store hi too.
  if (renames[bank.id]) return renames[bank.id];
  return bank.title_hi || bank.title;
}

// ---- Hidden Banks (soft delete for built-in) ----
export function getHiddenBanks() { return safeGet(KEYS.HIDDEN_BANKS, []); }
export function saveHiddenBanks(arr) { return safeSet(KEYS.HIDDEN_BANKS, arr); }
export function hideBank(bankId) {
  const hidden = new Set(getHiddenBanks());
  hidden.add(bankId);
  saveHiddenBanks([...hidden]);
}
export function unhideBank(bankId) {
  saveHiddenBanks(getHiddenBanks().filter(id=>id!==bankId));
}
export function unhideAll() {
  saveHiddenBanks([]);
}
export function isBankHidden(bankId) {
  return getHiddenBanks().includes(bankId);
}

// ---- Test History ----
export function getTestHistory() { return safeGet(KEYS.TEST_HISTORY, []); }
export function pushTestHistory(entry) {
  const h = getTestHistory();
  h.unshift(entry);
  if (h.length > 50) h.pop();
  safeSet(KEYS.TEST_HISTORY, h);
}

export { KEYS as STORAGE_KEYS };
