import { test } from "node:test";
import assert from "node:assert/strict";
import { mapStatus, mapSubscription } from "./map.ts";

test("statuts Stripe → statuts internes", () => {
  assert.equal(mapStatus("active"), "active");
  assert.equal(mapStatus("trialing"), "trialing");
  assert.equal(mapStatus("past_due"), "past_due");
  assert.equal(mapStatus("canceled"), "canceled");
  assert.equal(mapStatus("incomplete_expired"), "canceled");
  assert.equal(mapStatus("paused"), "unpaid");
  assert.equal(mapStatus("inconnu"), "unpaid"); // par défaut : jamais actif
});

test("abonnement avec résiliation programmée", () => {
  const r = mapSubscription({
    id: "sub_1", status: "active", customer: "cus_1", cancel_at_period_end: true,
    current_period_start: 1_700_000_000, current_period_end: 1_702_592_000,
    metadata: { plan_id: "pro", interval: "month", organization_id: "x" },
  });
  assert.equal(r.status, "active");
  assert.equal(r.cancel_at_period_end, true);
  assert.equal(r.plan_id, "pro");
  assert.equal(r.billing_interval, "month");
  assert.equal(r.stripe_customer_id, "cus_1");
  assert.equal(r.current_period_end, new Date(1_702_592_000 * 1000).toISOString());
});

test("période lue sur l'élément d'abonnement (nouvelles versions de l'API) et client en objet", () => {
  const r = mapSubscription({
    id: "sub_2", status: "canceled", customer: { id: "cus_2" }, cancel_at_period_end: false,
    items: { data: [{ current_period_start: 1_700_000_000, current_period_end: 1_700_100_000 }] },
  });
  assert.equal(r.status, "canceled");
  assert.equal(r.stripe_customer_id, "cus_2");
  assert.equal(r.current_period_end, new Date(1_700_100_000 * 1000).toISOString());
  assert.equal(r.plan_id, null);
  assert.equal(r.billing_interval, null);
});
