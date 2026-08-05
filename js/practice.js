// ============================================================
// practice.js — Practice Mode with FULL bilingual parity to Mock Test
// Isolated: uses filteredQuestions only, never touches testState
// ============================================================

import { AppState } from './state.js';
import * as Analytics from './analytics.js';
import { t } from './ui.js';
import { getAllLocalized } from './question-i18n.js';
import * as UI from './ui.js';

export function renderPracticeMode(container) {
  const list = AppState.filteredQuestions;
  if (!list.length) {
    container.innerHTML = `<div class="empty-state">${t('noQuestions')}</div>`;
    return;
  }
  const answeredCount = list.filter(q => AppState.userAnswers[q.id] !== undefined).length;
  const correctCount = list.filter(q => AppState.userAnswers[q.id] === q.answer).length;

  const qLang = AppState.questionLanguage;

  let html = `
    <div class="practice-header">
      <div class="practice-stats">
        <span>${answeredCount}/${list.length} ${AppState.language === 'hi' ? 'उत्तर दिए गए' : 'answered'}</span>
        <span class="stat-correct">${correctCount} ${AppState.language === 'hi' ? 'सही' : 'correct'}</span>
      </div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <div class="q-lang-switcher">
          <label style="font-size:.75rem;color:var(--text-muted);font-weight:700">Q Lang:</label>
          <select id="practiceQLangSwitch" class="language-select small">
            <option value="hi" ${qLang === 'hi' ? 'selected' : ''}>हिन्दी Only</option>
            <option value="en" ${qLang === 'en' ? 'selected' : ''}>English Only</option>
            <option value="both" ${qLang === 'both' ? 'selected' : ''}>Bilingual • दोनों</option>
          </select>
        </div>
        <button class="btn-icon" data-action="reset-answers">${t('resetAnswers')}</button>
      </div>
    </div>
    <div class="question-list">
  `;

  list.forEach((q, idx) => {
    const userAns = AppState.userAnswers[q.id];
    const isAnswered = userAns !== undefined;
    const loc = getAllLocalized(q, qLang);
    const bookmarked = Analytics.isBookmarked(q.bank, q.id);

    // For EN-only mode when translation missing, show notice like before
    const showLangNotice = qLang === 'en' && !loc.hasEn;
    
    html += `
      <div class="question-card" data-qid="${q.id}">
        <div class="question-card-head">
          <span class="q-index">#${idx + 1}</span>
          <div style="display:flex;gap:8px;align-items:center">
            <span class="q-meta-tag">${q.topic || ''} ${q.exam ? '• ' + q.exam : ''} ${q.difficulty ? '• ' + q.difficulty : ''}</span>
            <button class="bookmark-btn ${bookmarked ? 'active' : ''}" data-action="bookmark" data-qid="${q.id}" data-bank="${q.bank}" title="Bookmark">${bookmarked ? '★' : '☆'}</button>
          </div>
        </div>
        ${renderQuestionText(loc, qLang)}
        ${q.image ? `<img class="q-image" src="${q.image}" alt="">` : ''}
        ${showLangNotice ? `<div class="language-notice">${t('languageNote')}</div>` : ''}
        <div class="options">
          ${renderOptions(loc, q, userAns, isAnswered, qLang)}
        </div>
        ${isAnswered ? renderExplanation(loc, qLang) + `<div class="q-meta">${q.year || ''} ${q.tags?.length ? '· ' + q.tags.join(', ') : ''}</div>` : ''}
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;

  // bindings
  container.querySelectorAll('[data-action="answer"]').forEach(btn => {
    btn.addEventListener('click', () => handleAnswer(Number(btn.dataset.qid), Number(btn.dataset.opt)));
  });
  container.querySelectorAll('[data-action="bookmark"]').forEach(btn => {
    btn.addEventListener('click', () => {
      Analytics.toggleBookmark(btn.dataset.bank, Number(btn.dataset.qid));
      renderPracticeMode(container);
    });
  });
  container.querySelector('[data-action="reset-answers"]')?.addEventListener('click', () => {
    resetAnswers();
    renderPracticeMode(container);
  });
  container.querySelector('#practiceQLangSwitch')?.addEventListener('change', (e) => {
    UI.applyQuestionLanguage(e.target.value);
  });
}

function renderQuestionText(loc, qLang) {
  if (qLang === 'both') {
    // Same style as mock test: Hindi top (blue border), English bottom (purple border, muted)
    const hi = loc.questionHi || loc.question || '';
    const en = loc.questionEn || loc.question || '';
    if (!loc.questionEn || loc.questionEn === loc.questionHi) {
      // if EN missing, show only HI + hint
      return `<div class="bilingual-question"><p class="q-text hi">${hi}</p><p class="q-text en small" style="opacity:.6;font-style:italic">(English not available)</p></div>`;
    }
    return `
      <div class="bilingual-question">
        <p class="q-text hi">${hi}</p>
        <p class="q-text en">${en}</p>
      </div>
    `;
  }
  // single language
  const text = loc.question || loc.questionHi || loc.questionEn || '';
  return `<p class="q-text">${text}</p>`;
}

function renderOptions(loc, q, userAns, isAnswered, qLang) {
  if (qLang === 'both') {
    const optsHi = loc.optionsHi || loc.options || [];
    const optsEn = loc.optionsEn || [];
    return optsHi.map((optHi, idx) => {
      let cls = 'option-btn bilingual';
      if (isAnswered) {
        if (idx === q.answer) cls += ' correct';
        else if (idx === userAns) cls += ' incorrect';
      }
      const optEn = optsEn[idx] || '';
      const hasEn = optEn && optEn !== optHi;
      return `<button class="${cls}" data-action="answer" data-qid="${q.id}" data-opt="${idx}" ${isAnswered ? 'disabled' : ''}>
        <span class="opt-row"><span class="opt-label">${String.fromCharCode(65 + idx)}).</span><span class="opt-text hi">${optHi}</span></span>
        ${hasEn ? `<span class="opt-text en">${optEn}</span>` : ''}
      </button>`;
    }).join('');
  } else {
    const opts = loc.options || [];
    return opts.map((opt, idx) => {
      let cls = 'option-btn';
      if (isAnswered) {
        if (idx === q.answer) cls += ' correct';
        else if (idx === userAns) cls += ' incorrect';
      }
      // NEW: A).  format with some space then option
      return `<button class="${cls}" data-action="answer" data-qid="${q.id}" data-opt="${idx}" ${isAnswered ? 'disabled' : ''}>
        <span class="opt-row"><span class="opt-label">${String.fromCharCode(65 + idx)}).</span><span class="opt-text">${opt}</span></span>
      </button>`;
    }).join('');
  }
}

function renderExplanation(loc, qLang) {
  if (qLang === 'both') {
    const hi = loc.explanationHi || loc.explanation || '';
    const en = loc.explanationEn || '';
    return `<div class="explanation">
      <strong>${AppState.language === 'hi' ? 'व्याख्या' : 'Explanation'}:</strong>
      <div class="bilingual-expl">
        <div class="hi">${hi}</div>
        ${en ? `<div class="en" style="opacity:.85;margin-top:6px;border-top:1px dashed var(--border);padding-top:6px">${en}</div>` : ''}
      </div>
    </div>`;
  }
  const exp = loc.explanation || loc.explanationHi || loc.explanationEn || '';
  return `<div class="explanation"><strong>${AppState.language === 'hi' ? 'व्याख्या' : 'Explanation'}:</strong> ${exp}</div>`;
}

function handleAnswer(qId, optIdx) {
  const q = AppState.filteredQuestions.find(item => item.id === qId);
  if (!q || AppState.userAnswers[qId] !== undefined) return;
  AppState.userAnswers[qId] = optIdx;
  Analytics.recordAttempt(q.bank, qId, optIdx, q.answer);
  renderPracticeMode(document.getElementById('contentBody'));
}

function resetAnswers() {
  AppState.filteredQuestions.forEach(q => delete AppState.userAnswers[q.id]);
}
