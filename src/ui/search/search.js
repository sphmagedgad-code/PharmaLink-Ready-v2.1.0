/**
 * PharmaLink OS - Global Search Screen
 * The first-class search UI: one box searches Contacts, Medicines,
 * Deals, Parsed Entities, and WhatsApp Messages simultaneously via
 * searchIndexRepo (indexed lookups only, never a full-store scan).
 */

import * as searchIndexRepo from '../../db/repositories/searchIndexRepo.js';
import * as contactsRepo from '../../db/repositories/contactsRepo.js';
import * as medicinesRepo from '../../db/repositories/medicinesRepo.js';
import * as dealsRepo from '../../db/repositories/dealsRepo.js';
import * as parsedEntitiesRepo from '../../db/repositories/parsedEntitiesRepo.js';
import * as whatsappRepo from '../../db/repositories/whatsappRepo.js';
import { matchSellersForMedicine } from '../../orchestrators/matchSupplier.js';
import { SEARCH_ENTITY_TYPE } from '../../shared/constants.js';
import { normalizeMedicineStrength, normalizeMedicineName } from '../../shared/normalize.js';

const TYPE_FILTERS = [
  { value: 'all', label: 'الكل', types: null },
  { value: 'buy', label: 'طلبات شراء', types: [SEARCH_ENTITY_TYPE.PARSED_ENTITY], entityFilter: (e) => e.type === 'buy' },
  { value: 'sell', label: 'عروض بيع', types: [SEARCH_ENTITY_TYPE.PARSED_ENTITY], entityFilter: (e) => e.type === 'sell' },
  { value: 'urgent', label: 'عاجل', types: [SEARCH_ENTITY_TYPE.PARSED_ENTITY], entityFilter: (e) => e.isUrgent },
  { value: SEARCH_ENTITY_TYPE.CONTACT, label: 'جهات اتصال', types: [SEARCH_ENTITY_TYPE.CONTACT] },
  { value: SEARCH_ENTITY_TYPE.MEDICINE, label: 'أدوية', types: [SEARCH_ENTITY_TYPE.MEDICINE] },
  { value: SEARCH_ENTITY_TYPE.DEAL, label: 'صفقات', types: [SEARCH_ENTITY_TYPE.DEAL] },
  { value: SEARCH_ENTITY_TYPE.WHATSAPP_MESSAGE, label: 'رسائل', types: [SEARCH_ENTITY_TYPE.WHATSAPP_MESSAGE] },
];

let activeFilter = 'all';
let debounceTimer = null;

// Imported WhatsApp content is untrusted: escape dynamic values before HTML insertion.
function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
}

async function fetchEntity(entityType, entityId) {
  switch (entityType) {
    case SEARCH_ENTITY_TYPE.CONTACT: return contactsRepo.getContactById(entityId);
    case SEARCH_ENTITY_TYPE.MEDICINE: return medicinesRepo.getMedicineById(entityId);
    case SEARCH_ENTITY_TYPE.DEAL: return dealsRepo.getDealById(entityId);
    case SEARCH_ENTITY_TYPE.PARSED_ENTITY: return parsedEntitiesRepo.getEntityById(entityId);
    case SEARCH_ENTITY_TYPE.WHATSAPP_MESSAGE: return whatsappRepo.getMessageById(entityId);
    default: return null;
  }
}

function renderContact(contact) {
  const badges = [contact.isBuyer ? '<span class="badge badge--buy">مشتري</span>' : '', contact.isSeller ? '<span class="badge badge--sell">بائع</span>' : ''].join(' ');
  const card = document.createElement('div');
  card.className = 'entity-card';
  card.innerHTML = `
    <div class="entity-card__header"><span class="entity-card__title">${escapeHTML(contact.name)}</span>${badges}</div>
    <div class="entity-card__section">
      <div class="entity-row" data-tel="${escapeHTML(contact.whatsapp)}"><span class="entity-row__title">${escapeHTML(contact.whatsapp)}</span><span class="entity-row__icon">📞</span></div>
    </div>
  `;
  return card;
}

function renderMedicine(medicine) {
  const card = document.createElement('div');
  card.className = 'entity-card';
  card.innerHTML = `
    <div class="entity-card__header"><span class="entity-card__title">${escapeHTML(medicine.name)}</span><span class="badge badge--deal">${escapeHTML(medicine.category)}</span></div>
  `;
  return card;
}

function renderDeal(deal) {
  const card = document.createElement('div');
  card.className = 'entity-card';
  card.innerHTML = `
    <div class="entity-card__header"><span class="entity-card__title">صفقة</span><span class="badge badge--deal">${escapeHTML(deal.status)}</span></div>
    <div class="price-row"><div class="price-row__main">${escapeHTML(deal.price)} ج × ${escapeHTML(deal.quantity)}</div></div>
  `;
  return card;
}

function renderWhatsappMessage(message) {
  const card = document.createElement('div');
  card.className = 'entity-card';
  card.innerHTML = `
    <div class="entity-card__header"><span class="entity-card__title">${escapeHTML(message.groupId)}</span><span class="badge badge--deal">${escapeHTML(message.status)}</span></div>
    <div class="entity-card__section">
      <div class="entity-card__section-label">${escapeHTML(message.senderName || 'اسم المرسل غير متاح')} · ${new Date(message.receivedAt).toLocaleString('ar-EG')}</div>
      ${message.phone ? `<div class="entity-row"><span class="entity-row__title" dir="ltr">${escapeHTML(message.phone)}</span><button class="btn-call" type="button" data-tel="${escapeHTML(message.phone)}" aria-label="اتصال">📞</button></div>` : '<div class="entity-row"><span class="entity-row__title">رقم الهاتف غير موجود في ملف التصدير</span></div>'}
      <p style="font-size:0.82rem; color:#444;">${escapeHTML(message.text)}</p>
    </div>
  `;
  return card;
}

async function renderParsedEntity(entity) {
  const card = document.createElement('div');
  card.className = 'entity-card';
  const typeBadge = entity.type === 'buy' ? '<span class="badge badge--buy">طلب شراء</span>' : '<span class="badge badge--sell">عرض بيع</span>';
  let urgentStrip = '';
  if (entity.isUrgent) {
    urgentStrip = '<div class="entity-card__urgent-strip">🔥 طلب عاجل</div>';
  }

  let missingSellerNotice = '';
  if (entity.type === 'buy') {
    const sellers = await matchSellersForMedicine(entity.medicineId, entity.strength || null);
    if (sellers.length === 0) {
      missingSellerNotice = `<div class="entity-card__empty-notice">🎯 لا يوجد بائع مسجل لهذا الصنف حاليًا - فرصة لعرضه على مورد جديد</div>`;
    }
  }

  card.innerHTML = `
    ${urgentStrip}
    ${entity.needsReview ? '<div class="entity-card__empty-notice">⚠️ اسم الدواء يحتاج مراجعة قبل اعتماد المطابقة</div>' : ''}
    <div class="entity-card__header"><span class="entity-card__title">${escapeHTML(entity.rawMedicineText)}${entity.strength ? ` ${escapeHTML(entity.strength)}` : ''}</span>${typeBadge}</div>
    <div class="entity-card__section">
      ${missingSellerNotice}
      <div class="entity-row" ${entity.phone ? `data-tel="${escapeHTML(entity.phone)}"` : ''}>
        <span class="entity-row__title">${entity.phone ? escapeHTML(entity.phone) : escapeHTML(entity.senderName || 'رقم الهاتف غير متاح في التصدير')}</span>
        <span class="entity-row__info">
          ${entity.price ? `<span class="entity-row__price">${escapeHTML(entity.price)} ج</span>` : ''}
          ${entity.quantity ? `<span class="entity-row__meta">${escapeHTML(entity.quantity)} علبة</span>` : ''}
        </span>
        <span class="entity-row__icon">📞</span>
      </div>
    </div>
    <div class="entity-card__action">
      ${entity.phone ? `<button class="btn-call" type="button" data-tel="${escapeHTML(entity.phone)}" aria-label="اتصال" title="اتصال">📞</button>
      <button class="btn-whatsapp" type="button" data-wa="${escapeHTML(entity.phone)}" aria-label="واتساب" title="واتساب"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12.04 2a9.8 9.8 0 0 0-8.42 14.82L2.3 22l5.34-1.4A9.9 9.9 0 1 0 12.04 2Zm0 17.98a8.1 8.1 0 0 1-4.13-1.13l-.3-.18-3.17.83.85-3.08-.2-.32a8.1 8.1 0 1 1 6.95 3.88Zm4.45-6.07c-.24-.12-1.42-.7-1.64-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.94-1.2-.72-.64-1.2-1.43-1.34-1.67-.14-.24-.02-.37.1-.49.1-.1.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.46-.4-.4-.54-.41h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.7 2.6 4.12 3.64.58.25 1.03.4 1.38.51.58.18 1.1.15 1.51.09.46-.07 1.42-.58 1.62-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z"/></svg></button>` : '<span class="entity-card__action-tip">لا يوجد رقم في الملف الأصلي</span>'}
      <span class="entity-card__action-tip">${new Date(entity.receivedAt).toLocaleDateString('ar-EG')}</span>
    </div>
  `;
  return card;
}

async function renderResult(entityType, entity) {
  switch (entityType) {
    case SEARCH_ENTITY_TYPE.CONTACT: return renderContact(entity);
    case SEARCH_ENTITY_TYPE.MEDICINE: return renderMedicine(entity);
    case SEARCH_ENTITY_TYPE.DEAL: return renderDeal(entity);
    case SEARCH_ENTITY_TYPE.WHATSAPP_MESSAGE: return renderWhatsappMessage(entity);
    case SEARCH_ENTITY_TYPE.PARSED_ENTITY: return renderParsedEntity(entity);
    default: return null;
  }
}

async function runSearch(mountEl, query) {
  const resultsEl = mountEl.querySelector('#search-results');
  const metaEl = mountEl.querySelector('#search-meta');

  if (!query || query.trim().length < 2) {
    resultsEl.innerHTML = `<div class="empty-state"><div class="empty-state__icon">🔎</div><p>اكتب حرفين على الأقل للبحث في كل بيانات النظام</p></div>`;
    metaEl.textContent = '';
    return;
  }

  const activeFilterDef = TYPE_FILTERS.find((f) => f.value === activeFilter);
  const rawResults = await searchIndexRepo.search(query, activeFilterDef.types);

  // Opportunity tabs must not depend solely on the capped global token
  // search. Resolve the medicine identity first, then read its indexed
  // by_medicineId records directly so older/low-ranked buy/sell entries
  // cannot disappear behind unrelated message or medicine hits.
  let directParsedEntities = [];
  if (['buy', 'sell', 'urgent'].includes(activeFilter)) {
    const queryParts = query.trim().split(/\s+/).filter(Boolean);
    // Resolve the longest exact medicine-name prefix first. This supports
    // multi-word brands and queries such as "Nexavar 200 mg" without scanning
    // the medicines store or anchoring every lookup to the first word.
    let medicine = null;
    let medicineWordCount = queryParts.length;
    for (let count = queryParts.length; count >= 1 && !medicine; count -= 1) {
      const candidateName = queryParts.slice(0, count).join(' ');
      medicine = await medicinesRepo.getMedicineByNormalizedName(normalizeMedicineName(candidateName));
      if (medicine) medicineWordCount = count;
    }
    if (medicine) {
      const strengthText = queryParts.slice(medicineWordCount).join(' ');
      const requestedStrength = /\d/.test(strengthText) ? normalizeMedicineStrength(strengthText) : null;
      directParsedEntities = await parsedEntitiesRepo.getEntitiesByMedicine(medicine.id);
      directParsedEntities = directParsedEntities.filter((entity) => {
        if (activeFilter === 'buy' && entity.type !== 'buy') return false;
        if (activeFilter === 'sell' && entity.type !== 'sell') return false;
        if (activeFilter === 'urgent' && !entity.isUrgent) return false;
        // A known conflicting strength is never returned as an exact match.
        // Unknown strength remains visible but is not silently represented as verified.
        if (requestedStrength && entity.strength && normalizeMedicineStrength(entity.strength) !== requestedStrength) return false;
        return true;
      });
    }
  }

  const resultMap = new Map(rawResults.map((r) => [`${r.entityType}:${r.entityId}`, r]));
  for (const entity of directParsedEntities) {
    resultMap.set(`${SEARCH_ENTITY_TYPE.PARSED_ENTITY}:${entity.id}`, { entityType: SEARCH_ENTITY_TYPE.PARSED_ENTITY, entityId: entity.id });
  }
  const entities = await Promise.all(
    Array.from(resultMap.values()).map(async (r) => ({ entityType: r.entityType, entity: await fetchEntity(r.entityType, r.entityId) }))
  );

  let filtered = entities.filter((r) => r.entity);
  if (activeFilterDef.entityFilter) {
    filtered = filtered.filter((r) => activeFilterDef.entityFilter(r.entity));
  }

  // A contact may send several messages requesting/offering the same
  // medicine; show their phone once per context (buy/sell) rather
  // than once per message.
  const seenPhoneContext = new Set();
  filtered = filtered.filter((r) => {
    if (r.entityType !== SEARCH_ENTITY_TYPE.PARSED_ENTITY) return true;
    const key = `${r.entity.phone || r.entity.senderName || r.entity.sourceMessageId}|${r.entity.type}|${r.entity.medicineId || ''}|${normalizeMedicineStrength(r.entity.strength) || 'unspecified'}`;
    if (seenPhoneContext.has(key)) return false;
    seenPhoneContext.add(key);
    return true;
  });

  // Within parsed WhatsApp opportunities, rank explicit lower prices first,
  // then the newest source message. Missing prices never outrank confirmed prices.
  filtered.sort((a, b) => {
    if (a.entityType !== SEARCH_ENTITY_TYPE.PARSED_ENTITY || b.entityType !== SEARCH_ENTITY_TYPE.PARSED_ENTITY) return 0;
    const ap = Number.isFinite(a.entity.price) && a.entity.price > 0 ? a.entity.price : null;
    const bp = Number.isFinite(b.entity.price) && b.entity.price > 0 ? b.entity.price : null;
    if (ap != null && bp == null) return -1;
    if (ap == null && bp != null) return 1;
    if (ap != null && bp != null && ap !== bp) return ap - bp;
    return new Date(b.entity.receivedAt || 0).getTime() - new Date(a.entity.receivedAt || 0).getTime();
  });

  metaEl.textContent = `${filtered.length} نتيجة`;
  resultsEl.innerHTML = '';

  if (filtered.length === 0) {
    resultsEl.innerHTML = `<div class="empty-state"><div class="empty-state__icon">🤷</div><p>لا توجد نتائج مطابقة</p></div>`;
    return;
  }

  for (const { entityType, entity } of filtered) {
    const card = await renderResult(entityType, entity);
    if (card) resultsEl.appendChild(card);
  }
}

export async function render(mountEl) {
  mountEl.innerHTML = `
    <div class="search-wrap" style="background:none; border:none; padding:10px 0;">
      <div class="search-box">
        <input id="global-search-input" type="text" placeholder="ابحث في كل شيء: دواء، اسم، هاتف، محافظة..." />
        <button id="global-search-clear" class="btn-clear">✕</button>
      </div>
    </div>
    <div id="search-pills" class="pills" style="padding:0 0 9px;"></div>
    <div class="results-meta"><span id="search-meta"></span></div>
    <div id="search-results"></div>
  `;

  const pillsEl = mountEl.querySelector('#search-pills');
  TYPE_FILTERS.forEach(({ value, label }) => {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'pill' + (value === activeFilter ? ' on' : '');
    pill.textContent = label;
    pill.addEventListener('click', () => {
      activeFilter = value;
      pillsEl.querySelectorAll('.pill').forEach((p) => p.classList.remove('on'));
      pill.classList.add('on');
      runSearch(mountEl, mountEl.querySelector('#global-search-input').value);
    });
    pillsEl.appendChild(pill);
  });

  const input = mountEl.querySelector('#global-search-input');
  const clearBtn = mountEl.querySelector('#global-search-clear');

  input.addEventListener('input', () => {
    clearBtn.classList.toggle('on', input.value.length > 0);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => runSearch(mountEl, input.value), 180);
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    clearBtn.classList.remove('on');
    runSearch(mountEl, '');
  });

  mountEl.querySelector('#search-results').addEventListener('click', (e) => {
    const whatsappTarget = e.target.closest('[data-wa]');
    if (whatsappTarget) {
      let digits = String(whatsappTarget.dataset.wa || '').replace(/\D/g, '');
      // wa.me requires international format; convert Egyptian local 01xxxxxxxxx to 201xxxxxxxxx.
      if (/^01\d{9}$/.test(digits)) digits = `2${digits}`;
      if (digits) window.open(`https://wa.me/${digits}`, '_blank', 'noopener');
      return;
    }
    const callTarget = e.target.closest('[data-tel]');
    if (callTarget) window.location.href = `tel:${callTarget.dataset.tel}`;
  });

  runSearch(mountEl, '');
}
