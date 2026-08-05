# Brahmastra Quiz - Improved Version

## What was wrong before?
1. **Mock Test mixed with Practice** - both used `AppState.filteredQuestions` and `userAnswers`, so answering in practice polluted mock test and vice versa.
2. **Hindi dominant** - dual lang fields existed (`question_en`) but rendering was ad-hoc, no central resolver, no bilingual view.
3. **Topics always shown** - sidebar showed all 5 topics even if bank only contained history questions.

## Fixes Implemented

### 1. Isolated Mock Test (No Mixing)
**New file: `state.js`**
- Added `AppState.testState` separate object:
  - `questions`, `answers`, `markedForReview`, `visited`, `currentIndex`, `timeRemaining`, `timerId`, `isSubmitted`, `isReviewMode`
- Practice keeps using `filteredQuestions` + `userAnswers`
- Test never writes to practice state

**New file: `mocktest.js` completely rewritten**
- Flow: Setup → Running → Submit → Results → Review
- Features:
  - Multi-bank + dynamic multi-topic select (auto-updates topics when banks change)
  - Palette states: Not Visited (gray), Not Answered (red), Answered (green), Marked (yellow), Answered+Marked (green/yellow split)
  - Mark for Review, Clear Response, timer with 60s warning pulse, auto-submit on timeup
  - Negative marking option, question count, time limit
  - Question language switch INSIDE test (HI/EN/BOTH)
  - History saved in localStorage (last 5)
  - Review mode shows explanations only after submit
  - Search disabled during running test to prevent pollution

### 2. Dual Language Support – Future Proof
**New module: `question-i18n.js`**
Supports 3 JSON shapes for future:

**Form A – Flat fields (old + en)**
```json
{
  "question": "हिन्दी प्रश्न",
  "question_en": "English Q",
  "options": ["हि1","हि2"],
  "options_en": ["En1","En2"],
  "explanation": "हि व्याख्या",
  "explanation_en": "En explanation"
}
```

**Form B – Object shape**
```json
{
  "question": {"hi":"हिन्दी","en":"English"},
  "options": [{"hi":"पहला","en":"First"},{"hi":"दूसरा","en":"Second"}],
  "explanation": {"hi":"...","en":"..."}
}
```

**Form C – translations dict**
```json
{
  "question": "fallback",
  "translations": {
    "en": {"question":"...","options":[...],"explanation":"..."},
    "hi": {"question":"..."}
  }
}
```

- Central functions: `getLocalizedQuestion(q, lang)`, `getLocalizedOptions`, `getLocalizedExplanation`, `getAllLocalized(q, lang)`
- Normalizer `normalizeIncomingQuestion()` auto-converts any incoming JSON to canonical bilingual internal shape, so you can drop new JSON files without code change
- UI: New Ques Lang selector in sidebar (HI / EN / BOTH). In BOTH mode, Hindi + English stacked with left border color coding
- Inside Mock Test: separate qLang switch that persists per test
- All renderers (practice.js, flashcards.js, mocktest.js) use `getAllLocalized`

**Manager import** also uses normalizer, so imported files with any of the 3 formats work.

### 3. Dynamic Topics (Auto-hide unused)
**loader.js: `getAvailableTopicsFromPool(pool)`**
- Collects unique `topic_id` from current pool
- Maps to known topics from topics.json, or creates dynamic topic entry from `q.topic` if id unknown
- Always includes All Topics (id 0)

**ui.js: `renderTopics(availableTopics, counts)` + `setCurrentPoolForTopics`**
- Only renders topics where count>0
- Sidebar now shows hint when no topics
- If you select **History Only Demo bank** (3 questions all topic_id 2), sidebar shows only "All Topics" + "Rajasthan History..." – Geography, Psychology etc disappear automatically

**Mock Test setup**: Topics dropdown dynamically updates when banks selection changes (counts shown in brackets)

### Other Improvements
- `app.js` no longer overwrites test state when bank/topic/search changes
- `storage.js` new keys for question language and test history
- `style.css` complete redesign for test palette, bilingual display, legend, results, etc.
- `database/` includes demo bilingual files + history_only demo to prove dynamic topics
- Language toggle now two levels: UI language (hi/en) + Question language (hi/en/both)

## How to add new JSON with dual language
Drop a file like `database/my_bank.json` with questions in any of the 3 formats above, then add entry to `database/banks.json`:

```json
{
  "id": "my_bank",
  "title": "My Bank English Title",
  "title_hi": "मेरा बैंक हिंदी शीर्षक",
  "icon": "📘",
  "file": "database/my_bank.json"
}
```

Reload – bank appears, topics auto-detected, bilingual works automatically.

If you import via UI (Manage → Import JSON), bank is created automatically, topics auto-detected.

## Testing the fix
1. Select **History Only Demo** bank → observe topic list shows only 1 topic (fix #3 proven)
2. Go to Practice, answer 2 questions, then switch to Mock Test → Mock palette shows 0 answered (isolated, fix #1 proven)
3. Switch Question Lang to BOTH → see Hindi + English stacked (fix #2 proven)
4. Start Mock Test with negative marking, mark review, clear response → palette colors update correctly

Live preview running on port 8000.
