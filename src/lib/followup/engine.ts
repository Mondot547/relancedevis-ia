// Moteur de relance — logique pure (sans dépendance), testable avec `node --test`.

export interface SendWindow {
  timezone: string;
  startHour: number; // inclus, ex. 9
  endHour: number; // exclu, ex. 18
  days: number[]; // 1 = lundi … 7 = dimanche
}

export const DEFAULT_WINDOW: SendWindow = {
  timezone: "Europe/Paris",
  startHour: 9,
  endHour: 18,
  days: [1, 2, 3, 4, 5],
};

const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
}

function localParts(ts: number, timezone: string): LocalParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    weekday: "short",
  });
  const out: Record<string, string> = {};
  for (const p of fmt.formatToParts(new Date(ts))) out[p.type] = p.value;
  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    hour: Number(out.hour),
    minute: Number(out.minute),
    second: Number(out.second),
    weekday: WEEKDAYS[out.weekday],
  };
}

function offsetMs(ts: number, timezone: string): number {
  const p = localParts(ts, timezone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(ts / 1000) * 1000;
}

/** Convertit une heure locale (dans `timezone`) en instant UTC. */
export function zonedToUtc(
  year: number, month: number, day: number, hour: number, minute: number, timezone: string,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  let ts = guess - offsetMs(guess, timezone);
  ts = guess - offsetMs(ts, timezone); // second passage : bascule heure d'été/hiver
  return new Date(ts);
}

/** Premier instant >= `from` qui tombe dans la fenêtre d'envoi autorisée. */
export function nextAllowedSlot(from: Date, window: SendWindow = DEFAULT_WINDOW): Date {
  const p = localParts(from.getTime(), window.timezone);
  const dayOk = window.days.includes(p.weekday);
  if (dayOk && p.hour >= window.startHour && p.hour < window.endHour) return from;

  // Jour courant avant l'ouverture : on attend l'heure de début.
  let { year, month, day } = p;
  if (!(dayOk && p.hour < window.startHour)) {
    // Sinon : on passe au jour suivant (via midi UTC pour éviter les pièges de bascule horaire).
    const next = new Date(Date.UTC(year, month - 1, day, 12) + 24 * 3600 * 1000);
    year = next.getUTCFullYear(); month = next.getUTCMonth() + 1; day = next.getUTCDate();
  }
  for (let i = 0; i < 14; i++) {
    const slot = zonedToUtc(year, month, day, window.startHour, 0, window.timezone);
    const wd = localParts(slot.getTime(), window.timezone).weekday;
    if (window.days.includes(wd)) return slot;
    const next = new Date(Date.UTC(year, month - 1, day, 12) + 24 * 3600 * 1000);
    year = next.getUTCFullYear(); month = next.getUTCMonth() + 1; day = next.getUTCDate();
  }
  throw new Error("Aucune fenêtre d'envoi valide (jours autorisés vides ?)");
}

export interface PlannedFollowUp {
  step: number;
  scheduledAt: Date;
}

/** Valide des délais configurables : entiers positifs, strictement croissants, max 10 étapes. */
export function validateDelays(delays: number[]): string | null {
  if (!Array.isArray(delays) || delays.length === 0) return "Au moins une relance est requise.";
  if (delays.length > 10) return "Maximum 10 relances.";
  let prev = 0;
  for (const d of delays) {
    if (!Number.isInteger(d) || d < 1 || d > 365) return "Les délais doivent être des jours entiers entre 1 et 365.";
    if (d <= prev) return "Les délais doivent être strictement croissants.";
    prev = d;
  }
  return null;
}

/** Calendrier de relance : J+delays à partir de la date d'envoi du devis, calé sur la fenêtre d'envoi. */
export function planFollowUps(
  quoteSentAt: Date, delays: number[], window: SendWindow = DEFAULT_WINDOW,
): PlannedFollowUp[] {
  const err = validateDelays(delays);
  if (err) throw new Error(err);
  return delays.map((d, i) => ({
    step: i + 1,
    scheduledAt: nextAllowedSlot(new Date(quoteSentAt.getTime() + d * 24 * 3600 * 1000), window),
  }));
}

export interface EligibilityInput {
  quoteStatus: "draft" | "sent" | "accepted" | "rejected" | "expired";
  respondedAt: Date | null;
  campaignStatus: "active" | "paused" | "completed" | "stopped";
  prospectEmail: string | null;
  prospectOptedOut: boolean;
  alreadySent: boolean;
  aiDraftApproved?: boolean; // requis si le message est généré par IA et validation obligatoire
  usesAi?: boolean;
  aiRequiresValidation?: boolean;
}

export type Decision = { send: true } | { send: false; reason: string };

/** Dernier contrôle avant tout envoi. Toute raison de ne pas envoyer l'emporte. */
export function decideSend(i: EligibilityInput): Decision {
  if (i.alreadySent) return { send: false, reason: "already_sent" };
  if (i.campaignStatus !== "active") return { send: false, reason: "campaign_not_active" };
  if (i.quoteStatus !== "sent") return { send: false, reason: "quote_not_open" };
  if (i.respondedAt) return { send: false, reason: "prospect_replied" };
  if (!i.prospectEmail) return { send: false, reason: "no_email" };
  if (i.prospectOptedOut) return { send: false, reason: "opted_out" };
  if (i.usesAi && i.aiRequiresValidation && !i.aiDraftApproved) {
    return { send: false, reason: "ai_draft_not_approved" };
  }
  return { send: true };
}

/** Délai avant nouvelle tentative : 15 min, 1 h, 4 h… ; null = abandon. */
export function retryDelayMs(attempts: number, maxAttempts = 3): number | null {
  if (attempts >= maxAttempts) return null;
  return [15 * 60_000, 60 * 60_000, 4 * 60 * 60_000][Math.max(0, attempts - 1)] ?? 4 * 60 * 60_000;
}

/** Remplace {{variable}} ; les variables inconnues sont laissées vides (jamais de "{{...}}" envoyé). */
export function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, k: string) => vars[k.toLowerCase()] ?? "");
}
