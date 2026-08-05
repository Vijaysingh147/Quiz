// ============================================================
// loader.js — owns disk -> memory loading, now with bilingual norm
// ============================================================

import { getCustomBankRegistry, getCustomBankQuestions } from './storage.js';
import { normalizeIncomingQuestion } from './question-i18n.js';

const bankCache = new Map();
let bankRegistry = null;
let topicsCache = null;

async function fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

export async function loadBankRegistry() {
  if (bankRegistry) return bankRegistry;
  let fileBanks = [];
  try {
    fileBanks = await fetchJSON('database/banks.json');
  } catch (e) {
    console.warn('banks.json missing, using custom only', e);
    fileBanks = [];
  }
  const customBanks = getCustomBankRegistry();
  bankRegistry = [...fileBanks, ...customBanks];
  return bankRegistry;
}

export function getBankMeta(bankId) {
  return (bankRegistry || []).find(b => b.id === bankId);
}
export function listBanks() { return bankRegistry || []; }

export async function loadBank(bankId) {
  if (bankCache.has(bankId)) return bankCache.get(bankId);
  const meta = getBankMeta(bankId);
  if (!meta) throw new Error(`Unknown bank id: ${bankId}`);
  let questions;
  if (meta.isCustom) {
    questions = getCustomBankQuestions(bankId);
  } else {
    const raw = await fetchJSON(meta.file);
    // Normalize each question to canonical bilingual shape for forward compat
    questions = raw.map((r, i) => {
      const n = normalizeIncomingQuestion(r, bankId, r.id ?? i + 1);
      if (n.error) return r; // if old format passes through, keep raw but will still work via i18n helper
      return n;
    }).filter(Boolean);
  }
  bankCache.set(bankId, questions);
  return questions;
}

export function getCachedBank(bankId) { return bankCache.get(bankId) || null; }
export function isBankLoaded(bankId) { return bankCache.has(bankId); }

export async function loadAllBanks() {
  const banks = listBanks();
  await Promise.all(banks.map(b => loadBank(b.id).catch(()=>{})));
  return banks.map(b => ({ bank: b, questions: getCachedBank(b.id) || [] }));
}

export async function loadTopics() {
  if (topicsCache) return topicsCache;
  try { topicsCache = await fetchJSON('database/topics.json'); }
  catch { topicsCache = [
    {id:0, title:"All Topics", title_hi:"सभी टॉपिक्स"},
    {id:1, title:"Rajasthan Geography", title_hi:"राजस्थान भूगोल"},
    {id:2, title:"Rajasthan History", title_hi:"राजस्थान इतिहास"},
    {id:3, title:"Polity", title_hi:"राजव्यवस्था"},
  ]; }
  return topicsCache;
}

// Dynamic topic detection from current pool
export function getAvailableTopicsFromPool(pool) {
  const topics = topicsCache || [];
  const topicMap = new Map();
  // Ensure All
  topicMap.set(0, topics.find(t=>t.id===0) || {id:0, title:"All Topics", title_hi:"सभी टॉपिक्स"});

  // collect unique topic_ids
  const seenIds = new Set();
  pool.forEach(q => {
    const tid = Number(q.topic_id) || 0;
    if (seenIds.has(tid)) return;
    seenIds.add(tid);
    if (tid===0) return;
    const known = topics.find(t=>t.id===tid);
    if (known) {
      topicMap.set(tid, known);
    } else {
      // create dynamic topic from question's own topic string
      topicMap.set(tid, {
        id: tid,
        title: q.topic || `Topic ${tid}`,
        title_hi: q.topic || `टॉपिक ${tid}`,
        isDynamic: true
      });
    }
  });

  // also scan if question has topic but no id? fallback to topic name grouping
  // not required if ids present

  return Array.from(topicMap.values()).sort((a,b)=>a.id-b.id);
}

export function registerNewBank(meta, questions) {
  bankRegistry = [...(bankRegistry || []), meta];
  bankCache.set(meta.id, questions);
}
export function unregisterBank(bankId) {
  bankRegistry = (bankRegistry || []).filter(b=>b.id!==bankId);
  bankCache.delete(bankId);
}
export function invalidateBankCache(bankId) { bankCache.delete(bankId); }
