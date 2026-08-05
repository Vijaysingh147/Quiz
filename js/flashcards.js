// flashcards.js — with bilingual parity same as practice & mock test
import { AppState } from './state.js';
import { t } from './ui.js';
import { getAllLocalized } from './question-i18n.js';
import * as UI from './ui.js';

export function renderFlashcardMode(container) {
  const list = AppState.filteredQuestions;
  if (!list.length) {
    container.innerHTML = `<div class="empty-state">${t('noQuestions')}</div>`;
    return;
  }
  if (AppState.flashIndex >= list.length) AppState.flashIndex = 0;
  const q = list[AppState.flashIndex];
  const qLang = AppState.questionLanguage;
  const loc = getAllLocalized(q, qLang);

  container.innerHTML = `
    <div class="flashcard-wrap">
      <div class="flashcard-topbar" style="display:flex;justify-content:space-between;width:100%;max-width:800px;align-items:center;flex-wrap:wrap;gap:10px">
        <div class="flashcard-progress">${AppState.flashIndex + 1} / ${list.length}</div>
        <div class="q-lang-switcher">
          <select id="flashQLangSwitch" class="language-select small">
            <option value="hi" ${qLang === 'hi' ? 'selected' : ''}>HI</option>
            <option value="en" ${qLang === 'en' ? 'selected' : ''}>EN</option>
            <option value="both" ${qLang === 'both' ? 'selected' : ''}>BOTH</option>
          </select>
        </div>
      </div>
      <div class="flashcard ${AppState.isFlipped ? 'flipped' : ''}" id="currentFlashcard">
        <div class="card-face front">
          ${renderQ(loc, qLang)}
          <ul class="flash-options">${renderOpts(loc, qLang)}</ul>
          <span class="flash-hint">${t('flipCard')}</span>
        </div>
        <div class="card-face back">
          ${renderAnswer(loc, q, qLang)}
        </div>
      </div>
      <div class="flashcard-nav">
        <button class="btn-icon" data-action="prev">${t('prevCard')}</button>
        <button class="btn-icon" data-action="flip">${AppState.language === 'hi' ? 'पलटें' : 'Flip'}</button>
        <button class="btn-icon" data-action="next">${t('nextCard')}</button>
      </div>
    </div>
  `;

  container.querySelector('#flashQLangSwitch')?.addEventListener('change', (e) => UI.applyQuestionLanguage(e.target.value));
  container.querySelector('[data-action="flip"]').addEventListener('click', flipCard);
  container.querySelectorAll('[data-action="prev"]').forEach(b => b.addEventListener('click', prevCard));
  container.querySelectorAll('[data-action="next"]').forEach(b => b.addEventListener('click', nextCard));
  document.getElementById('currentFlashcard')?.addEventListener('click', flipCard);
}

function renderQ(loc, qLang) {
  if (qLang === 'both') {
    return `<p class="card-q-text hi">${loc.questionHi}</p><p class="card-q-text en small">${loc.questionEn || ''}</p>`;
  }
  return `<p class="card-q-text">${loc.question}</p>`;
}
function renderOpts(loc, qLang) {
  const opts = qLang === 'both' ? (loc.optionsHi || []) : (loc.options || []);
  const optsEn = loc.optionsEn || [];
  return opts.map((o, i) => `<li>${String.fromCharCode(65 + i)}. ${o} ${qLang === 'both' && optsEn[i] ? `<small style="opacity:.6"> / ${optsEn[i]}</small>` : ''}</li>`).join('');
}
function renderAnswer(loc, q, qLang) {
  if (qLang === 'both') {
    const ansHi = loc.optionsHi?.[q.answer] || '';
    const ansEn = loc.optionsEn?.[q.answer] || '';
    return `
      <p class="flash-answer">${AppState.language === 'hi' ? 'सही उत्तर' : 'Correct'}: ${ansHi} ${ansEn ? `/ ${ansEn}` : ''}</p>
      <p class="flash-explanation"><span class="hi">${loc.explanationHi || loc.explanation || ''}</span><br><small class="en">${loc.explanationEn || ''}</small></p>
    `;
  }
  return `
    <p class="flash-answer">${AppState.language === 'hi' ? 'सही उत्तर' : 'Correct'}: ${loc.options?.[q.answer] || ''}</p>
    <p class="flash-explanation">${loc.explanation || ''}</p>
  `;
}

export function flipCard() {
  AppState.isFlipped = !AppState.isFlipped;
  document.getElementById('currentFlashcard')?.classList.toggle('flipped', AppState.isFlipped);
}
export function nextCard() {
  AppState.isFlipped = false;
  AppState.flashIndex = (AppState.flashIndex + 1) % AppState.filteredQuestions.length;
  renderFlashcardMode(document.getElementById('contentBody'));
}
export function prevCard() {
  AppState.isFlipped = false;
  AppState.flashIndex = (AppState.flashIndex - 1 + AppState.filteredQuestions.length) % AppState.filteredQuestions.length;
  renderFlashcardMode(document.getElementById('contentBody'));
}
