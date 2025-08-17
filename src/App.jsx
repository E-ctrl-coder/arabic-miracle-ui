import React, { useState, useEffect } from 'react';
import {
  loadQACData,
  loadQuranText,
  getVerseText as getVerseTextFromLoader,
  normalizeArabic as normalizeArabicFromLoader,
  stemArabic,
  findStemFamilyOccurrences,
  stripPrefixes
} from './loader/qacJsonLoader';
import buckwalterToArabic from './utils/buckwalterToArabic';
import normalizeArabic from './utils/normalizeArabic';
import './styles.css';

const posMap = {
  V: 'فعل',
  N: 'اسم',
  PN: 'اسم علم',
  ADJ: 'صفة',
  ADV: 'حال',
  PRON: 'ضمير',
  P: 'حرف جر',
  NUM: 'عدد',
  CONJ: 'حرف عطف',
  PART: 'حرف',
  DET: 'أداة تعريف',
  PREP: 'حرف جر',
  INTERJ: 'أداة تعجب',
};

function highlightStemOrRoot(text, entry) {
  if (!text || !entry) return text;
  const verseNorm = normalizeArabic(text);
  const stemNorm = normalizeArabic(buckwalterToArabic(entry?.segments?.stem || ''));
  const rootNorm = normalizeArabic(buckwalterToArabic(entry?.root || ''));
  if (!stemNorm && !rootNorm) return text;
  const parts = [];
  if (stemNorm) parts.push(stemNorm);
  if (rootNorm && rootNorm !== stemNorm) parts.push(rootNorm);
  const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    '(' + parts.map(escapeRegex).join('|') + ')' + '[\u064B-\u065F\u0670\u0640]*',
    'g'
  );
  return verseNorm.replace(
    pattern,
    (match) => `<span class="hl-stem">${match}</span>`
  );
}

// Coerce any loader payload into a flat array of records
function coerceQacArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const candidateKeys = [
    'data',
    'dataset',
    'entries',
    'tokens',
    'words',
    'qac',
    'items',
    'records'
  ];
  for (const k of candidateKeys) {
    if (Array.isArray(payload[k])) return payload[k];
  }
  return [];
}

// Known affixes for fuzzy match
const knownPrefixes = [
  'و', 'ف', 'ب', 'ك', 'ل', 'س',
  'ال', 'وال', 'فال', 'بال', 'كال', 'ولل', 'فلل'
];
const knownSuffixes = [
  'ه', 'ها', 'هم', 'هن', 'كما', 'كم', 'كن',
  'نا', 'ني', 'وا', 'ات', 'ون', 'ين', 'ان'
];

function onlyAffixes(word, match) {
  const remainder = word.replace(match, '');
  if (!remainder) return true;
  return knownPrefixes.includes(remainder) || knownSuffixes.includes(remainder);
}

export default function App() {
  const [qacData, setQacData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [openReference, setOpenReference] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function initialize() {
      try {
        const [data] = await Promise.all([loadQACData(), loadQuranText()]);
        const array = coerceQacArray(data);
        const normalized = array.map((e) => ({
          ...e,
          segments: e?.segments ?? {
            prefixes: [],
            stem: e?.stem ?? '',
            suffixes: []
          }
        }));
        setQacData(normalized);
        window.__QAC_LEN__ = normalized.length;
      } catch (err) {
        setError(`فشل تحميل البيانات: ${err?.message || String(err)}`);
      } finally {
        setLoading(false);
      }
    }
    initialize();
  }, []);

  const handleSearch = () => {
    const raw = searchTerm.trim();
    if (!raw || loading) {
      setResults([]);
      return;
    }
    const stripped = stripPrefixes(raw);
    const term = normalizeArabicFromLoader(stripped);
    if (!term) {
      setResults([]);
      return;
    }

    let matchedEntry =
      qacData.find((e) => {
        const form = e?.form ?? e?.word ?? '';
        return form && normalizeArabicFromLoader(form) === term;
      }) || null;

    if (!matchedEntry) {
      const inputStem = stemArabic(term);
      matchedEntry = qacData.find((e) => {
        const tokenStem = e?.segments?.stem ?? e?.stem ?? null;
        return tokenStem && tokenStem === inputStem;
      }) || null;
    }

    let occurrences = [];

    if (matchedEntry) {
      occurrences = findStemFamilyOccurrences(matchedEntry, qacData) || [];
      if (matchedEntry.tag === 'V' && matchedEntry.root) {
        const sameRootVerbs = qacData.filter(
          (e) => e.tag === 'V' && e.root === matchedEntry.root
        );
        occurrences = occurrences.concat(sameRootVerbs);
      }
    } else {
      const inputStem = stemArabic(term);
      const directMatches = qacData.filter((e) => {
        const formNorm = normalizeArabicFromLoader(e?.form ?? e?.word ?? '');
        const stemVal = e?.segments?.stem ?? e?.stem ?? '';
        return formNorm === term || stemVal === inputStem;
      });
      occurrences = directMatches;

     
