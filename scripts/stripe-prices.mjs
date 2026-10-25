// Makes the shop's Stripe products and prices (packages/backend/convex/songs/_lib/economy.ts
// holoBundles and pro), found by their lookup keys, in the Stripe account the Stripe CLI is
// logged in to: a sandbox while testing (`stripe login`), live with --live (or with a key in
// STRIPE_API_KEY). A price already there at the same amount is kept; one with another amount is
// replaced (Stripe prices can't change), its lookup key moved to the new one. A product made by
// hand (same name, "Holo pouch"…) is reused, its price at the right amount given the lookup key
// billing.ts looks for. Each product also gets its icon
// (scripts/stripe-icons/, the game's holo coins and Pro crown), uploaded to Stripe's files, for
// the dashboard, Checkout and receipts; a product that already has an image keeps it, unless
// --icons. Run: node scripts/stripe-prices.mjs [--live] [--icons]
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"

const { holoBundles, pro } = await import(
  new URL("../packages/backend/convex/songs/_lib/economy.ts", import.meta.url)
    .href
)

const live = process.argv.includes("--live")
const replaceIcons = process.argv.includes("--icons")

const stripe = (...args) =>
  JSON.parse(
    execFileSync("stripe", [...args, ...(live ? ["--live"] : [])], {
      encoding: "utf8",
    })
  )

// The key to upload the icons with (the CLI can't send files): STRIPE_API_KEY, else the CLI's.
function cliKey() {
  if (process.env.STRIPE_API_KEY) return process.env.STRIPE_API_KEY
  const config = execFileSync("stripe", ["config", "--list"], {
    encoding: "utf8",
  })
  const name = live ? "live_mode_api_key" : "test_mode_api_key"
  const line = config.split("\n").find((row) => row.startsWith(`${name} =`))
  const key = line?.split("'")[1]
  if (!key) throw new Error(`No ${name} in the Stripe CLI: run stripe login`)
  return key
}

// Uploads an icon to Stripe's files and returns its public link, for a product's images.
async function uploadIcon(file) {
  const form = new FormData()
  form.set("purpose", "business_logo")
  form.set("file_link_data[create]", "true")
  const png = readFileSync(new URL(`stripe-icons/${file}`, import.meta.url))
  form.set("file", new Blob([png], { type: "image/png" }), file)
  const response = await fetch("https://files.stripe.com/v1/files", {
    method: "POST",
    headers: { authorization: `Bearer ${cliKey()}` },
    body: form,
  })
  const uploaded = await response.json()
  const url = uploaded.links?.data?.[0]?.url
  if (!url) throw new Error(`${file}: ${uploaded.error?.message ?? "no link"}`)
  return url
}

const offers = [
  ...holoBundles.map((bundle) => ({
    lookupKey: bundle.lookupKey,
    name: `Holo ${bundle.id}`,
    description: `${bundle.holos.toLocaleString("en")} holos`,
    cents: bundle.priceCents,
    monthly: false,
    icon: `holos-${bundle.id}.png`,
  })),
  {
    lookupKey: pro.lookupKey,
    name: "Holotrack Pro",
    description: pro.perks.map((perk) => perk.label).join(", "),
    cents: pro.priceCents,
    monthly: true,
    icon: "holotrack-pro.png",
  },
]

// The offer's product: an active one by its name, else a new one.
function productFor(offer) {
  const [found] = stripe(
    "products",
    "search",
    "--query",
    `active:'true' AND name:'${offer.name}'`
  ).data
  if (found) return found
  return stripe(
    "products",
    "create",
    "--name",
    offer.name,
    "--description",
    offer.description
  )
}

// The offer's price, made (or replaced) when it's missing or at another amount, or an existing
// one at its amount given its lookup key; returns its product.
function syncPrice(offer) {
  const [current] = stripe(
    "prices",
    "list",
    "--lookup-keys",
    offer.lookupKey,
    "--expand",
    "data.product"
  ).data
  if (current?.unit_amount === offer.cents) {
    console.warn(`${offer.lookupKey}: kept (${current.id})`)
    return current.product
  }
  const product = current?.product ?? productFor(offer)
  const lookup = [
    "--lookup-key",
    offer.lookupKey,
    "-d",
    "transfer_lookup_key=true",
  ]
  const same = stripe(
    "prices",
    "list",
    "-d",
    `product=${product.id}`,
    "-d",
    "active=true"
  ).data.find(
    (price) =>
      price.unit_amount === offer.cents &&
      price.currency === "eur" &&
      (price.recurring?.interval === "month") === offer.monthly
  )
  if (same) {
    stripe("prices", "update", same.id, ...lookup)
    console.warn(`${offer.lookupKey}: set on ${same.id}`)
    return product
  }
  const price = stripe(
    "prices",
    "create",
    "--product",
    product.id,
    "--currency",
    "eur",
    "--unit-amount",
    String(offer.cents),
    ...lookup,
    ...(offer.monthly ? ["-d", "recurring[interval]=month"] : [])
  )
  console.warn(`${offer.lookupKey}: made ${price.id}`)
  return product
}

for (const offer of offers) {
  const product = syncPrice(offer)
  if (product.images.length > 0 && !replaceIcons) continue
  const url = await uploadIcon(offer.icon)
  stripe("products", "update", product.id, "-d", `images[0]=${url}`)
  console.warn(`${offer.lookupKey}: icon ${offer.icon}`)
}
