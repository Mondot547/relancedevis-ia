import Stripe from "stripe";

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY manquante");
  // client HTTP basé sur fetch : compatible avec l'hébergement Cloudflare
  return new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });
}
