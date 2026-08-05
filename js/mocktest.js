// ============================================================
// mocktest.js — ISOLATED exam mode + now UI-language aware for banks/topics
// Fix for user's request: Banks and Topics in mock setup follow UI language selector
// ============================================================

import { AppState } from './state.js';
import * as Loader from './loader.js';
import * as Analytics from './analytics.js';
import * as Storage from './storage.js';
import { t } from './ui.js';
import { getAllLocalized } from './question-i18n.js';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function formatTime(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Helpers to respect UI language (hi / en) for bank and topic names
function getBankName(bank) {
  return AppState.language === 'hi' ? (bank.title_hi || bank.title) : bank.title;
}
function getTopicName(topic) {
  return AppState.language === 'hi' ? (topic.title_hi || topic.title) : topic.title;
}

// ---------------- Setup Screen ----------------
export function renderTestSetup(container) {
  const banks = Loader.listBanks();
  const topics = window.__topicsCache || [];
  const testLang = AppState.questionLanguage;
  const isHi = AppState.language === 'hi';

  container.innerHTML = `
    <div class="test-setup">
      <h2>⏱️ ${t('testLabel')} — Isolated Exam Mode</h2>
      <p class="setup-sub">Practice answers DO NOT affect Mock Test. Test has its own timer, palette & results.</p>
      
      <form id="testSetupForm" class="test-setup-form">
        <div class="form-row">
          <label>${isHi ? 'बैंक चुनें (एक से अधिक)' : 'Choose Bank(s)'}
            <select id="setupBanks" multiple size="${Math.min(8, banks.length + 1)}" class="input-multi">
              <option value="all" selected>${isHi ? 'सभी बैंक (मिश्रित)' : 'All Banks (Mixed)'}</option>
              ${banks.map(b => `<option value="${b.id}">${getBankName(b)}</option>`).join('')}
            </select>
            <small>${isHi ? 'Ctrl/Cmd+Click से कई चुनें' : 'Ctrl/Cmd+Click to select multiple'}</small>
          </label>

          <label>${isHi ? 'टॉपिक (Dynamic - केवल मौजूद टॉपिक्स)' : 'Topics (Auto filtered)'}
            <select id="setupTopics" multiple size="6">
              <option value="0" selected>${isHi ? 'सभी टॉपिक्स' : 'All Topics'} (0)</option>
              ${topics.filter(tp => tp.id !== 0).map(tp => `<option value="${tp.id}">${getTopicName(tp)}</option>`).join('')}
            </select>
          </label>
        </div>

        <div class="form-row">
          <label>${isHi ? 'कठिनाई' : 'Difficulty'}
            <select id="setupDifficulty">
              <option value="any">${isHi ? 'कोई भी' : 'Any'}</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
            </select>
          </label>

          <label>${isHi ? 'स्रोत' : 'Question Source'}
            <select id="setupSource">
              <option value="all">${isHi ? 'सभी प्रश्न' : 'All Questions'}</option>
              <option value="random">${isHi ? 'रैंडम शफल' : 'Random Shuffle'}</option>
              <option value="wrong">${isHi ? 'पहले गलत किए गए' : 'Previously Wrong'}</option>
              <option value="bookmarked">${isHi ? 'बुकमार्क किए गए' : 'Bookmarked Only'}</option>
              <option value="unattempted">${isHi ? 'पहले नहीं किए गए' : 'Unattempted'}</option>
            </select>
          </label>

          <label>${isHi ? 'प्रश्न भाषा' : 'Question Display'}
            <select id="setupQLang">
              <option value="hi" ${testLang === 'hi' ? 'selected' : ''}>हिन्दी Only</option>
              <option value="en" ${testLang === 'en' ? 'selected' : ''}>English Only</option>
              <option value="both" ${testLang === 'both' ? 'selected' : ''}>Bilingual • दोनों</option>
            </select>
          </label>
        </div>

        <div class="form-row">
          <label>${isHi ? 'प्रश्नों की संख्या' : 'Question Count'}
            <input type="number" id="setupCount" min="1" max="200" value="25">
          </label>
          <label>${isHi ? 'समय सीमा (मिनट)' : 'Time Limit (min)'}
            <input type="number" id="setupMinutes" min="1" max="300" value="30">
          </label>
          <label>${isHi ? 'निगेटिव मार्किंग' : 'Negative Marking'}
            <select id="setupNegative">
              <option value="0">No Negative</option>
              <option value="0.25" selected>0.25</option>
              <option value="0.33">1/3</option>
              <option value="0.5">0.5</option>
              <option value="1">1.0</option>
            </select>
          </label>
        </div>

        <div class="setup-actions">
          <button type="submit" class="btn-icon primary big">${t('startTest')}</button>
          <button type="button" id="btnClearTest" class="btn-icon">♻️ Clear Saved Test</button>
        </div>
      </form>

      <div class="test-history" id="testHistory"></div>
    </div>
  `;

  const bankSelect = document.getElementById('setupBanks');
  const topicSelect = document.getElementById('setupTopics');

  async function updateTopicsForBanks() {
    const selected = [...bankSelect.selectedOptions].map(o => o.value);
    const bankIds = selected.includes('all') ? banks.map(b => b.id) : selected;
    await Promise.all(bankIds.map(id => Loader.loadBank(id).catch(() => {})));
    const pool = bankIds.flatMap(id => Loader.getCachedBank(id) || []);
    const available = Loader.getAvailableTopicsFromPool(pool);
    const currentVals = new Set([...topicSelect.selectedOptions].map(o => o.value));
    // NOW LANGUAGE AWARE: use getTopicName() for English/Hindi
    topicSelect.innerHTML = available.map(tp => {
      const count = pool.filter(q => tp.id === 0 || q.topic_id === tp.id).length;
      const selectedAttr = currentVals.has(String(tp.id)) || tp.id === 0 ? 'selected' : '';
      return `<option value="${tp.id}" ${selectedAttr}>${getTopicName(tp)} (${count})</option>`;
    }).join('');
  }

  bankSelect.addEventListener('change', updateTopicsForBanks);
  updateTopicsForBanks();

  document.getElementById('testSetupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const selectedBanks = [...bankSelect.selectedOptions].map(o => o.value);
    const selectedTopics = [...topicSelect.selectedOptions].map(o => Number(o.value));
    const topicIds = selectedTopics.includes(0) ? [0] : selectedTopics;
    await startTest({
      bankIds: selectedBanks.includes('all') ? banks.map(b => b.id) : selectedBanks,
      topicIds: topicIds,
      difficulty: document.getElementById('setupDifficulty').value,
      source: document.getElementById('setupSource').value,
      qLang: document.getElementById('setupQLang').value,
      count: Number(document.getElementById('setupCount').value) || 25,
      timeLimitSec: (Number(document.getElementById('setupMinutes').value) || 30) * 60,
      negative: Number(document.getElementById('setupNegative').value)
    });
  });

  document.getElementById('btnClearTest')?.addEventListener('click', () => {
    resetTestState();
    renderTestSetup(container);
  });

  renderTestHistory();
}

function renderTestHistory() {
  const hist = Storage.getTestHistory();
  const el = document.getElementById('testHistory');
  if (!el) return;
  if (!hist.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<h3>📜 Recent Tests</h3><div class="history-list">` +
    hist.slice(0, 5).map(h => `<div class="history-item"><span>${new Date(h.date).toLocaleString()}</span><span>${h.correct}/${h.total} (${h.score}%)</span><span>${h.time} min</span></div>`).join('') +
    `</div>`;
}

async function startTest(config) {
  const loaded = await Promise.all(config.bankIds.map(id => Loader.loadBank(id).catch(() => [])));
  let pool = loaded.flat();

  if (!config.topicIds.includes(0)) {
    pool = pool.filter(q => config.topicIds.includes(q.topic_id));
  }
  if (config.difficulty !== 'any') pool = pool.filter(q => q.difficulty === config.difficulty);

  if (config.source === 'wrong') {
    const wrongKeys = new Set(Analytics.getWrongKeys());
    pool = pool.filter(q => wrongKeys.has(`${q.bank}:${q.id}`));
  } else if (config.source === 'bookmarked') {
    const bmKeys = new Set(Analytics.getBookmarkKeys());
    pool = pool.filter(q => bmKeys.has(`${q.bank}:${q.id}`));
  } else if (config.source === 'unattempted') {
    pool = pool.filter(q => !Analytics.isAttempted(q.bank, q.id));
  }
  if (config.source === 'random') pool = shuffle(pool);

  const finalQs = shuffle(pool).slice(0, config.count);

  if (!finalQs.length) {
    alert(AppState.language === 'hi' ? 'कोई प्रश्न नहीं मिला इस फिल्टर से' : 'No questions found for this filter');
    return;
  }

  clearInterval(AppState.testState.timerId);
  AppState.testState = {
    config,
    questions: finalQs,
    answers: {},
    markedForReview: new Set(),
    visited: new Set([finalQs[0].id]),
    currentIndex: 0,
    timeRemaining: config.timeLimitSec,
    timerId: null,
    isSubmitted: false,
    isReviewMode: false,
    startedAt: Date.now()
  };

  startTimer();
  renderTestMode(document.getElementById('contentBody'));
}

function startTimer() {
  clearInterval(AppState.testState.timerId);
  AppState.testState.timerId = setInterval(() => {
    if (AppState.testState.timeRemaining <= 0) { submitTest(true); return; }
    AppState.testState.timeRemaining--;
    const el = document.getElementById('testTimerDisplay');
    if (el) el.textContent = formatTime(AppState.testState.timeRemaining);
    if (AppState.testState.timeRemaining === 60) el?.classList.add('timer-warn');
  }, 1000);
}

export function renderTestMode(container) {
  const tState = AppState.testState;
  if (!tState.config) { renderTestSetup(container); return; }
  if (tState.isSubmitted && !tState.isReviewMode) { renderResults(container); return; }

  const review = tState.isReviewMode;
  const list = tState.questions;
  const q = list[tState.currentIndex];
  const userAns = tState.answers[q.id];
  const qLang = tState.config.qLang || AppState.questionLanguage;
  const loc = getAllLocalized(q, qLang);

  container.innerHTML = `
    <div class="test-wrap">
      <div class="test-topbar">
        <div class="test-progress">
          <span class="q-count">${tState.currentIndex + 1} / ${list.length}</span>
          <span class="test-title">${review ? (AppState.language === 'hi' ? '🔍 समीक्षा मोड' : '🔍 Review Mode') : '📝 Mock Test'}</span>
        </div>
        <div class="test-top-actions">
          ${review ? '' : `<span id="testTimerDisplay" class="test-timer">${formatTime(tState.timeRemaining)}</span>`}
          <select id="testQLangSwitch" class="language-select small">
            <option value="hi" ${qLang === 'hi' ? 'selected' : ''}>HI</option>
            <option value="en" ${qLang === 'en' ? 'selected' : ''}>EN</option>
            <option value="both" ${qLang === 'both' ? 'selected' : ''}>BOTH</option>
          </select>
          <button class="btn-icon ${review ? '' : 'primary'}" data-action="submit-test">${review ? (AppState.language === 'hi' ? '📊 परिणाम' : '📊 Results') : t('submitTest')}</button>
        </div>
      </div>

      <div class="test-body">
        <div class="test-question-area">
          <div class="question-card">
            <div class="question-card-head">
              <span class="q-index">Q${tState.currentIndex + 1}</span>
              <span class="q-meta-tag">${q.topic || ''} ${q.exam ? '• ' + q.exam : ''} ${q.difficulty ? '• ' + q.difficulty : ''}</span>
            </div>

            ${renderQuestionHTML(loc, qLang)}

            <div class="options">
              ${renderOptionsHTML(loc, q, userAns, review, qLang)}
            </div>

            ${review ? `<div class="explanation-box show"><strong>${AppState.language === 'hi' ? 'व्याख्या' : 'Explanation'}:</strong> ${renderExplHTML(loc, qLang)}</div>` : ''}

            <div class="test-actions-row">
              ${review ? '' : `
                <button class="btn-icon" data-action="clear-response">🗑️ ${AppState.language === 'hi' ? 'उत्तर हटाएँ' : 'Clear'}</button>
                <button class="btn-icon ${tState.markedForReview.has(q.id) ? 'marked active' : ''}" data-action="mark-review">${tState.markedForReview.has(q.id) ? '★' : '☆'} ${AppState.language === 'hi' ? 'समीक्षा के लिए चिन्हित' : 'Mark for Review'}</button>
              `}
            </div>
          </div>

          <div class="test-nav">
            <button class="btn-icon" data-action="prev-q" ${tState.currentIndex === 0 ? 'disabled' : ''}>◀ ${AppState.language === 'hi' ? 'पिछला' : 'Prev'}</button>
            <button class="btn-icon primary" data-action="next-q" ${tState.currentIndex === list.length - 1 ? 'disabled' : ''}>${AppState.language === 'hi' ? 'अगला' : 'Next'} ▶</button>
          </div>
        </div>

        <div class="palette-area">
          <div class="palette-header">Question Palette</div>
          <div class="palette-legend">
            <span class="legend-item"><span class="dot not-visited"></span>Not Visited</span>
            <span class="legend-item"><span class="dot not-answered"></span>Not Answered</span>
            <span class="legend-item"><span class="dot answered"></span>Answered</span>
            <span class="legend-item"><span class="dot marked"></span>Marked</span>
            <span class="legend-item"><span class="dot answered-marked"></span>Ans+Marked</span>
          </div>
          <div class="palette">
            ${list.map((item, idx) => {
              const isAns = tState.answers[item.id] !== undefined;
              const isMarked = tState.markedForReview.has(item.id);
              const isVisited = tState.visited.has(item.id);
              const isCurrent = idx === tState.currentIndex;
              let cls = 'palette-btn';
              if (!isVisited) cls += ' not-visited';
              else if (isAns && isMarked) cls += ' answered-marked';
              else if (isAns) cls += ' answered';
              else if (isMarked) cls += ' marked';
              else cls += ' not-answered';
              if (isCurrent) cls += ' current';
              return `<button class="${cls}" data-action="goto" data-idx="${idx}">${idx + 1}</button>`;
            }).join('')}
          </div>

          <div class="palette-stats">
            <div>Answered: ${Object.keys(tState.answers).length}</div>
            <div>Marked: ${tState.markedForReview.size}</div>
            <div>Visited: ${tState.visited.size}/${list.length}</div>
          </div>
        </div>
      </div>
    </div>
  `;

  container.querySelectorAll('[data-action="select"]').forEach(btn => {
    btn.addEventListener('click', () => selectOption(q.id, Number(btn.dataset.opt)));
  });
  container.querySelectorAll('[data-action="goto"]').forEach(btn => {
    btn.addEventListener('click', () => navigateTest(Number(btn.dataset.idx)));
  });
  container.querySelector('[data-action="prev-q"]')?.addEventListener('click', () => navigateTest(tState.currentIndex - 1));
  container.querySelector('[data-action="next-q"]')?.addEventListener('click', () => navigateTest(tState.currentIndex + 1));
  container.querySelector('[data-action="submit-test"]')?.addEventListener('click', () => {
    if (review) {
      tState.isReviewMode = false;
      renderResults(document.getElementById('contentBody'));
    } else {
      if (confirm(AppState.language === 'hi' ? `Submit? ${Object.keys(tState.answers).length}/${list.length} answered` : `Submit test? ${Object.keys(tState.answers).length}/${list.length} answered`)) submitTest();
    }
  });
  container.querySelector('[data-action="clear-response"]')?.addEventListener('click', () => {
    delete tState.answers[q.id];
    renderTestMode(container);
  });
  container.querySelector('[data-action="mark-review"]')?.addEventListener('click', () => {
    if (tState.markedForReview.has(q.id)) tState.markedForReview.delete(q.id);
    else tState.markedForReview.add(q.id);
    renderTestMode(container);
  });
  container.querySelector('#testQLangSwitch')?.addEventListener('change', (e) => {
    tState.config.qLang = e.target.value;
    renderTestMode(container);
  });
}

function renderQuestionHTML(loc, qLang) {
  if (qLang === 'both') {
    return `<div class="bilingual-question"><p class="q-text hi">${loc.questionHi}</p><p class="q-text en">${loc.questionEn}</p></div>`;
  }
  return `<p class="q-text">${loc.question || loc.questionHi || loc.questionEn}</p>`;
}
function renderOptionsHTML(loc, q, userAns, review, qLang) {
  const options = qLang === 'both' ? loc.optionsHi : loc.options;
  const optionsEn = loc.optionsEn || [];
  return options.map((opt, idx) => {
    let cls = 'option-btn';
    if (qLang === 'both') cls += ' bilingual';
    if (review) {
      if (idx === q.answer) cls += ' correct';
      else if (idx === userAns) cls += ' incorrect';
    } else if (userAns === idx) cls += ' selected';
    if (qLang === 'both') {
      const hasEn = optionsEn[idx] && optionsEn[idx] !== opt;
      return `<button class="${cls}" data-action="select" data-opt="${idx}" ${review ? 'disabled' : ''}>
        <span class="opt-row"><span class="opt-label">${String.fromCharCode(65 + idx)}.</span><span class="opt-text hi">${opt}</span></span>
        ${hasEn ? `<span class="opt-text en">${optionsEn[idx]}</span>` : ''}
      </button>`;
    }
    return `<button class="${cls}" data-action="select" data-opt="${idx}" ${review ? 'disabled' : ''}>
      <span class="opt-row"><span class="opt-label">${String.fromCharCode(65 + idx)}.</span><span class="opt-text">${opt}</span></span>
    </button>`;
  }).join('');
}
function renderExplHTML(loc, qLang) {
  if (qLang === 'both') return `<div class="hi">${loc.explanationHi}</div><div class="en">${loc.explanationEn}</div>`;
  return loc.explanation;
}

function selectOption(qId, optIdx) {
  const tState = AppState.testState;
  tState.answers[qId] = optIdx;
  renderTestMode(document.getElementById('contentBody'));
}
export function navigateTest(idx) {
  const tState = AppState.testState;
  if (idx < 0 || idx >= tState.questions.length) return;
  tState.currentIndex = idx;
  tState.visited.add(tState.questions[idx].id);
  renderTestMode(document.getElementById('contentBody'));
}
export function submitTest(isAuto = false) {
  const tState = AppState.testState;
  clearInterval(tState.timerId);
  tState.isSubmitted = true;
  tState.isReviewMode = false;
  tState.questions.forEach(q => {
    const sel = tState.answers[q.id];
    if (sel !== undefined) Analytics.recordAttempt(q.bank, q.id, sel, q.answer);
  });
  if (isAuto) alert(AppState.language === 'hi' ? 'समय समाप्त! टेस्ट ऑटो सबमिट' : 'Time up! Auto submitted');
  renderResults(document.getElementById('contentBody'));
}
function renderResults(container) {
  const tState = AppState.testState;
  const list = tState.questions;
  const total = list.length;
  const answered = Object.keys(tState.answers).length;
  const correct = list.filter(q => tState.answers[q.id] === q.answer).length;
  const wrong = answered - correct;
  const unattempted = total - answered;
  const negative = tState.config.negative || 0;
  const scoreRaw = correct - (wrong * negative);
  const percentage = total ? Math.round((correct / total) * 100) : 0;
  const timeTaken = Math.floor((Date.now() - tState.startedAt) / 1000);

  Storage.pushTestHistory({ date: Date.now(), total, answered, correct, wrong, score: percentage, time: Math.floor(timeTaken / 60), rawScore: scoreRaw });

  container.innerHTML = `
    <div class="test-results">
      <h2>${AppState.language === 'hi' ? '📊 परिणाम' : '📊 Results'}</h2>
      <div class="score-circle-wrap">
        <div class="score-circle" style="background: conic-gradient(var(--success) ${percentage}%, var(--bg-main) ${percentage}%);">
          <div class="score-inner"><span class="score-num">${percentage}%</span><span class="score-label">Score</span></div>
        </div>
      </div>
      <div class="result-stats">
        <div class="stat-box"><span>Total</span><b>${total}</b></div>
        <div class="stat-box"><span>Answered</span><b>${answered}</b></div>
        <div class="stat-box correct"><span>Correct</span><b>${correct}</b></div>
        <div class="stat-box incorrect"><span>Wrong</span><b>${wrong}</b></div>
        <div class="stat-box"><span>Unattempted</span><b>${unattempted}</b></div>
        <div class="stat-box"><span>Final Score</span><b>${scoreRaw.toFixed(2)} ${negative ? `( -${negative} per wrong)` : ''}</b></div>
        <div class="stat-box"><span>Time Taken</span><b>${Math.floor(timeTaken / 60)}m ${timeTaken % 60}s</b></div>
      </div>
      <div class="result-question-list">
        ${list.map((q, i) => {
          const ans = tState.answers[q.id];
          const isCorrect = ans === q.answer;
          const status = ans === undefined ? 'unattempted' : isCorrect ? 'correct' : 'wrong';
          return `<div class="result-q-item ${status}"><span>${i + 1}. ${status === 'correct' ? '✅' : status === 'wrong' ? '❌' : '⚪'}</span><span>${ans !== undefined ? `Your: ${String.fromCharCode(65 + ans)} | Correct: ${String.fromCharCode(65 + q.answer)}` : `Correct: ${String.fromCharCode(65 + q.answer)} | Not Answered`}</span></div>`;
        }).join('')}
      </div>
      <div class="test-nav" style="margin-top:20px">
        <button class="btn-icon" data-action="retake">🔁 ${AppState.language === 'hi' ? 'फिर से' : 'Retake'}</button>
        <button class="btn-icon primary" data-action="review">🔍 ${AppState.language === 'hi' ? 'समीक्षा' : 'Review Answers'}</button>
        <button class="btn-icon" data-action="new-test">🆕 ${AppState.language === 'hi' ? 'नया टेस्ट' : 'New Test'}</button>
      </div>
    </div>
  `;

  container.querySelector('[data-action="retake"]').addEventListener('click', () => {
    tState.answers = {}; tState.markedForReview = new Set(); tState.visited = new Set([list[0].id]); tState.currentIndex = 0; tState.isSubmitted = false; tState.isReviewMode = false; tState.timeRemaining = tState.config.timeLimitSec; tState.startedAt = Date.now(); startTimer(); renderTestMode(document.getElementById('contentBody'));
  });
  container.querySelector('[data-action="review"]').addEventListener('click', () => { tState.isReviewMode = true; tState.currentIndex = 0; renderTestMode(document.getElementById('contentBody')); });
  container.querySelector('[data-action="new-test"]').addEventListener('click', () => { resetTestState(); renderTestSetup(document.getElementById('contentBody')); });
}
export function resetTestState() {
  clearInterval(AppState.testState.timerId);
  AppState.testState = { config: null, questions: [], answers: {}, markedForReview: new Set(), visited: new Set(), currentIndex: 0, timeRemaining: 0, timerId: null, isSubmitted: false, isReviewMode: false, startedAt: null };
}
