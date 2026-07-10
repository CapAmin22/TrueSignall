/**
 * Stripe catalog setup — docs/08 §6 (M8): products starter/growth/scale ×
 * monthly+annual prices, metadata mirrored in lib/plans.ts.
 *
 * Usage: STRIPE_SECRET_KEY=sk_... npx tsx scripts/stripe-setup.ts
 */
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const API = "https://api.stripe.com/v1";

const CATALOG = [
  { key: "starter", name: "Signal AI Starter", monthly: 9900, annual: 99000, accounts: 50, contacts: 500, seats: 1, drafts: 300 },
  { key: "growth", name: "Signal AI Growth", monthly: 24900, annual: 249000, accounts: 200, contacts: 2000, seats: 3, drafts: 1000 },
  { key: "scale", name: "Signal AI Scale", monthly: 49900, annual: 499000, accounts: 500, contacts: 5000, seats: 5, drafts: 3000 },
];

async function stripe(path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const res = await fetch(`${API}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${path}: ${JSON.stringify(data.error)}`);
  return data;
}

async function main() {
  if (!STRIPE_KEY) {
    process.stdout.write("stripe-setup: STRIPE_SECRET_KEY not set — printing catalog only\n");
    process.stdout.write(JSON.stringify(CATALOG, null, 2) + "\n");
    return;
  }

  for (const plan of CATALOG) {
    const product = await stripe("products", {
      name: plan.name,
      "metadata[plan_key]": plan.key,
      "metadata[accounts]": String(plan.accounts),
      "metadata[contacts]": String(plan.contacts),
      "metadata[seats]": String(plan.seats),
      "metadata[drafts]": String(plan.drafts),
    });
    const monthly = await stripe("prices", {
      product: String(product.id),
      currency: "usd",
      unit_amount: String(plan.monthly),
      "recurring[interval]": "month",
      nickname: `${plan.key}-monthly`,
    });
    const annual = await stripe("prices", {
      product: String(product.id),
      currency: "usd",
      unit_amount: String(plan.annual),
      "recurring[interval]": "year",
      nickname: `${plan.key}-annual`,
    });
    process.stdout.write(
      `${plan.key}: product=${product.id} monthly=${monthly.id} annual=${annual.id}\n`,
    );
  }
  process.stdout.write("\nPaste the price IDs into lib/plans.ts (single source for meters).\n");
}

main().catch((err) => {
  process.stderr.write(`${err}\n`);
  process.exit(1);
});

export {};
