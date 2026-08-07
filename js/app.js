// ============================================================
// app.js — entry, wiring, dynamic topics, isolated test handling
// ============================================================

import { AppState } from './state.js';
import * as Storage from './storage.js';
import * as Loader from './loader.js';
import * as SearchMod from './search.js';
import * as UI from './ui.js';
import { renderPracticeMode } from './practice.js';
import { renderFlashcardMode, flipCard, nextCard, prevCard } from './flashcards.js';
import { renderTestMode, renderTestSetup, navigateTest } from './mocktest.js';

const contentBody = () => document.getElementById('contentBody');

async function init() {
  AppState.language = Storage.getLanguage();
  AppState.questionLanguage = Storage.getQuestionLanguage();
  AppState.theme = Storage.getTheme();

  await UI.loadLocale('en');
  await UI.loadLocale('hi');

  const [banks, topics] = await Promise.all([
    Loader.loadBankRegistry(),
    Loader.loadTopics()
  ]);
  window.__topicsCache = topics;

  AppState.currentBankId = banks[0]?.id || 'all';
  AppState.currentMode = 'practice';

  UI.bindHandlers({
    bankChange: onBankChange,
    topicChange: onTopicChange,
    modeChange: onModeChange
  });

  UI.applyTheme(AppState.theme);
  await UI.applyLanguage(AppState.language);
  UI.applyQuestionLanguage(AppState.questionLanguage);
  UI.highlightActiveMode(AppState.currentMode);

  await selectBank(AppState.currentBankId);
  wireTopbar();
  wireQuestionManager();
  wireKeyboard();

  // listen for question lang change to re-render
  document.addEventListener('questionLangChanged', ()=>{
    renderCurrentMode();
  });
  // NEW: when UI language changes, re-render mock test setup so banks/topics show English/Hindi
  document.addEventListener('uiLangChanged', ()=>{
    renderCurrentMode();
  });
}

async function selectBank(bankId) {
  AppState.currentBankId = bankId;
  AppState.currentTopicId = 0;
  UI.highlightActiveBank(bankId);

  if (bankId==='all') await Loader.loadAllBanks();
  else await Loader.loadBank(bankId).catch(()=>{});

  refreshTopicCounts();
  applyFilters();
}

function onBankChange(bankId) { selectBank(bankId); }

function onTopicChange(topicId) {
  AppState.currentTopicId = topicId;
  UI.highlightActiveTopic(topicId);
  applyFilters();
}

function poolForCurrentBank() {
  if (AppState.currentBankId==='all') {
    return Loader.listBanks().flatMap(b=> Loader.getCachedBank(b.id) || []);
  }
  return Loader.getCachedBank(AppState.currentBankId) || [];
}

function refreshTopicCounts() {
  const pool = poolForCurrentBank();
  UI.setCurrentPoolForTopics(pool);

  const counts = {0: pool.length};
  pool.forEach(q=>{
    const tid = q.topic_id || 0;
    counts[tid] = (counts[tid]||0)+1;
  });
  UI.setTopicCounts(counts);
}

async function applyFilters() {
  // Do not disturb running mock test when searching/filtering for practice
  if (AppState.currentMode==='test' && AppState.testState.config && !AppState.testState.isSubmitted) {
    // only update practice backing list, not testState
    // but still compute filteredQuestions for when user returns to practice
  }

  const query = document.getElementById('searchInput')?.value.trim() || '';
  if (query) {
    const results = await SearchMod.search(query, {bankId: AppState.currentBankId});
    const bankIds = [...new Set(results.map(r=>r.bank))];
    await Promise.all(bankIds.map(id=> Loader.loadBank(id).catch(()=>{})));
    const resolved = results.map(r=> (Loader.getCachedBank(r.bank)||[]).find(q=>q.id===r.id)).filter(Boolean);
    AppState.filteredQuestions = AppState.currentTopicId ? resolved.filter(q=> q.topic_id===AppState.currentTopicId) : resolved;
  } else {
    const pool = poolForCurrentBank();
    AppState.filteredQuestions = AppState.currentTopicId ? pool.filter(q=> q.topic_id===AppState.currentTopicId) : pool;
  }

  AppState.flashIndex=0;
  // only re-render if not in isolated test running mode
  if (!(AppState.currentMode==='test' && AppState.testState.config && !AppState.testState.isSubmitted)) {
    renderCurrentMode();
  }
}

function onModeChange(mode) {
  AppState.currentMode = mode;
  UI.highlightActiveMode(mode);
  // Disable search when in running test
  const search = document.getElementById('searchInput');
  if (search) {
    const isRunningTest = mode==='test' && AppState.testState.config && !AppState.testState.isSubmitted;
    search.disabled = isRunningTest;
    search.placeholder = isRunningTest ? (AppState.language==='hi'?'टेस्ट के दौरान खोज बंद है':'Search disabled during test') : UI.t('searchPlaceholder');
  }
  renderCurrentMode();
}

function renderCurrentMode() {
  const body = contentBody();
  if (!body) return;
  if (AppState.currentMode==='practice') renderPracticeMode(body);
  else if (AppState.currentMode==='flashcard') renderFlashcardMode(body);
  else if (AppState.currentMode==='test') {
    AppState.testState.config ? renderTestMode(body) : renderTestSetup(body);
  }
}

function wireTopbar() {
  document.getElementById('btn-practice')?.addEventListener('click',()=> onModeChange('practice'));
  document.getElementById('btn-test')?.addEventListener('click',()=> onModeChange('test'));
  document.getElementById('btn-flashcard')?.addEventListener('click',()=> onModeChange('flashcard'));

  document.getElementById('languageSelect')?.addEventListener('change', (e)=> UI.applyLanguage(e.target.value));
  document.getElementById('questionLangSelect')?.addEventListener('change', (e)=> UI.applyQuestionLanguage(e.target.value));
  document.getElementById('themeBtn')?.addEventListener('click',()=> UI.toggleTheme());
  document.getElementById('printBtn')?.addEventListener('click',()=> window.print());
  document.getElementById('manageBtn')?.addEventListener('click',()=> UI.openQuestionManager());

  let debounce;
  document.getElementById('searchInput')?.addEventListener('input',()=>{
    clearTimeout(debounce);
    debounce = setTimeout(applyFilters, 200);
  });
}

function wireQuestionManager() {
  document.getElementById('questionManagerModal')?.addEventListener('click', (e)=>{
    if (e.target.id==='questionManagerModal') UI.closeQuestionManager();
  });
  document.querySelectorAll('[data-action="close-manager"]').forEach(btn=> btn.addEventListener('click',()=> UI.closeQuestionManager()));

  document.getElementById('importQuestionsBtn')?.addEventListener('click',()=>{
    document.getElementById('importQuestionsInput')?.click();
  });

  document.getElementById('importQuestionsInput')?.addEventListener('change', async (event)=>{
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const rawQuestions = Array.isArray(parsed) ? parsed : parsed.questions;
      if (!Array.isArray(rawQuestions)) throw new Error('JSON must be array or {questions:[...]}');
      const bank = await UI.createBankAndImport(rawQuestions);
      if (bank) await selectBank(bank.id);
    } catch (error) {
      UI.showManagerStatus(`Import failed: ${error.message}`,'error');
    } finally { event.target.value=''; }
  });

  document.getElementById('exportBtn')?.addEventListener('click',()=>{
    const pool = poolForCurrentBank();
    UI.downloadJSON(`${AppState.currentBankId}_export.json`, pool);
    UI.showManagerStatus(`Exported ${pool.length} question(s).`,'success');
  });

  document.getElementById('exportBanksJsonBtn')?.addEventListener('click',()=>{
    UI.exportForGitHub();
  });

  document.getElementById('questionForm')?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const bankId = document.getElementById('newBank').value;
    const raw = {
      question: document.getElementById('newQuestion').value,
      question_en: document.getElementById('newQuestionEn').value,
      topic_id: Number(document.getElementById('newTopic').value),
      options: [
        document.getElementById('newOptionA').value,
        document.getElementById('newOptionB').value,
        document.getElementById('newOptionC').value,
        document.getElementById('newOptionD').value
      ],
      options_en: [
        document.getElementById('newOptionAEn').value || document.getElementById('newOptionA').value,
        document.getElementById('newOptionBEn').value || document.getElementById('newOptionB').value,
        document.getElementById('newOptionCEn').value || document.getElementById('newOptionC').value,
        document.getElementById('newOptionDEn').value || document.getElementById('newOptionD').value
      ],
      answer: Number(document.getElementById('newAnswer').value),
      explanation: document.getElementById('newExplanation').value,
      explanation_en: document.getElementById('newExplanationEn').value,
      exam: document.getElementById('newExam').value
    };

    const pool = Loader.getCachedBank(bankId) || await Loader.loadBank(bankId);
    const nextId = Math.max(0, ...pool.map(q=>q.id)) +1;
    const qModule = await import('./question-i18n.js');
    const question = qModule.normalizeIncomingQuestion(raw, bankId, nextId);
    if (question.error) { UI.showManagerStatus(question.error,'error'); return; }

    pool.push(question);
    const meta = Loader.getBankMeta(bankId);
    if (meta?.isCustom) Storage.saveCustomBankQuestions(bankId, pool);
    SearchMod.addCustomSearchEntries(bankId, pool);

    refreshTopicCounts();
    if (AppState.currentBankId===bankId || AppState.currentBankId==='all') applyFilters();
    e.target.reset();
    UI.showManagerStatus(`Question #${question.id} added to "${meta?.title}".`,'success');
  });
}

function wireKeyboard() {
  document.addEventListener('keydown', (e)=>{
    if (document.getElementById('questionManagerModal')?.classList.contains('open')) {
      if (e.key==='Escape') UI.closeQuestionManager();
      return;
    }
    if (AppState.currentMode==='flashcard') {
      if (e.key==='ArrowRight' || e.key===' ') { e.preventDefault(); nextCard(); }
      else if (e.key==='ArrowLeft') { e.preventDefault(); prevCard(); }
      else if (e.key==='ArrowUp' || e.key==='ArrowDown') { e.preventDefault(); flipCard(); }
    } else if (AppState.currentMode==='test' && AppState.testState.config && !AppState.testState.isSubmitted) {
      if (e.key==='ArrowRight') navigateTest(AppState.testState.currentIndex+1);
      else if (e.key==='ArrowLeft') navigateTest(AppState.testState.currentIndex-1);
    }
  });
}

window.addEventListener('DOMContentLoaded', init);
