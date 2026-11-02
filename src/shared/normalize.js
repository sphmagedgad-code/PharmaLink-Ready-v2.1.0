/**
 * PharmaLink OS - Text & Medicine Normalization
 * Deterministic (not fuzzy/AI) normalization so different spellings
 * of the same medicine (Arabic/English/abbreviation/spacing/case)
 * resolve to one normalized name for search and matching, while the
 * original text captured from WhatsApp is always kept alongside it.
 */

const ARABIC_DIACRITICS_RE = /[\u064B-\u065F\u0670]/g;
const ALEF_VARIANTS_RE = /[إأآا]/g;
const TAA_MARBUTA_RE = /ة/g;
const YAA_VARIANTS_RE = /ى/g;
const NON_WORD_RE = /[^\p{L}\p{N}]+/gu;

/**
 * Lowercases, strips Arabic diacritics/letter variants, collapses
 * punctuation/whitespace into single spaces. Safe to run on Arabic,
 * English, or mixed text.
 */
export function normalizeText(text) {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .replace(ARABIC_DIACRITICS_RE, '')
    .replace(ALEF_VARIANTS_RE, 'ا')
    .replace(TAA_MARBUTA_RE, 'ه')
    .replace(YAA_VARIANTS_RE, 'ي')
    .replace(NON_WORD_RE, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}


/** Canonicalize a stated medicine strength without guessing missing units.
 * Arabic/English digits and common Arabic unit spellings become comparable.
 */
export function normalizeMedicineStrength(value) {
  if (value === null || value === undefined || value === '') return null;
  const digits = String(value).replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (d) => {
    const cp = d.codePointAt(0);
    return String(cp >= 0x06f0 ? cp - 0x06f0 : cp - 0x0660);
  });
  let normalized = digits.toLowerCase().replace(/,/g, '.').replace(/\s+/g, ' ').trim();
  normalized = normalized
    .replace(/ميليجرام|مليجرام|ملجم|مجم|ملغ|مغ|مج/g, 'mg')
    .replace(/ميكروجرام|ميكروغرام|مكجم|مكغ/g, 'mcg')
    .replace(/جرام|غرام|جم/g, 'g')
    .replace(/ملليلتر|ميليلتر|مل/g, 'ml')
    .replace(/وحده|وحدة/g, 'iu')
    .replace(/µg/g, 'mcg');
  normalized = normalized.replace(/\s*(mg|mcg|ml|iu|g)\s*/g, '$1');
  return normalized || null;
}

/**
 * Known high-confidence aliases: every array groups spelling variants
 * (Arabic + English + common abbreviations) of the SAME medicine.
 * The first entry in each group is the canonical slug. Extend this
 * list as more shortage/high-value drugs are confirmed - it is the
 * single source of truth for medicine merging.
 */
const ALIAS_GROUPS = [
  ['nexavar', 'nexavar', 'نيكسفار', 'نيكسافار'],
  ['prozac', 'prozac', 'prozack', 'بروزاك'],
  ['prograf', 'prograf', 'بروجراف', 'براغراف', 'براجراف'],
  ['mounjaro', 'مونجارو', 'مونجارو5', 'tirzepatide'],
  ['ozempic', 'أوزمبيك', 'اوزمبيك', 'أوزومبيك', 'اوزومبيك', 'semaglutide'],
  ['saxenda', 'ساكسندا'],
  ['wegovy', 'ويجوفي'],
  ['trulicity', 'ترولسيتي', 'دولاجلوتايد'],
  ['victoza', 'فيكتوزا'],
  ['meropenem', 'ميرونام', 'meronem'],
  ['xtandi', 'أكساتندي', 'اكساتندي', 'enzalutamide'],
  ['lynparza', 'ليمبارزا', 'olaparib'],
  ['mabthera', 'مابثيرا', 'rituximab'],
  ['keytruda', 'كيترودا', 'pembrolizumab'],
  ['enhertu', 'انهيرتو'],
  ['avastin', 'أفاستين', 'افاستين', 'bevacizumab'],
  ['tresiba', 'ترسيبا'],
  ['lantus', 'لانتوس'],
  ['toujeo', 'توجيو'],
  ['ryzodeg', 'ريزوديج'],
  ['humira', 'هيرميرا', 'humera'],
  ['remicade', 'رميكيد'],
  ['entresto', 'انتريستو'],
  ['forxiga', 'فورسيجا'],
  ['jardiance', 'جارديانس'],
  ['eliquis', 'إليكويس', 'اليكويس'],
  ['xarelto', 'كزاريلتو', 'زاريلتو'],
  ['dupixent', 'دوبيكسنت'],
  ['herceptin', 'هرسبتين'],
];

const ALIAS_LOOKUP = new Map();
for (const group of ALIAS_GROUPS) {
  const canonical = group[0];
  for (const variant of group) {
    ALIAS_LOOKUP.set(normalizeText(variant), canonical);
  }
}

/**
 * Returns the normalized name to store/search on for a raw medicine
 * name as typed/extracted. If the normalized text matches a known
 * alias, returns the shared canonical slug (merging spelling
 * variants). Otherwise returns the cleaned text itself, so search
 * still works even for medicines outside the known alias list.
 */
export function normalizeMedicineName(rawName) {
  const cleaned = normalizeText(rawName);
  return ALIAS_LOOKUP.get(cleaned) || cleaned;
}

/** Returns spelling aliases for the same explicitly curated brand/generic group. */
export function getMedicineAliases(rawName) {
  const cleaned = normalizeText(rawName);
  const group = ALIAS_GROUPS.find((items) => items.some((item) => normalizeText(item) === cleaned));
  return group ? Array.from(new Set(group)) : [rawName];
}

