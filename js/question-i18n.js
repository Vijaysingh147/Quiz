// ============================================================
// question-i18n.js — central bilingual resolver
// Supports 3 JSON shapes for future compatibility:
//   A) { question, question_en, options, options_en ... }
//   B) { question: {hi,en}, options: [{hi,en}...] }
//   C) { translations: {en:{question, options...}, hi:{...}} }
// ============================================================

function asObject(val) {
  return val && typeof val === 'object' && !Array.isArray(val) ? val : null;
}

function pickLangFromObj(obj, lang) {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  if (asObject(obj)) {
    return obj[lang] || obj.hi || obj.en || obj.HI || obj.EN || '';
  }
  return String(obj);
}

export function getLocalizedQuestion(q, lang = 'hi') {
  // translations dict highest priority
  if (q.translations?.[lang]?.question) return q.translations[lang].question;
  if (asObject(q.question)) return pickLangFromObj(q.question, lang);
  if (lang === 'en' && q.question_en) return q.question_en;
  if (lang === 'hi' && q.question_hi) return q.question_hi;
  // fallback field is considered hi by default, but if en requested and no en, return fallback too
  return q.question || q.question_hi || q.question_en || '';
}

export function getLocalizedOptions(q, lang = 'hi') {
  // translations dict
  if (q.translations?.[lang]?.options?.length) return q.translations[lang].options;
  // options_en field
  if (lang === 'en' && Array.isArray(q.options_en) && q.options_en.length) return q.options_en;
  if (lang === 'hi' && Array.isArray(q.options_hi) && q.options_hi.length) return q.options_hi;

  // array of objects {hi,en}
  if (Array.isArray(q.options) && q.options.length && asObject(q.options[0])) {
    return q.options.map(optObj => pickLangFromObj(optObj, lang) || '');
  }
  return q.options || q.options_hi || q.options_en || [];
}

export function getLocalizedExplanation(q, lang = 'hi') {
  if (q.translations?.[lang]?.explanation) return q.translations[lang].explanation;
  if (asObject(q.explanation)) return pickLangFromObj(q.explanation, lang);
  if (lang === 'en' && q.explanation_en) return q.explanation_en;
  if (lang === 'hi' && q.explanation_hi) return q.explanation_hi;
  return q.explanation || '';
}

export function getAllLocalized(q, questionLang = 'hi') {
  // Returns object ready for rendering considering both mode
  if (questionLang === 'both') {
    return {
      questionHi: getLocalizedQuestion(q, 'hi'),
      questionEn: getLocalizedQuestion(q, 'en'),
      optionsHi: getLocalizedOptions(q, 'hi'),
      optionsEn: getLocalizedOptions(q, 'en'),
      explanationHi: getLocalizedExplanation(q, 'hi'),
      explanationEn: getLocalizedExplanation(q, 'en'),
      hasEn: !!(getLocalizedQuestion(q, 'en') && getLocalizedQuestion(q, 'en') !== getLocalizedQuestion(q, 'hi')),
      mode: 'both'
    };
  }
  return {
    question: getLocalizedQuestion(q, questionLang),
    options: getLocalizedOptions(q, questionLang),
    explanation: getLocalizedExplanation(q, questionLang),
    mode: 'single',
    hasEn: !!q.question_en || !!asObject(q.question) || !!q.translations?.en
  };
}

// Helper to normalize any incoming raw JSON into internal canonical bilingual shape
// so future added json files work without further conversion
export function normalizeIncomingQuestion(raw, bankId, fallbackId) {
  const base = {
    id: Number.isInteger(raw.id) ? raw.id : fallbackId,
    bank: bankId,
    topic: raw.topic || raw.topic_hi || '',
    topic_id: Number(raw.topic_id) || 0,
    subtopic: raw.subtopic || '',
    difficulty: raw.difficulty || 'medium',
    language: raw.language || 'hi',
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    exam: raw.exam || '',
    year: raw.year || new Date().getFullYear(),
    image: raw.image || '',
    negativeMarks: typeof raw.negativeMarks === 'number' ? raw.negativeMarks : 0.25,
    timeLimit: raw.timeLimit || 60,
    translations: raw.translations || null
  };

  // question
  if (asObject(raw.question)) {
    base.question = raw.question.hi || raw.question.en || '';
    base.question_hi = raw.question.hi || '';
    base.question_en = raw.question.en || '';
  } else {
    base.question = String(raw.question ?? raw.question_hi ?? '').trim();
    base.question_en = String(raw.question_en ?? '').trim();
    base.question_hi = String(raw.question_hi ?? base.question).trim();
    if (!base.question) base.question = base.question_en;
  }

  // options
  if (Array.isArray(raw.options) && raw.options.length && asObject(raw.options[0])) {
    base.options = raw.options.map(o => pickLangFromObj(o, 'hi'));
    base.options_en = raw.options.map(o => pickLangFromObj(o, 'en'));
    base.options_hi = base.options;
  } else {
    const opts = Array.isArray(raw.options) ? raw.options.map(o => String(o ?? '').trim()) : [];
    const optsEn = Array.isArray(raw.options_en) ? raw.options_en.map(o => String(o ?? '').trim()) : [];
    const optsHi = Array.isArray(raw.options_hi) ? raw.options_hi.map(o => String(o ?? '').trim()) : opts;
    base.options = opts.length ? opts : optsHi;
    base.options_en = optsEn.length ? optsEn : [];
    base.options_hi = optsHi;
  }

  // explanation
  if (asObject(raw.explanation)) {
    base.explanation = raw.explanation.hi || raw.explanation.en || '';
    base.explanation_hi = raw.explanation.hi || '';
    base.explanation_en = raw.explanation.en || '';
  } else {
    base.explanation = String(raw.explanation ?? '').trim();
    base.explanation_en = String(raw.explanation_en ?? '').trim();
    base.explanation_hi = String(raw.explanation_hi ?? base.explanation).trim();
  }

  // validation
  if (!base.question) return { error: 'Missing question text.' };
  if (!Array.isArray(base.options) || base.options.length < 2) return { error: 'Needs at least 2 options.' };
  const ans = Number(raw.answer);
  if (!Number.isInteger(ans) || ans < 0 || ans >= base.options.length) return { error: 'Invalid answer index.' };
  base.answer = ans;

  // keep any extra bilingual fields user may have
  if (raw.question) base._rawQuestion = raw.question;
  if (raw.options) base._rawOptions = raw.options;

  return base;
}
