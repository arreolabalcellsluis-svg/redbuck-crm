import type { Customer } from '@/types';

/** Normalize phone: strip non-digits, remove MX country codes */
export function normalizePhone(phone: string): string {
  let p = phone.replace(/[\s\-\(\)\.\+]/g, '');
  if (p.startsWith('521') && p.length > 10) p = p.slice(p.length - 10);
  else if (p.startsWith('52') && p.length > 10) p = p.slice(p.length - 10);
  else if (p.startsWith('1') && p.length === 11) p = p.slice(1);
  return p;
}

/** Normalize email for comparison */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Normalize name for fuzzy comparison: lowercase, strip accents, extra spaces */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Simple fuzzy name match: checks if one name contains the other or token overlap >= 60% */
function fuzzyNameMatch(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb || na.length < 3 || nb.length < 3) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  // Token overlap
  const tokensA = new Set(na.split(' ').filter(t => t.length > 1));
  const tokensB = new Set(nb.split(' ').filter(t => t.length > 1));
  if (tokensA.size === 0 || tokensB.size === 0) return false;
  let overlap = 0;
  tokensA.forEach(t => { if (tokensB.has(t)) overlap++; });
  const similarity = overlap / Math.max(tokensA.size, tokensB.size);
  return similarity >= 0.5;
}

export type DuplicateMatch = {
  customer: Customer;
  matchReasons: string[];
  score: number; // higher = stronger match
};

/** Find all potential duplicates for a given form input */
export function findDuplicates(
  form: { phone: string; email?: string; name: string; whatsapp?: string },
  allCustomers: Customer[],
  excludeId?: string,
): DuplicateMatch[] {
  const normPhone = normalizePhone(form.phone);
  const normEmail = form.email ? normalizeEmail(form.email) : '';
  const results: DuplicateMatch[] = [];

  for (const c of allCustomers) {
    if (excludeId && c.id === excludeId) continue;
    const reasons: string[] = [];
    let score = 0;

    // Phone match (strongest signal)
    if (normPhone && normPhone.length >= 7) {
      const cPhone = normalizePhone(c.phone);
      const cWhatsapp = c.whatsapp ? normalizePhone(c.whatsapp) : '';
      if (cPhone === normPhone || cWhatsapp === normPhone) {
        reasons.push('Teléfono coincide');
        score += 100;
      }
    }

    // WhatsApp from form vs customer phone/whatsapp
    if (form.whatsapp) {
      const formWa = normalizePhone(form.whatsapp);
      if (formWa.length >= 7) {
        const cPhone = normalizePhone(c.phone);
        const cWhatsapp = c.whatsapp ? normalizePhone(c.whatsapp) : '';
        if (cPhone === formWa || cWhatsapp === formWa) {
          if (!reasons.includes('Teléfono coincide')) {
            reasons.push('WhatsApp coincide');
            score += 90;
          }
        }
      }
    }

    // Email match
    if (normEmail && normEmail.length > 3 && c.email) {
      if (normalizeEmail(c.email) === normEmail) {
        reasons.push('Email coincide');
        score += 80;
      }
    }

    // Name fuzzy match (weaker signal, only add if phone/email didn't already match)
    if (form.name.length >= 3 && fuzzyNameMatch(form.name, c.name)) {
      reasons.push('Nombre similar');
      score += 40;
    }

    if (reasons.length > 0) {
      results.push({ customer: c, matchReasons: reasons, score });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

export type DuplicateGroup = {
  customers: Customer[];
  reason: string;
};

/** Scan all customers for global duplicate groups */
export function scanGlobalDuplicates(allCustomers: Customer[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const usedIds = new Set<string>();

  // Phone-based groups
  const phoneMap = new Map<string, Customer[]>();
  for (const c of allCustomers) {
    const p = normalizePhone(c.phone);
    if (p.length >= 7) {
      if (!phoneMap.has(p)) phoneMap.set(p, []);
      phoneMap.get(p)!.push(c);
    }
    if (c.whatsapp) {
      const w = normalizePhone(c.whatsapp);
      if (w.length >= 7) {
        if (!phoneMap.has(w)) phoneMap.set(w, []);
        const arr = phoneMap.get(w)!;
        if (!arr.find(x => x.id === c.id)) arr.push(c);
      }
    }
  }
  phoneMap.forEach((custs, phone) => {
    if (custs.length > 1) {
      const ids = custs.map(c => c.id).sort().join(',');
      if (!usedIds.has(ids)) {
        usedIds.add(ids);
        groups.push({ customers: custs, reason: `Teléfono duplicado: ${phone}` });
      }
    }
  });

  // Email-based groups
  const emailMap = new Map<string, Customer[]>();
  for (const c of allCustomers) {
    if (c.email) {
      const e = normalizeEmail(c.email);
      if (e.length > 3) {
        if (!emailMap.has(e)) emailMap.set(e, []);
        emailMap.get(e)!.push(c);
      }
    }
  }
  emailMap.forEach((custs) => {
    if (custs.length > 1) {
      const ids = custs.map(c => c.id).sort().join(',');
      if (!usedIds.has(ids)) {
        usedIds.add(ids);
        groups.push({ customers: custs, reason: 'Email duplicado' });
      }
    }
  });

  // Name-based groups (fuzzy)
  for (let i = 0; i < allCustomers.length; i++) {
    for (let j = i + 1; j < allCustomers.length; j++) {
      const a = allCustomers[i], b = allCustomers[j];
      if (fuzzyNameMatch(a.name, b.name)) {
        const ids = [a.id, b.id].sort().join(',');
        if (!usedIds.has(ids)) {
          usedIds.add(ids);
          groups.push({ customers: [a, b], reason: 'Nombre similar' });
        }
      }
    }
  }

  return groups;
}
