/**
 * PharmaLink OS - WhatsApp Import Orchestrator
 * Coordinates multi-file import: reads raw text, reconstructs logical
 * multi-line messages (a WhatsApp header line plus any continuation
 * lines that follow it - real exports very often carry the BUY/SELL
 * signal on the header line while the actual medicine/price/quantity
 * details are on the continuation lines that follow), classifies
 * each logical message, deduplicates against both the existing
 * database and the rest of the current batch, then writes raw
 * messages, parsed entities, medicines, and contacts through their
 * repositories (which keep searchIndex synchronized on every write).
 */

import { classifyMessage, normalizeDigits, extractPhones } from './classifyWhatsAppMessage.js';
import { generateId } from '../db/schema.js';
import { MEDICINE_CATEGORY } from '../shared/constants.js';
import * as whatsappRepo from '../db/repositories/whatsappRepo.js';
import * as parsedEntitiesRepo from '../db/repositories/parsedEntitiesRepo.js';
import * as medicinesRepo from '../db/repositories/medicinesRepo.js';
import * as contactsRepo from '../db/repositories/contactsRepo.js';
import { normalizeMedicineName } from '../shared/normalize.js';

const MAX_PHONES_PER_MESSAGE = 5;

// Strips Unicode bidi/directional control characters (RLM, LRM, LRE,
// PDF, isolates, BOM) that real WhatsApp exports embed liberally
// around dates, phone numbers, and names. Left in place, these break
// exact-position regex matching (e.g. a header's date/time pattern
// straddling an invisible mark never matches).
const BIDI_STRIP_RE = /[\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g;

// Header line: "D/M/Y, H:MM [AM/PM marker] - sender or event...".
// Digits are matched as \d because normalizeDigits() is applied to
// the whole file text before this regex ever runs (Arabic-Indic and
// Extended Arabic-Indic dates are just as common as Arabic-Indic
// phone numbers in real exports). Both Arabic ("،") and Western (",")
// commas are accepted, and both Arabic (ص/م) and English (AM/PM)
// meridiem markers.
const HEADER_LINE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})[،,]\s*(\d{1,2}):(\d{2})\s*(ص|م|AM|PM|am|pm)?\s*-\s*(.*)$/;

/**
 * Safely converts a candidate Date to an ISO 8601 string. This is the
 * ONE normalized timestamp representation used for persistence -
 * never throws. Returns null if the Date is invalid (NaN internal
 * time) or - defensively - if toISOString() itself somehow throws
 * (e.g. a value outside the representable date range), so callers
 * always have a safe fallback path instead of ever passing an
 * invalid value into IndexedDB.
 */
function toSafeIso(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  try {
    return date.toISOString();
  } catch (err) {
    return null;
  }
}

function fallbackTimestamp(fallbackBaseMs, lineIndex) {
  return toSafeIso(new Date(fallbackBaseMs + lineIndex)) || new Date(Date.now() + lineIndex).toISOString();
}

/** Applies AM/PM (or ص/م) correction to a 24-hour-assumed hour value. */
function applyMeridiem(hour, marker) {
  if (!marker) return hour;
  const isPm = marker === 'م' || marker.toLowerCase() === 'pm';
  const isAm = marker === 'ص' || marker.toLowerCase() === 'am';
  if (isPm && hour < 12) return hour + 12;
  if (isAm && hour === 12) return 0;
  return hour;
}

/**
 * Splits one raw file's normalized text into logical messages: each
 * one starts at a header line and absorbs every following line up to
 * (not including) the next header line. This is what lets a header's
 * "موجود" (available/SELL signal) combine with its continuation
 * lines' drug/price/quantity details into one classifiable text.
 */
function reconstructLogicalMessages(fileText, groupId, fallbackBaseMs) {
  const lines = fileText.split(/\r?\n/);
  const messages = [];
  let current = null;
  let lineIndex = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const headerMatch = line.match(HEADER_LINE_RE);

    if (headerMatch) {
      if (current) messages.push(current);
      const [, day, month, yearRaw, hour, minute, meridiem, rest] = headerMatch;
      const year = yearRaw.length === 2 ? Number(`20${yearRaw}`) : Number(yearRaw);
      const correctedHour = applyMeridiem(Number(hour), meridiem);
      const receivedAt =
        toSafeIso(new Date(year, Number(month) - 1, Number(day), correctedHour, Number(minute))) ||
        fallbackTimestamp(fallbackBaseMs, lineIndex);

      const separatorIndex = rest.indexOf(': ');
      const senderSegment = separatorIndex === -1 ? rest.trim() : rest.slice(0, separatorIndex).trim();
      const firstLineText = separatorIndex === -1 ? '' : rest.slice(separatorIndex + 2).trim();

      current = {
        groupId,
        receivedAt,
        senderSegment,
        bodyLines: firstLineText ? [firstLineText] : [],
      };
    } else if (current && line) {
      current.bodyLines.push(line);
    }
    // Lines before any header has appeared yet, or blank lines, are dropped.
    lineIndex += 1;
  }
  if (current) messages.push(current);
  return messages;
}

/**
 * @param {{ name: string, text: string }[]} files
 * @param {(progress: { phase: string, current: number, total: number }) => void} [onProgress]
 * @returns {Promise<{ totalLines: number, imported: number, duplicates: number, ignored: number, urgentCount: number, messages: object[] }>}
 */
export async function importWhatsAppFiles(files, onProgress) {
  const startedAt = Date.now();
  const baseMs = startedAt;
  const groupIds = files.map((f) => f.name);
  const existingKeys = await whatsappRepo.getExistingDedupeKeys(groupIds);
  const seenInBatch = new Set();

  const messagesToInsert = [];
  const entityDrafts = []; // { message, classification, drug, phone } - when a phone is available
  const medicineOnlyDrugs = new Set(); // drug names to persist even when no phone is available
  let totalLines = 0;
  let duplicates = 0;
  let ignored = 0;
  let urgentCount = 0;

  const allLogicalMessages = [];
  files.forEach((file, fileIndex) => {
    const normalizedText = normalizeDigits(file.text.replace(BIDI_STRIP_RE, ''));
    const logicalMessages = reconstructLogicalMessages(normalizedText, file.name, baseMs + fileIndex * 1000000);
    totalLines += logicalMessages.length;
    allLogicalMessages.push(...logicalMessages);
  });

  const yieldToUI = () => new Promise((resolve) => setTimeout(resolve, 0));
  if (onProgress) onProgress({ phase: 'classifying', current: 0, total: totalLines, percent: 5 });
  for (let messageIndex = 0; messageIndex < allLogicalMessages.length; messageIndex += 1) {
    const logicalMessage = allLogicalMessages[messageIndex];
    const combinedText = logicalMessage.bodyLines.join('\n');
    const classification = classifyMessage(combinedText, logicalMessage.groupId, logicalMessage.receivedAt);

    if (!classification) {
      ignored += 1;
    } else {
      const dedupeKey = `${logicalMessage.groupId}|${classification.receivedAt}|${classification.text}`;
      if (existingKeys.has(dedupeKey) || seenInBatch.has(dedupeKey)) {
        duplicates += 1;
      } else {
        seenInBatch.add(dedupeKey);
        if (classification.isUrgent) urgentCount += 1;

        const message = {
          id: generateId(), groupId: logicalMessage.groupId, text: classification.text,
          receivedAt: classification.receivedAt, status: classification.status,
          senderName: logicalMessage.senderSegment || null,
        };
        messagesToInsert.push(message);
        const headerPhones = extractPhones(logicalMessage.senderSegment.replace(/\s+/g, ''));
        const phones = Array.from(new Set([...headerPhones, ...classification.phones])).slice(0, MAX_PHONES_PER_MESSAGE);
        message.phone = phones[0] || null;

        const mentions = Array.isArray(classification.drugMentions) && classification.drugMentions.length
          ? classification.drugMentions
          : classification.drugs.map((drug) => ({ drug, type: classification.drugTypes?.[drug] || classification.type }));
        for (const mention of mentions) {
          const drug = mention.drug;
          const drugType = mention.type || classification.drugTypes?.[drug] || classification.type;
          const drugClassification = drugType === classification.type ? classification : {
            ...classification, type: drugType,
            status: drugType === 'sell' ? 'offer' : 'request',
          };
          // A mixed post can contain both sides for the same item. Treat its
          // price/quantity as untrusted unless this is the sole extracted mention.
          drugClassification.isSingle = mentions.length === 1;
          if (phones.length === 0) entityDrafts.push({ message, classification: drugClassification, drug, phone: null });
          else for (const phone of phones) entityDrafts.push({ message, classification: drugClassification, drug, phone });
        }
      }
    }

    if (onProgress && (messageIndex % 20 === 0 || messageIndex === allLogicalMessages.length - 1)) {
      onProgress({ phase: 'classifying', current: messageIndex + 1, total: totalLines, percent: 5 + Math.round(((messageIndex + 1) / Math.max(totalLines, 1)) * 30) });
      await yieldToUI();
    }
  }

  // Resolve all medicine/contact references in memory. The previous
  // implementation awaited multiple IndexedDB transactions PER mention
  // (medicine lookup/create + contact lookup/update + last-price update),
  // making large TXT imports needlessly slow. This path performs one
  // initial read per store, then chunked bulk writes and bulk indexing.
  if (onProgress) onProgress({ phase: 'preparing', current: 0, total: 2, percent: 35 });
  const [existingMedicines, existingContacts] = await Promise.all([
    medicinesRepo.getAllMedicines(), contactsRepo.getAllContacts(),
  ]);
  if (onProgress) onProgress({ phase: 'preparing', current: 2, total: 2, percent: 38 });
  const medicineByKey = new Map(existingMedicines.map((item) => [normalizeMedicineName(item.name), item]));
  const contactByPhone = new Map(existingContacts.map((item) => [item.whatsapp, item]));
  const newMedicines = [];
  const changedContacts = new Map();
  const newContactIds = [];
  const preparedEntities = [];

  function resolveMedicine(drug) {
    const key = normalizeMedicineName(drug);
    let medicine = medicineByKey.get(key);
    if (!medicine) {
      medicine = { id: generateId(), name: drug, normalizedName: key, category: MEDICINE_CATEGORY.GENERAL, unit: null, createdAt: new Date().toISOString() };
      medicineByKey.set(key, medicine);
      newMedicines.push(medicine);
    }
    return medicine;
  }

  // Persist medicines mentioned even when no sender phone is available.
  for (const drug of medicineOnlyDrugs) resolveMedicine(drug);

  for (let i = 0; i < entityDrafts.length; i += 1) {
    const { message, classification, drug, phone } = entityDrafts[i];
    const medicine = resolveMedicine(drug);
    const normalizedMedicineName = normalizeMedicineName(drug);
    let contact = null;

    if (phone) {
      contact = contactByPhone.get(phone) || null;
      const roleBuyer = classification.type === 'buy';
      const roleSeller = classification.type === 'sell';
      if (!contact) {
        contact = {
          id: generateId(), name: phone, whatsapp: phone,
          isBuyer: roleBuyer, isSeller: roleSeller,
          governorate: null, notes: null, lastPrices: {}, createdAt: new Date().toISOString(),
        };
        contactByPhone.set(phone, contact);
        newContactIds.push(contact.id);
      } else {
        contact = { ...contact, isBuyer: contact.isBuyer || roleBuyer, isSeller: contact.isSeller || roleSeller };
        contactByPhone.set(phone, contact);
      }
      changedContacts.set(contact.id, contact);
    }

    const trustedPrice = classification.isSingle ? classification.price : null;
    const trustedQuantity = classification.isSingle ? classification.quantity : null;
    if (classification.type === 'sell' && trustedPrice && contact) {
      const previous = contact.lastPrices?.[medicine.id];
      if (!previous || String(classification.receivedAt) >= String(previous.date || '')) {
        contact = { ...contact, lastPrices: { ...(contact.lastPrices || {}), [medicine.id]: { price: trustedPrice, date: classification.receivedAt } } };
        contactByPhone.set(phone, contact);
        changedContacts.set(contact.id, contact);
      }
    }

    preparedEntities.push({
      id: generateId(), sourceMessageId: message.id, groupId: message.groupId,
      receivedAt: message.receivedAt, type: classification.type,
      medicineId: medicine.id, normalizedMedicineName, rawMedicineText: drug,
      strength: classification.strengths?.[drug] || null,
      medicineEvidence: classification.medicineEvidence?.[drug] || 'unverified',
      needsReview: (classification.medicineEvidence?.[drug] || 'unverified') !== 'dictionary',
      sourceText: classification.text, contactId: contact?.id || null,
      phone: phone || null, senderName: message.senderName || null,
      price: trustedPrice, quantity: trustedQuantity, isUrgent: classification.isUrgent,
    });

    if (onProgress && (i % 250 === 0 || i === entityDrafts.length - 1)) {
      onProgress({ phase: 'linking', current: i + 1, total: entityDrafts.length, percent: 38 + Math.round(((i + 1) / Math.max(entityDrafts.length, 1)) * 27) });
      await yieldToUI();
    }
  }

  // Bulk persist reference data before parsed entities that point to it.
  if (onProgress) onProgress({ phase: 'linking', current: entityDrafts.length, total: entityDrafts.length, percent: 65 });
  if (newMedicines.length) await medicinesRepo.addMedicinesBulk(newMedicines);
  if (changedContacts.size) await contactsRepo.saveContactsBulk(Array.from(changedContacts.values()), newContactIds);

  if (onProgress) onProgress({ phase: 'saving', current: 0, total: messagesToInsert.length + preparedEntities.length, percent: 65 });
  await whatsappRepo.addMessagesBulk(messagesToInsert, (current, total) => {
    if (onProgress) onProgress({ phase: 'saving', current, total: messagesToInsert.length + preparedEntities.length, percent: 65 + Math.round((current / Math.max(messagesToInsert.length + preparedEntities.length, 1)) * 35) });
  });

  if (preparedEntities.length > 0) {
    await parsedEntitiesRepo.addEntitiesBulk(preparedEntities, (current, total) => {
      if (onProgress) onProgress({ phase: 'saving', current: messagesToInsert.length + current, total: messagesToInsert.length + total, percent: 65 + Math.round(((messagesToInsert.length + current) / Math.max(messagesToInsert.length + total, 1)) * 35) });
    });
  }
  if (onProgress) onProgress({ phase: 'complete', current: 1, total: 1, percent: 100 });

  return {
    totalLines,
    imported: messagesToInsert.length,
    duplicates,
    ignored,
    urgentCount,
    entitiesCreated: preparedEntities.length,
    elapsedMs: Date.now() - startedAt,
    messages: messagesToInsert,
  };
}
