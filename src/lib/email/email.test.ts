import { test } from "node:test";
import assert from "node:assert/strict";
import { buildEmail } from "./templates.ts";
import { unsubscribeToken, verifyUnsubscribeToken, unsubscribeUrl } from "../unsubscribe.ts";

process.env.CRON_SECRET = "secret-de-test";
const ID = "11111111-2222-3333-4444-555555555555";

test("jeton de désinscription : valide, falsifié, autre prospect", async () => {
  const t = await unsubscribeToken(ID);
  assert.equal(await verifyUnsubscribeToken(ID, t), true);
  assert.equal(await verifyUnsubscribeToken(ID, t.slice(0, -1) + (t.endsWith("a") ? "b" : "a")), false);
  assert.equal(await verifyUnsubscribeToken("11111111-2222-3333-4444-555555555556", t), false);
  assert.equal(await verifyUnsubscribeToken(ID, ""), false);
});

test("liens de désinscription", async () => {
  const u = await unsubscribeUrl("https://app.exemple.fr/", ID);
  assert.ok(u.page.startsWith(`https://app.exemple.fr/desinscription/${ID}/`));
  assert.ok(u.oneClick.startsWith(`https://app.exemple.fr/api/desinscription/${ID}/`));
});

test("email : variables remplacées, lien de désinscription présent, HTML échappé", () => {
  for (const step of [1, 2, 3, 7]) {
    const m = buildEmail({
      step, prospectName: "Jean Dupont", quoteTitle: "Salle de bain <b>", amountCents: 450000,
      companyName: "Martin & Fils", unsubscribePageUrl: "https://x.fr/d/1",
    });
    assert.ok(!m.subject.includes("{{") && !m.text.includes("{{") && !m.html.includes("{{"));
    assert.ok(m.text.includes("Bonjour Jean,"));
    assert.ok(m.text.includes("https://x.fr/d/1") && m.html.includes("https://x.fr/d/1"));
    assert.ok(m.html.includes("Martin &amp; Fils") && m.html.includes("&lt;b&gt;"));
    assert.ok(!m.html.includes("<b>"));
    if (step === 1) assert.ok(m.text.replace(/\s/g, " ").includes("4 500"));
  }
});
