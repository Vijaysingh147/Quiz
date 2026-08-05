// analytics same as before — kept isolated
const KEYS = {
  ATTEMPTED: 'brahmastra_analytics_attempted',
  BOOKMARKS: 'brahmastra_analytics_bookmarks',
  WRONG: 'brahmastra_analytics_wrong',
  STATISTICS: 'brahmastra_analytics_statistics'
};
function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch(e) { console.warn('[analytics] save failed', e); }
}
function qKey(bankId, qId) { return `${bankId}:${qId}`; }
export function recordAttempt(bankId, qId, selectedIndex, correctIndex) {
  const attempted = load(KEYS.ATTEMPTED, {});
  const key = qKey(bankId, qId);
  const isCorrect = selectedIndex === correctIndex;
  attempted[key] = { selected: selectedIndex, correct: isCorrect, ts: Date.now() };
  save(KEYS.ATTEMPTED, attempted);
  const wrong = new Set(load(KEYS.WRONG, []));
  if (isCorrect) wrong.delete(key); else wrong.add(key);
  save(KEYS.WRONG, [...wrong]);
  updateStatistics(bankId, isCorrect);
  return isCorrect;
}
export function getAttempted() { return load(KEYS.ATTEMPTED, {}); }
export function isAttempted(bankId, qId) { return qKey(bankId, qId) in getAttempted(); }
export function getAttemptedAnswer(bankId, qId) { return getAttempted()[qKey(bankId, qId)]?.selected; }
export function toggleBookmark(bankId, qId) {
  const key = qKey(bankId, qId);
  const bookmarks = new Set(load(KEYS.BOOKMARKS, []));
  const now = !bookmarks.has(key);
  now ? bookmarks.add(key) : bookmarks.delete(key);
  save(KEYS.BOOKMARKS, [...bookmarks]);
  return now;
}
export function isBookmarked(bankId, qId) { return load(KEYS.BOOKMARKS, []).includes(qKey(bankId, qId)); }
export function getBookmarkKeys() { return load(KEYS.BOOKMARKS, []); }
export function getWrongKeys() { return load(KEYS.WRONG, []); }
function updateStatistics(bankId, isCorrect) {
  const stats = load(KEYS.STATISTICS, { totalAttempted:0, totalCorrect:0, byBank:{} });
  stats.totalAttempted++; if (isCorrect) stats.totalCorrect++;
  if (!stats.byBank[bankId]) stats.byBank[bankId]={attempted:0,correct:0};
  stats.byBank[bankId].attempted++; if (isCorrect) stats.byBank[bankId].correct++;
  save(KEYS.STATISTICS, stats);
}
export function getStatistics(){ return load(KEYS.STATISTICS, {totalAttempted:0,totalCorrect:0,byBank:{}}); }
export function parseKeys(keys){ return keys.map(k=>{ const idx=k.lastIndexOf(':'); return {bankId:k.slice(0,idx), qId:Number(k.slice(idx+1))}; }); }
export function resetAllAnalytics(){ Object.values(KEYS).forEach(k=>{ try{ localStorage.removeItem(k);}catch{} }); }
