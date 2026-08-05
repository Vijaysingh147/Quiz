// search.js — no change except keeps custom entries compatible
import { loadBank } from './loader.js';

let indexCache = null;
let indexPromise = null;

async function loadIndex() {
  if (indexCache) return indexCache;
  if (!indexPromise) {
    indexPromise = fetch('database/search-index.json')
      .then(res=> res.ok ? res.json() : [])
      .then(data=> { indexCache=data; return data; })
      .catch(()=> { indexCache=[]; return []; });
  }
  return indexPromise;
}

function customIndexEntries() { return window.__customSearchEntries || []; }

export function addCustomSearchEntries(bankId, questions) {
  window.__customSearchEntries = window.__customSearchEntries || [];
  window.__customSearchEntries = window.__customSearchEntries.filter(e=> e.bank!==bankId);
  window.__customSearchEntries.push(...questions.map(q=> ({
    id: q.id, bank: bankId, topic: q.topic, topic_id: q.topic_id,
    subtopic: q.subtopic||'', tags:q.tags||[], exam:q.exam||'', year:q.year||'',
    q: (q.question_hi || q.question || '').slice(0,120)
  })));
}

export async function search(query, {bankId=null, limit=100}={}) {
  const term = query.trim().toLowerCase();
  if (!term) return [];
  const index = await loadIndex();
  const combined = [...index, ...customIndexEntries()];
  const results = combined.filter(entry=>{
    if (bankId && bankId!=='all' && entry.bank!==bankId) return false;
    const haystack = [entry.q, entry.topic, entry.subtopic, ...(entry.tags||[]), entry.exam, String(entry.year)].join(' ').toLowerCase();
    return haystack.includes(term);
  });
  return results.slice(0, limit);
}

export async function resolveSearchResult(result) {
  const questions = await loadBank(result.bank);
  return questions.find(q=> q.id===result.id) || null;
}
