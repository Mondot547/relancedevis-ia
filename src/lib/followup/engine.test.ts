import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_WINDOW, nextAllowedSlot, planFollowUps, validateDelays, decideSend, retryDelayMs, renderTemplate,
  type EligibilityInput,
} from "./engine.ts";

const base: EligibilityInput = {
  quoteStatus: "sent", respondedAt: null, campaignStatus: "active",
  prospectEmail: "a@b.fr", prospectOptedOut: false, alreadySent: false,
};

test("heure dans la fenêtre : inchangée", () => {
  const d = new Date("2026-11-04T10:00:00Z"); // mercredi 11h Paris
  assert.equal(nextAllowedSlot(d).toISOString(), d.toISOString());
});

test("samedi : reporté au lundi 9h Paris", () => {
  const r = nextAllowedSlot(new Date("2026-11-07T10:00:00Z")); // samedi
  assert.equal(r.toISOString(), "2026-11-09T08:00:00.000Z"); // lundi 9h CET = 08:00Z
});

test("mercredi 20h Paris : reporté à jeudi 9h", () => {
  const r = nextAllowedSlot(new Date("2026-11-04T19:00:00Z"));
  assert.equal(r.toISOString(), "2026-11-05T08:00:00.000Z");
});

test("mercredi 6h Paris : reporté à 9h le même jour", () => {
  const r = nextAllowedSlot(new Date("2026-11-04T05:00:00Z"));
  assert.equal(r.toISOString(), "2026-11-04T08:00:00.000Z");
});

test("heure d'été : 9h Paris = 07:00Z", () => {
  const r = nextAllowedSlot(new Date("2026-07-01T03:00:00Z"));
  assert.equal(r.toISOString(), "2026-07-01T07:00:00.000Z");
});

test("bascule heure d'hiver (25 oct 2026) gérée", () => {
  const r = nextAllowedSlot(new Date("2026-10-24T20:00:00Z")); // samedi soir
  assert.equal(r.toISOString(), "2026-10-26T08:00:00.000Z"); // lundi 9h CET
});

test("planFollowUps J+3/J+7/J+14", () => {
  const plan = planFollowUps(new Date("2026-11-02T09:00:00Z"), [3, 7, 14]);
  assert.deepEqual(plan.map((p) => p.step), [1, 2, 3]);
  assert.equal(plan[0].scheduledAt.toISOString(), "2026-11-05T09:00:00.000Z");
  for (const p of plan) assert.equal(nextAllowedSlot(p.scheduledAt).getTime(), p.scheduledAt.getTime());
});

test("validateDelays", () => {
  assert.equal(validateDelays([3, 7, 14]), null);
  assert.ok(validateDelays([]));
  assert.ok(validateDelays([7, 3]));
  assert.ok(validateDelays([3, 3]));
  assert.ok(validateDelays([0, 2]));
  assert.ok(validateDelays([1.5]));
});

test("decideSend : cas bloquants", () => {
  assert.deepEqual(decideSend(base), { send: true });
  assert.equal((decideSend({ ...base, alreadySent: true }) as any).reason, "already_sent");
  assert.equal((decideSend({ ...base, respondedAt: new Date() }) as any).reason, "prospect_replied");
  for (const s of ["accepted", "rejected", "expired", "draft"] as const)
    assert.equal((decideSend({ ...base, quoteStatus: s }) as any).reason, "quote_not_open");
  assert.equal((decideSend({ ...base, campaignStatus: "paused" }) as any).reason, "campaign_not_active");
  assert.equal((decideSend({ ...base, prospectOptedOut: true }) as any).reason, "opted_out");
  assert.equal((decideSend({ ...base, prospectEmail: null }) as any).reason, "no_email");
});

test("message IA : jamais envoyé sans validation", () => {
  const ai = { ...base, usesAi: true, aiRequiresValidation: true };
  assert.equal((decideSend(ai) as any).reason, "ai_draft_not_approved");
  assert.deepEqual(decideSend({ ...ai, aiDraftApproved: true }), { send: true });
});

test("retryDelayMs", () => {
  assert.equal(retryDelayMs(1), 15 * 60_000);
  assert.equal(retryDelayMs(2), 60 * 60_000);
  assert.equal(retryDelayMs(3), null);
});

test("renderTemplate : variables inconnues vidées", () => {
  assert.equal(renderTemplate("Bonjour {{prenom}} {{inconnu}}!", { prenom: "Luc" }), "Bonjour Luc !");
});
