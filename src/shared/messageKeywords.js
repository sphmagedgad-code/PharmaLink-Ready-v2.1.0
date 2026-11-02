/**
 * PharmaLink OS - Message Keywords
 * Arabic keyword lists and extraction regexes used to classify raw
 * WhatsApp export lines into buy/sell/urgent signals. Ported directly
 * from the approved reference implementation (PharmaLink.html) - this
 * is real business/domain data, not visual styling, and is reused
 * verbatim rather than re-invented.
 */

export const BUY_KEYWORDS = [
  'محتاج', 'مطلوب', 'طلوب', 'نريد', 'عايز', 'ابحث', 'نشتري', 'عاوز',
  'نطلب', 'محتاجين', 'عايزين', 'عاوزين', 'محتاجه', 'محتاج', 'هل يوجد', 'فين', 'عايز اشتري', 'عاوز اشتري', 'مطلوب شراء', 'wanted', 'want', 'need', 'needed', 'looking for', 'required', 'request', 'buy', 'buying',
];

export const SELL_KEYWORDS = [
  'متوفر', 'عندي', 'عندنا', 'يوجد', 'للبيع', 'كمية', 'معنا',
  'عرض', 'موجود معي', 'موجود لدينا', 'متاح لدينا', 'متاح عندي', 'نبيع', 'لدينا', 'متوفر لدينا', 'available', 'in stock', 'for sale', 'selling', 'offer', 'offering',
];

export const URGENT_KEYWORDS = [
  'فوري', 'عاجل', 'اليوم', 'الآن', 'الان', 'تنفيذ', 'سريع', 'ضروري', 'فورا', 'فورًا',
];

export const KNOWN_DRUGS = [
  'نيكسفار', 'nexavar', 'مونجارو', 'أوزمبيك', 'اوزمبيك', 'أوزومبيك', 'اوزومبيك', 'ساكسندا', 'ويجوفي',
  'ترولسيتي', 'فيكتوزا', 'ميرونام', 'meronem', 'meropenem', 'أنتيفيو',
  'سوماتروبين', 'نورديتروبين', 'هيرموز', 'أكساتندي', 'xtandi', 'ليمبارزا',
  'lynparza', 'مابثيرا', 'mabthera', 'كيترودا', 'keytruda', 'انهيرتو', 'enhertu',
  'أفاستين', 'avastin', 'ترسيبا', 'tresiba', 'ريزوديج', 'ryzodeg', 'لانتوس',
  'lantus', 'توجيو', 'toujeo', 'مكستارد', 'mixtard', 'أكتراف', 'actrapid',
  'نوفومكس', 'novomix', 'ليفيمير', 'levemir', 'انتريستو', 'entresto', 'فورسيجا',
  'forxiga', 'إليكويس', 'eliquis', 'كزاريلتو', 'xarelto', 'بلافيكس', 'plavix',
  'نيورال', 'neoral', 'سيكلوسبورين', 'ريكوريمون', 'recormon', 'أرانسب', 'aranesp',
  'كوريومون', 'choriomon', 'بونفوري', 'profasi', 'سيتروتايد', 'cetrotide',
  'زولادكس', 'zoladex', 'أكتيمرا', 'actemra', 'انبريل', 'enbrel', 'هيرميرا',
  'humira', 'رميكيد', 'remicade', 'افرسدي', 'evrysdi', 'دوبيكسنت', 'dupixent',
  'إيبرانس', 'ibrance', 'كيسقالي', 'kisqali', 'زيلودا', 'xeloda', 'تاسيجنا',
  'tasigna', 'غليفك', 'gleevec', 'ليكيفو', 'lixiana', 'جارديانس', 'jardiance',
  'سينجاردي', 'synjardy', 'أوجمنتين', 'augmentin', 'زيثروماكس', 'زينات',
  'zinnat', 'سيلسيبت', 'cellcept', 'بروجراف', 'prograf', 'ريفوليد', 'revolade',
  'نبلاست', 'neupogen', 'نيولاستا', 'neulasta', 'كونكور', 'concor', 'بيسوبرولول',
  'ليبيتور', 'lipitor', 'كريستور', 'crestor', 'نيكسيوم', 'nexium', 'فالتريكس',
  'valtrex', 'سيربرولايسين', 'cerebrolysin', 'نوتروبيل', 'nootropil',
  'بالميكورت', 'pulmicort', 'سيريتيد', 'seretide', 'إتروفنت', 'atrovent',
  'سبيريفا', 'spiriva', 'هيالجان', 'hyalgan', 'لاميكتال', 'lamictal', 'ديباكين',
  'depakine', 'تيجريتول', 'tegretol', 'كيبرا', 'keppra', 'توبماكس', 'topamax',
  'اريبيدكس', 'arimidex', 'فيمارا', 'femara', 'أروماسين', 'aromasin', 'هرسبتين',
  'herceptin', 'بيرجيتا', 'perjeta', 'كادسيلا', 'kadcyla', 'رينفوك', 'rinvoq',
  'تارجوسيد', 'targocid', 'كليكسان', 'clexane', 'هيومان البومين', 'human albumin', 'ايكالتا', 'ecalta',
  'كوزنتكس', 'cosentyx', 'افونيكس', 'avonex', 'امجاليتي', 'emgality', 'انفيجا', 'invega',
  'لوكيلما', 'lokelma', 'روكسوتوب', 'ruxotop', 'بنتازا', 'pentasa', 'سيمبوني', 'simponi',
  'ليناليدوميد', 'lenalidomide', 'انبريل', 'enbrel', 'امجفيتا', 'amgevita', 'بارتيفيا', 'partivia',
  'جونال اف', 'gonal f', 'مونجارو', 'mounjaro', 'فوستيمون', 'fostimon', 'جونابيور', 'gonapure',
];

/** Matches a price like "3200 ج" or "3200 جنيه". */
export const PRICE_RE = /(\d[\d,.]*?)\s*(?:ج\s*\.?\s*م\.?|جنيهات?|جنيه|جنية|egp|le)(?![a-z])/i;

/** Matches Egyptian mobile numbers, with or without country code, globally. */
export const PHONE_RE = /\+?2?01(\d{9})/g;

/** Matches a quantity like "10 علبة" or "5 كرتون". */
export const QTY_RE = /(\d+)\s*(علبة|علب|علبتين|كرتون|فايل|فيال|امبول|أمبول|قلم|سرنجة|شريط|عبوة|عبوات)/i;
