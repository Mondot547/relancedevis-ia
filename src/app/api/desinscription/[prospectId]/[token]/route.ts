import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";

export const dynamic = "force-dynamic";

// POST uniquement : un simple clic ou un aperçu de lien par la messagerie ne désinscrit personne,
// mais le « one-click » des clients mail (RFC 8058) fonctionne.
export async function POST(
  request: Request,
  ctx: { params: Promise<{ prospectId: string; token: string }> },
) {
  const { prospectId, token } = await ctx.params;
  if (!z.string().uuid().safeParse(prospectId).success || !(await verifyUnsubscribeToken(prospectId, token))) {
    return NextResponse.json({ error: "lien invalide" }, { status: 400 });
  }
  const db = createAdminClient();
  await db.from("prospects")
    .update({ email_opt_out: true, opted_out_at: new Date().toISOString() }).eq("id", prospectId);

  // Annule les relances déjà programmées pour ce prospect
  const { data: quotes } = await db.from("quotes").select("id").eq("prospect_id", prospectId);
  const ids = (quotes ?? []).map((q: { id: string }) => q.id);
  if (ids.length > 0) {
    await db.from("follow_up_logs")
      .update({ status: "cancelled", error: "opted_out" })
      .in("quote_id", ids).in("status", ["scheduled", "failed"]);
  }

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? request.url;
  return NextResponse.redirect(new URL("/desinscription/confirmation", base), 303);
}
