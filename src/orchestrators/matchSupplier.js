/**
 * PharmaLink OS - Evidence-based seller matching.
 * Uses imported WhatsApp SELL entities first, then the contact's last
 * explicitly quoted price as a fallback. Price estimates are never
 * returned as confirmed offers. IndexedDB's by_medicineId index bounds
 * the work to the requested medicine rather than scanning 400k messages.
 */
import { getSellers } from '../db/repositories/contactsRepo.js';
import { getEntitiesByMedicine } from '../db/repositories/parsedEntitiesRepo.js';
import { PARSED_ENTITY_TYPE } from '../shared/constants.js';
import { normalizeMedicineStrength } from '../shared/normalize.js';

function timeValue(value) {
  const n = Date.parse(value || '');
  return Number.isFinite(n) ? n : 0;
}

function sameStrength(a, b) {
  const left = normalizeMedicineStrength(a);
  const right = normalizeMedicineStrength(b);
  return left !== null && right !== null && left === right;
}

function isBetterOffer(candidate, current) {
  // Keep the best explicit current offer per seller: a lower known price
  // wins; when prices are equal (or both absent), newer evidence wins.
  if (candidate.price != null && current.price == null) return true;
  if (candidate.price == null && current.price != null) return false;
  if (candidate.price != null && current.price != null && candidate.price !== current.price) return candidate.price < current.price;
  return timeValue(candidate.date) > timeValue(current.date);
}

function median(values) {
  const sorted = values.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export async function matchSellersForMedicine(medicineId, requiredStrength = null, knownSellers = null) {
  if (!medicineId) return [];
  const [sellers, medicineEntities] = await Promise.all([
    knownSellers || getSellers(),
    getEntitiesByMedicine(medicineId),
  ]);
  const sellerById = new Map(sellers.map((seller) => [seller.id, seller]));
  const offersBySeller = new Map();
  const allHistoricalPrices = [];

  for (const entity of medicineEntities) {
    if (entity.type !== PARSED_ENTITY_TYPE.SELL) continue;
    // A known conflicting strength is excluded. An unknown seller strength
    // remains eligible as a possible match, but is still reported as unknown.
    if (requiredStrength && entity.strength && !sameStrength(entity.strength, requiredStrength)) continue;
    if (Number.isFinite(entity.price) && entity.price > 0) allHistoricalPrices.push(entity.price);
    const contact = sellerById.get(entity.contactId);
    if (!contact) continue;
    const candidate = {
      contact,
      price: Number.isFinite(entity.price) && entity.price > 0 ? entity.price : null,
      date: entity.receivedAt || '',
      quantity: entity.quantity || null,
      phone: entity.phone || contact.whatsapp,
      isUrgent: Boolean(entity.isUrgent),
      source: 'whatsapp_offer',
      rawText: entity.rawMedicineText || '',
      sourceMessageId: entity.sourceMessageId || null,
      strength: entity.strength || null,
    };
    const previous = offersBySeller.get(contact.id);
    if (!previous || isBetterOffer(candidate, previous)) offersBySeller.set(contact.id, candidate);
  }

  // Fall back to the most recently saved explicit price only when there
  // is no imported offer record for this seller. Never overwrite an offer
  // message without a price with an older price and pretend it is current.
  for (const seller of sellers) {
    if (offersBySeller.has(seller.id)) continue;
    const entry = seller.lastPrices && seller.lastPrices[medicineId];
    if (!entry || !Number.isFinite(entry.price) || entry.price <= 0) continue;
    offersBySeller.set(seller.id, {
      contact: seller,
      price: entry.price,
      date: entry.date || '',
      quantity: null,
      phone: seller.whatsapp,
      isUrgent: false,
      source: 'saved_quote',
      rawText: '',
    });
  }

  const historicalMedian = median(allHistoricalPrices);
  const matches = Array.from(offersBySeller.values()).map((offer) => ({
    ...offer,
    historicalMedian,
    estimatedPrice: offer.price == null ? historicalMedian : null,
    priceIsEstimated: offer.price == null && historicalMedian != null,
    // Indicative brokerage value only; it is not a confirmed profit.
    potentialBrokerageAt7Percent: offer.price != null ? Math.round(offer.price * 0.07 * 100) / 100 : null,
  }));

  matches.sort((a, b) => {
    // Explicit price always ranks ahead of no-price offers; among priced
    // offers, lower price wins, then newer evidence, then urgent status.
    if (a.price != null && b.price == null) return -1;
    if (a.price == null && b.price != null) return 1;
    if (a.price != null && b.price != null && a.price !== b.price) return a.price - b.price;
    const timeDiff = timeValue(b.date) - timeValue(a.date);
    if (timeDiff) return timeDiff;
    return Number(b.isUrgent) - Number(a.isUrgent);
  });
  return matches;
}
