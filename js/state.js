// ============================================================
// state.js — centralized state, now fully 분리: practice & mock test
// ============================================================

export const AppState = {
  // Global UI
  language: 'hi',          // UI language: hi | en
  questionLanguage: 'hi',  // Question display: hi | en | both
  theme: 'dark',

  // Practice / Flashcards filtering
  currentBankId: null,     // 'all' or bank id
  currentTopicId: 0,       // 0 = all
  filteredQuestions: [],   // ONLY for practice + flashcard
  userAnswers: {},         // qId -> selected (practice only)
  flashIndex: 0,
  isFlipped: false,

  // Mock Test — completely isolated state machine
  testState: {
    config: null,          // last config {bankIds, topicIds, difficulty, source, count, timeLimitSec, questionLang}
    questions: [],         // questions for THIS test only
    answers: {},           // qId -> selected index (test only, separate from practice userAnswers)
    markedForReview: new Set(), // Set of qId marked
    visited: new Set(),    // Set of qId visited
    currentIndex: 0,
    timeRemaining: 0,
    timerId: null,
    isSubmitted: false,
    isReviewMode: false,
    startedAt: null
  }
};

export const UI_STRINGS_CACHE = {}; // lang -> JSON
