// ============================================================
// ui.js — clean transparent 3-dots menu for banks (no white box)
// ============================================================

import { AppState, UI_STRINGS_CACHE } from './state.js';
import * as Storage from './storage.js';
import * as Loader from './loader.js';
import * as SearchMod from './search.js';
import { normalizeIncomingQuestion } from './question-i18n.js';

let onBankChange = () => {};
let onTopicChange = () => {};
let onModeChange = () => {};

export function bindHandlers({ bankChange, topicChange, modeChange }) {
  onBankChange = bankChange || onBankChange;
  onTopicChange = topicChange || onTopicChange;
  onModeChange = modeChange || onModeChange;
}

// ---- Locale ----
export async function loadLocale(lang) {
  if (UI_STRINGS_CACHE[lang]) return UI_STRINGS_CACHE[lang];
  try {
    const res = await fetch(`locales/${lang}.json`);
    const data = await res.json();
    UI_STRINGS_CACHE[lang] = data;
    return data;
  } catch {
    const fallback = lang === 'en'
      ? {appTitle:"⚡ Brahmastra Quiz", bankSectionLabel:"Question Banks", topicSectionLabel:"Topics", practiceLabel:"🎯 Practice Mode", testLabel:"⏱️ Mock Test Mode", flashcardLabel:"🃏 Flashcards", languageLabel:"Language", searchPlaceholder:"Search...", theme:"🌙 Theme", themeLight:"☀️ Theme", manageBtn:"🧰 Manage", printBtn:"🖨️ Print"}
      : {appTitle:"⚡ Brahmastra Quiz", bankSectionLabel:"प्रश्न बैंक", topicSectionLabel:"टॉपिक्स", practiceLabel:"🎯 अभ्यास", testLabel:"⏱️ मॉक टेस्ट", flashcardLabel:"🃏 फ्लैशकार्ड", languageLabel:"भाषा", searchPlaceholder:"खोजें...", theme:"🌙 थीम", themeLight:"☀️ थीम", manageBtn:"🧰 प्रबंधन", printBtn:"🖨️ प्रिंट"};
    UI_STRINGS_CACHE[lang]=fallback;
    return fallback;
  }
}

export function t(key) {
  const strings = UI_STRINGS_CACHE[AppState.language] || UI_STRINGS_CACHE.hi || {};
  return strings[key] || key;
}

export async function applyLanguage(lang) {
  AppState.language = lang;
  Storage.setLanguage(lang);
  await loadLocale(lang);
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (key) el.textContent = t(key);
  });
  const search = document.getElementById('searchInput');
  if (search) search.placeholder = t('searchPlaceholder');
  const sel = document.getElementById('languageSelect');
  if (sel) sel.value = lang;
  renderSidebar();
  document.dispatchEvent(new CustomEvent('uiLangChanged'));
}

export function applyQuestionLanguage(qLang) {
  AppState.questionLanguage = qLang;
  Storage.setQuestionLanguage(qLang);
  const sel = document.getElementById('questionLangSelect');
  if (sel) sel.value = qLang;
  document.dispatchEvent(new CustomEvent('questionLangChanged'));
}

export function applyTheme(theme) {
  AppState.theme = theme;
  Storage.setTheme(theme);
  if (theme === 'light') document.body.setAttribute('data-theme','light');
  else document.body.removeAttribute('data-theme');
  const btn = document.getElementById('themeBtn');
  if (btn) btn.textContent = theme==='light' ? t('themeLight') : t('theme');
}
export function toggleTheme(){ applyTheme(AppState.theme==='light'?'dark':'light'); }

function getBankDisplayTitle(bank) {
  const renames = Storage.getBankRenames();
  if (renames[bank.id]) return renames[bank.id];
  return AppState.language === 'hi' ? (bank.title_hi || bank.title) : bank.title;
}

function closeAllBankDropdowns() {
  document.querySelectorAll('.bank-dropdown.open').forEach(d=>d.classList.remove('open'));
}

// ---- Sidebar with clean transparent 3-dots menu ----
export function renderSidebar() {
  const bankList = document.getElementById('bankList');
  if (!bankList) return;

  const allBanks = Loader.listBanks();
  const hiddenIds = new Set(Storage.getHiddenBanks());
  const visibleBanks = allBanks.filter(b => !hiddenIds.has(b.id));

  let html = `
    <div class="bank-item ${AppState.currentBankId==='all'?'active':''}" data-bank="all">
      <span class="bank-main"><span class="bank-icon">📚</span> ${AppState.language==='hi'?'सभी बैंक':'All Banks'}</span>
    </div>
  `;

  visibleBanks.forEach(bank => {
    const displayTitle = getBankDisplayTitle(bank);
    const isActive = AppState.currentBankId === bank.id;
    const isCustom = !!bank.isCustom;
    html += `
      <div class="bank-item ${isActive?'active':''}" data-bank="${bank.id}" title="${displayTitle}">
        <span class="bank-main">
          <span class="bank-icon">${bank.icon||'📘'}</span>
          <span class="bank-title-text">${displayTitle}</span>
        </span>
        <span class="bank-menu-wrap">
          <button class="bank-menu-trigger" data-action="menu" data-bank="${bank.id}" aria-label="More">⋮</button>
          <div class="bank-dropdown" id="dropdown-${bank.id}">
            <button class="dropdown-item" data-action="rename" data-bank="${bank.id}">📝 Edit</button>
            <button class="dropdown-item danger" data-action="delete" data-bank="${bank.id}">🗑️ ${isCustom?'Delete':'Hide'}</button>
          </div>
        </span>
      </div>
    `;
  });

  if (hiddenIds.size>0) {
    html += `<div class="bank-hidden-info"><span>${hiddenIds.size} hidden</span> <button class="link-btn" data-action="restore-all">Restore</button></div>`;
  }

  bankList.innerHTML = html;

  // Bank selection (ignore menu clicks)
  bankList.querySelectorAll('.bank-item').forEach(el=>{
    el.addEventListener('click', (e)=>{
      if (e.target.closest('.bank-menu-wrap') || e.target.closest('.link-btn')) return;
      onBankChange(el.dataset.bank);
    });
  });

  // 3-dots menu trigger
  bankList.querySelectorAll('.bank-menu-trigger').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      const bankId = btn.dataset.bank;
      const dropdown = document.getElementById(`dropdown-${bankId}`);
      if (!dropdown) return;
      const isOpen = dropdown.classList.contains('open');
      closeAllBankDropdowns();
      if (!isOpen) dropdown.classList.add('open');
    });
  });

  // Rename
  bankList.querySelectorAll('[data-action="rename"]').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      closeAllBankDropdowns();
      const bankId = btn.dataset.bank;
      const bank = Loader.getBankMeta(bankId);
      if (!bank) return;
      const currentName = getBankDisplayTitle(bank);
      const newName = window.prompt(AppState.language==='hi'?`नया नाम दर्ज करें:`:`Enter new name:`, currentName);
      if (newName===null) return;
      if (!newName.trim()) { showManagerStatus('Name cannot be empty','error'); return; }
      handleRenameBank(bankId, newName.trim());
    });
  });

  // Delete / Hide
  bankList.querySelectorAll('[data-action="delete"]').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      closeAllBankDropdowns();
      const bankId = btn.dataset.bank;
      const bank = Loader.getBankMeta(bankId);
      if (!bank) return;
      const displayTitle = getBankDisplayTitle(bank);
      if (bank.isCustom) {
        if (!confirm(AppState.language==='hi'?`क्या आप "${displayTitle}" को हटाना चाहते हैं?`:`Delete "${displayTitle}" permanently?`)) return;
        handleDeleteBank(bankId);
      } else {
        if (!confirm(AppState.language==='hi'?`"${displayTitle}" को छिपाना चाहते हैं? Manage से वापस ला सकते हैं।`:`Hide "${displayTitle}"? Restore from Manage.`)) return;
        handleHideBank(bankId);
      }
    });
  });

  // Restore all hidden
  bankList.querySelector('[data-action="restore-all"]')?.addEventListener('click', (e)=>{
    e.stopPropagation();
    Storage.unhideAll();
    renderSidebar();
    showManagerStatus(AppState.language==='hi'?'सभी बैंक वापस दिखाए गए':'All hidden banks restored','success');
  });

  // Close dropdowns when clicking outside
  if (!window.__bankDropdownOutsideListener) {
    window.__bankDropdownOutsideListener = true;
    document.addEventListener('click', ()=> closeAllBankDropdowns());
  }

  if (!window.__lastTopicCounts) {
    const topics = window.__topicsCache||[];
    if (topics.length) renderTopics(topics, {});
  }
}

function handleRenameBank(bankId, newTitle) {
  const bank = Loader.getBankMeta(bankId);
  if (!bank) return;
  Storage.setBankRename(bankId, newTitle);
  if (bank.isCustom) {
    Storage.updateCustomBankMeta(bankId, {title:newTitle, title_hi:newTitle});
    bank.title = newTitle;
    bank.title_hi = newTitle;
  }
  renderSidebar();
  document.dispatchEvent(new CustomEvent('uiLangChanged'));
  showManagerStatus(AppState.language==='hi'?`नाम बदलकर "${newTitle}" किया`:`Renamed to "${newTitle}"`,'success');
}
function handleDeleteBank(bankId) {
  const wasCurrent = AppState.currentBankId===bankId;
  Storage.removeCustomBankFromRegistry(bankId);
  Loader.unregisterBank(bankId);
  renderSidebar();
  if (wasCurrent) {
    const remaining = Loader.listBanks().filter(b=>!Storage.isBankHidden(b.id));
    onBankChange(remaining[0]?.id || 'all');
  }
  showManagerStatus(AppState.language==='hi'?'बैंक हटा दिया गया':'Bank deleted','success');
}
function handleHideBank(bankId) {
  const wasCurrent = AppState.currentBankId===bankId;
  Storage.hideBank(bankId);
  renderSidebar();
  if (wasCurrent) onBankChange('all');
  showManagerStatus(AppState.language==='hi'?'बैंक छिपाया गया':'Bank hidden','success');
}

export function renderTopics(availableTopics, counts) {
  const topicList = document.getElementById('topicList');
  const hint = document.getElementById('topicEmptyHint');
  if (!topicList) return;
  if (!availableTopics || availableTopics.length<=1) {
    const total = counts[0]||0;
    if (total===0) {
      topicList.innerHTML='';
      if (hint){ hint.style.display='block'; hint.textContent=AppState.language==='hi'?'इस बैंक में टॉपिक डेटा नहीं है':'No topic data for this bank'; }
      return;
    }
  }
  if (hint) hint.style.display='none';
  topicList.innerHTML = availableTopics.map(topic=>{
    const count = counts[topic.id] ?? (topic.id===0?0:0);
    if (topic.id!==0 && count===0) return '';
    return `<li class="topic-item ${AppState.currentTopicId===topic.id?'active':''}" data-topic="${topic.id}"><span>${AppState.language==='hi'?(topic.title_hi||topic.title):topic.title}</span><span class="topic-badge" data-topic-count="${topic.id}">${count}</span></li>`;
  }).join('');
  topicList.querySelectorAll('.topic-item').forEach(el=> el.addEventListener('click', ()=> onTopicChange(Number(el.dataset.topic))));
}

export function setTopicCounts(counts) {
  window.__lastTopicCounts=counts;
  const pool=window.__lastPool||[];
  const available=Loader.getAvailableTopicsFromPool(pool);
  renderTopics(available, counts);
  Object.entries(counts).forEach(([tid,count])=>{
    const el=document.querySelector(`[data-topic-count="${tid}"]`);
    if (el) el.textContent=count;
  });
}
export function setCurrentPoolForTopics(pool){ window.__lastPool=pool; }
export function highlightActiveBank(bankId){ document.querySelectorAll('.bank-item').forEach(el=> el.classList.toggle('active', el.dataset.bank===bankId)); }
export function highlightActiveTopic(topicId){ document.querySelectorAll('.topic-item').forEach(el=> el.classList.toggle('active', Number(el.dataset.topic)===topicId)); }
export function highlightActiveMode(mode){ ['practice','test','flashcard'].forEach(m=> document.getElementById(`btn-${m}`)?.classList.toggle('active', m===mode)); }

export function showManagerStatus(msg, type='success'){
  const status=document.getElementById('managerStatus');
  if (!status) return;
  status.textContent=msg;
  status.className=`manager-status show ${type}`;
  setTimeout(()=>{ status.className='manager-status'; }, 5000);
}
export function openQuestionManager(){
  document.getElementById('questionManagerModal')?.classList.add('open');
  populateManagerBankSelect();
  populateManagerTopicSelect();
  renderHiddenBanksInManager();
}
export function closeQuestionManager(){ document.getElementById('questionManagerModal')?.classList.remove('open'); }
function populateManagerBankSelect(){
  const select=document.getElementById('newBank');
  if (!select) return;
  select.innerHTML=Loader.listBanks().map(b=> `<option value="${b.id}">${getBankDisplayTitle(b)}</option>`).join('');
}
function populateManagerTopicSelect(){
  const select=document.getElementById('newTopic');
  if (!select) return;
  const topics=(window.__topicsCache||[]).filter(t=>t.id!==0);
  const dyn=(window.__lastPool||[]).reduce((m,q)=>{ if(!m.has(q.topic_id)) m.set(q.topic_id,{id:q.topic_id, title_hi:q.topic||`Topic ${q.topic_id}`}); return m; }, new Map());
  const all=[...topics, ...Array.from(dyn.values()).filter(d=>!topics.some(t=>t.id===d.id))];
  select.innerHTML=all.map(t=> `<option value="${t.id}">${AppState.language==='hi'?(t.title_hi||t.title):t.title}</option>`).join('');
}
function renderHiddenBanksInManager(){
  const container=document.getElementById('hiddenBanksList');
  if (!container) return;
  const hidden=Storage.getHiddenBanks();
  if (!hidden.length){ container.innerHTML=`<small style="color:var(--text-muted)">No hidden banks</small>`; return; }
  container.innerHTML=hidden.map(id=>{
    const meta=Loader.getBankMeta(id)||{id,title:id,title_hi:id};
    return `<div class="hidden-bank-item"><span>${getBankDisplayTitle(meta)}</span><button class="btn-icon small" data-restore="${id}">↩️ Restore</button></div>`;
  }).join('');
  container.querySelectorAll('[data-restore]').forEach(btn=> btn.addEventListener('click', ()=>{
    Storage.unhideBank(btn.dataset.restore);
    renderSidebar();
    renderHiddenBanksInManager();
    showManagerStatus('Restored','success');
  }));
}
function slugify(title){ return title.toLowerCase().trim().replace(/[^a-z0-9\u0900-\u097F]+/g,'_').replace(/^_+|_+$/g,'') || 'bank'; }
export async function createBankAndImport(rawQuestions){
  const title=window.prompt('Bank Name / बैंक का नाम:');
  if (!title||!title.trim()){ showManagerStatus('Bank name required','error'); return null; }
  const icon=window.prompt('Icon emoji:','📘')||'📘';
  let id=slugify(title);
  const existing=new Set(Loader.listBanks().map(b=>b.id));
  let suffix=2;
  while(existing.has(id)){ id=`${slugify(title)}_${suffix++}`; }
  const bankMeta={id, title:title.trim(), title_hi:title.trim(), icon, file:null, isCustom:true};
  const normalized=rawQuestions.map((raw,i)=> normalizeIncomingQuestion(raw, id, i+1));
  const errors=normalized.filter(q=>q.error);
  const valid=normalized.filter(q=>!q.error);
  if (!valid.length){ showManagerStatus(`All ${rawQuestions.length} items invalid. First error: ${errors[0]?.error}`,'error'); return null; }
  Storage.addCustomBankToRegistry(bankMeta);
  Storage.saveCustomBankQuestions(id, valid);
  Loader.registerNewBank(bankMeta, valid);
  SearchMod.addCustomSearchEntries(id, valid);
  renderSidebar();
  showManagerStatus(`Created "${title}" with ${valid.length} Qs – ${errors.length} skipped`, errors.length?'error':'success');
  return bankMeta;
}
export function downloadJSON(filename, data){
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export function exportForGitHub() {
  const allBanks = Loader.listBanks();
  const hidden = new Set(Storage.getHiddenBanks());
  const visibleBanks = allBanks.filter(b=>!hidden.has(b.id));
  const renames = Storage.getBankRenames();

  // Build new banks.json for GitHub (all custom become regular file-based)
  const githubBanks = visibleBanks.map(b=>{
    const displayTitle = renames[b.id] || b.title;
    const displayTitleHi = renames[b.id] || b.title_hi || b.title;
    return {
      id: b.id,
      title: displayTitle,
      title_hi: displayTitleHi,
      icon: b.icon || '📘',
      file: `database/${b.id}.json`,
      description: b.description || `${displayTitle} question bank`
    };
  });

  // Download banks.json
  downloadJSON('banks.json', githubBanks);

  // Download each custom bank's questions as separate file (with delay to avoid browser blocking)
  const customBanks = visibleBanks.filter(b=>b.isCustom);
  if (customBanks.length===0) {
    showManagerStatus(`Downloaded banks.json (${githubBanks.length} banks). No custom banks to export - your built-in banks are already in database/ folder. Just push banks.json if you renamed/hid banks.`, 'success');
    return;
  }

  showManagerStatus(`Downloading ${customBanks.length} custom bank file(s) + banks.json... Allow multiple downloads. After download, copy all files into your local project's database/ folder and push to GitHub.`, 'success');

  customBanks.forEach((bank, i)=>{
    setTimeout(()=>{
      const qs = Storage.getCustomBankQuestions(bank.id);
      downloadJSON(`${bank.id}.json`, qs);
    }, 600 * (i+1));
  });
}
export function removeCustomBank(bankId){ Storage.removeCustomBankFromRegistry(bankId); Loader.unregisterBank(bankId); renderSidebar(); }
