import { paginationOptsValidator } from "convex/server"
import { ConvexError, v } from "convex/values"

import { internal } from "./_generated/api"
import type { Doc, Id } from "./_generated/dataModel"
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server"
import { playerId } from "./auth"
import { proAt } from "./flags"
import { addCopy, cardById, sortKeys, takeCopy } from "./packs"
import { notify } from "./push"
import { normalizeText } from "./songs/_lib/dedupe"
import {
  auctionHours,
  maxOpenAuctions,
  maxStartPrice,
  minBid,
  proMaxOpenAuctions,
  sellPrice,
  snipeWindowMs,
} from "./songs/_lib/economy"
import { cardRarity, type CardRarity } from "./songs/_lib/validators"
import { addCoins, ensurePlayer } from "./wallet"

// Coins for cards: selling a copy to the bank, and auctions between players. Every move of
// a card or coins happens in one mutation, so none is lost or doubled (see schema.ts, auctions).

const signedIn = async (ctx: QueryCtx) => {
  const player = await playerId(ctx)
  if (!player) throw new ConvexError("Not signed in")
  return player
}

const openAuction = async (ctx: QueryCtx, id: Id<"auctions">) => {
  const auction = await ctx.db.get("auctions", id)
  if (!auction || auction.status !== "open" || auction.endsAt <= Date.now()) {
    throw new ConvexError("This auction is over")
  }
  return auction
}

// Sells `count` copies to the bank, for its rarity's price each; selling the last takes the card
// out of the collection.
export const sell = mutation({
  args: { cardId: v.string(), count: v.optional(v.number()) },
  handler: async (ctx, { cardId, count = 1 }) => {
    const player = await signedIn(ctx)
    if (!Number.isInteger(count) || count < 1) {
      throw new ConvexError("Sell at least one copy")
    }
    const card = await cardById(ctx, cardId)
    if (!card) throw new ConvexError("Card not found")
    await takeCopy(ctx, player, cardId, count)
    await addCoins(ctx, player, sellPrice[card.rarity] * count)
    return sellPrice[card.rarity] * count
  },
})

// Puts a copy of a card up for auction, out of the collection until it ends.
export const list = mutation({
  args: {
    cardId: v.string(),
    startPrice: v.number(),
    // One of auctionHours (economy.ts).
    hours: v.number(),
  },
  handler: async (ctx, { cardId, startPrice, hours }) => {
    const player = await signedIn(ctx)
    if (!auctionHours.some((choice) => choice === hours)) {
      throw new ConvexError("Pick an auction length from the list")
    }
    if (
      !Number.isInteger(startPrice) ||
      startPrice < 1 ||
      startPrice > maxStartPrice
    ) {
      throw new ConvexError("The start price must be a whole number of holos")
    }
    const seller = await ensurePlayer(ctx, player)
    const most = (await proAt(ctx, seller, Date.now()))
      ? proMaxOpenAuctions
      : maxOpenAuctions
    const open = await ctx.db
      .query("auctions")
      .withIndex("by_sellerId_and_status_and_endsAt", (q) =>
        q.eq("sellerId", player).eq("status", "open")
      )
      .take(most)
    if (open.length >= most) {
      throw new ConvexError(`${most} auctions at most at a time`)
    }
    const card = await cardById(ctx, cardId)
    if (!card) throw new ConvexError("Card not found")
    await takeCopy(ctx, player, cardId)
    const endsAt = Date.now() + hours * 3_600_000
    const id = await ctx.db.insert("auctions", {
      sellerId: player,
      cardId,
      rarity: card.rarity,
      startPrice,
      endsAt,
      searchText: sortKeys(card).searchText,
      status: "open",
    })
    await ctx.scheduler.runAt(endsAt, internal.market.settle, { id })
    return id
  },
})

// Bids `amount` coins, held until outbid; a bid near the end pushes the end back. The seller and
// the bidder it outbids get a push.
export const bid = mutation({
  args: { id: v.id("auctions"), amount: v.number() },
  handler: async (ctx, { id, amount }) => {
    const player = await signedIn(ctx)
    const auction = await openAuction(ctx, id)
    if (auction.sellerId === player) {
      throw new ConvexError("You can't bid on your own auction")
    }
    if (auction.topBidderId === player) {
      throw new ConvexError("You're already the top bidder")
    }
    if (
      !Number.isInteger(amount) ||
      amount < minBid(auction.startPrice, auction.topBid)
    ) {
      throw new ConvexError("Bid too low")
    }
    await addCoins(ctx, player, -amount)
    if (auction.topBidderId && auction.topBid) {
      await addCoins(ctx, auction.topBidderId, auction.topBid)
    }
    const now = Date.now()
    await ctx.db.patch("auctions", id, {
      topBid: amount,
      topBidderId: player,
      // settle finds the later end when it runs and waits for it.
      endsAt: Math.max(auction.endsAt, now + snipeWindowMs),
    })
    await ctx.db.insert("bids", { auctionId: id, bidderId: player, amount })
    const title = (await cardById(ctx, auction.cardId))?.title ?? "your card"
    await notify(ctx, auction.sellerId, {
      title: "New bid",
      body: `${amount.toLocaleString("en")} holos bid on ${title}.`,
      url: "/market?scope=mine",
      tag: `bid-${id}`,
    })
    if (auction.topBidderId && auction.topBid) {
      await notify(ctx, auction.topBidderId, {
        title: "You've been outbid",
        body: `Someone bid ${amount.toLocaleString("en")} holos on ${title}. Your ${auction.topBid.toLocaleString("en")} holos are back.`,
        url: "/market?scope=bids",
        tag: `outbid-${id}`,
      })
    }
  },
})

// Takes the card back off auction, only while nobody has bid.
export const cancel = mutation({
  args: { id: v.id("auctions") },
  handler: async (ctx, { id }) => {
    const player = await signedIn(ctx)
    const auction = await openAuction(ctx, id)
    if (auction.sellerId !== player) throw new ConvexError("Not your auction")
    if (auction.topBidderId) {
      throw new ConvexError("Someone has bid: it runs to the end")
    }
    await returnCard(ctx, auction)
    await ctx.db.patch("auctions", id, { status: "cancelled" })
  },
})

const returnCard = async (ctx: MutationCtx, auction: Doc<"auctions">) => {
  const card = await cardById(ctx, auction.cardId)
  // shortcut: a card removed from the catalog mid-auction is lost; refund it if that ever happens.
  if (card) await addCopy(ctx, auction.sellerId, card)
}

// Ends an auction at its end time: the card to the top bidder and all their coins to the seller;
// or the card back to the seller without a bid. Runs again later if a late bid pushed
// the end back, and does nothing once settled, so a repeat run is harmless.
export const settle = internalMutation({
  args: { id: v.id("auctions") },
  handler: async (ctx, { id }) => {
    const auction = await ctx.db.get("auctions", id)
    if (!auction || auction.status !== "open") return
    if (auction.endsAt > Date.now()) {
      await ctx.scheduler.runAt(auction.endsAt, internal.market.settle, { id })
      return
    }
    const { topBidderId, topBid } = auction
    if (!topBidderId || !topBid) {
      await returnCard(ctx, auction)
      await ctx.db.patch("auctions", id, { status: "unsold" })
      return
    }
    const card = await cardById(ctx, auction.cardId)
    if (card) await addCopy(ctx, topBidderId, card)
    else await addCoins(ctx, topBidderId, topBid)
    if (card) await addCoins(ctx, auction.sellerId, topBid)
    await ctx.db.patch("auctions", id, { status: card ? "sold" : "unsold" })
  },
})

// An auction as the app shows it: its card, prices and where the player stands.
const auctionView = async (
  ctx: QueryCtx,
  auction: Doc<"auctions">,
  player: string | null
) => {
  const card = await cardById(ctx, auction.cardId)
  return card
    ? [
        {
          id: auction._id,
          card,
          startPrice: auction.startPrice,
          topBid: auction.topBid ?? null,
          minBid: minBid(auction.startPrice, auction.topBid),
          endsAt: auction.endsAt,
          status: auction.status,
          isMine: auction.sellerId === player,
          isLeading: auction.topBidderId === player,
        },
      ]
    : []
}

// How a player shows in an auction's history: "You", or a name that stays the same for them
// everywhere. shortcut: not their username, which lives in the auth component; look it up there
// once the market shows names.
const playerName = (id: string, player: string | null) =>
  id === player ? "You" : `Player ${id.slice(-4).toUpperCase()}`

// One auction, as the market's auction page shows it: its card, prices and where the player
// stands, and every bid, newest first. Null once it's gone.
// shortcut: the newest 50 bids; page them if an auction ever draws more.
export const auction = query({
  args: { id: v.id("auctions") },
  handler: async (ctx, { id }) => {
    const player = await playerId(ctx)
    const row = await ctx.db.get("auctions", id)
    if (!row) return null
    const [view] = await auctionView(ctx, row, player)
    if (!view) return null
    const bids = await ctx.db
      .query("bids")
      .withIndex("by_auctionId", (q) => q.eq("auctionId", id))
      .order("desc")
      .take(50)
    return {
      ...view,
      bids: bids.map((entry) => ({
        id: entry._id,
        bidder: playerName(entry.bidderId, player),
        isYours: entry.bidderId === player,
        amount: entry.amount,
        at: entry._creationTime,
      })),
    }
  },
})

// The views of `rows`, in their order.
const views = async (
  ctx: QueryCtx,
  rows: ReadonlyArray<Doc<"auctions">>,
  player: string | null
) =>
  (await Promise.all(rows.map((row) => auctionView(ctx, row, player)))).flat()

// How many of a player's newest bids "bids" looks through for the auctions they're on.
// shortcut: an auction last bid on 200 bids ago drops out; auctions last a day at most, so that's
// 200 bids a day. Keep a row per auction and bidder if anyone bids that much.
const BIDS_SCANNED = 200

// The player's open auctions: those they sell ("mine", at most proMaxOpenAuctions, the most
// anyone can run, so none drops out after Pro ends) or have bid on ("bids"), leading or not.
const playerAuctions = async (
  ctx: QueryCtx,
  player: string,
  scope: "mine" | "bids"
) => {
  if (scope === "mine") {
    return await ctx.db
      .query("auctions")
      .withIndex("by_sellerId_and_status_and_endsAt", (q) =>
        q.eq("sellerId", player).eq("status", "open")
      )
      .take(proMaxOpenAuctions)
  }
  const bids = await ctx.db
    .query("bids")
    .withIndex("by_bidderId", (q) => q.eq("bidderId", player))
    .order("desc")
    .take(BIDS_SCANNED)
  const ids = [...new Set(bids.map((entry) => entry.auctionId))]
  const rows = await Promise.all(ids.map((id) => ctx.db.get("auctions", id)))
  return rows
    .filter((row): row is Doc<"auctions"> => row?.status === "open")
    .toSorted((one, other) => one.endsAt - other.endsAt)
}

// The signed-in player's part in the shared live list (auctions `shared`): the open auctions they
// sell, left out of it, and those they lead. Empty for a visitor.
// shortcut: the first 500 they lead; past that some show as not led. Count them if anyone leads more.
export const standing = query({
  args: {},
  handler: async (ctx) => {
    const player = await playerId(ctx)
    if (!player) return { mine: [], leading: [] }
    const [mine, leading] = await Promise.all([
      playerAuctions(ctx, player, "mine"),
      ctx.db
        .query("auctions")
        .withIndex("by_topBidderId_and_status_and_endsAt", (q) =>
          q.eq("topBidderId", player).eq("status", "open")
        )
        .take(500),
    ])
    return {
      mine: mine.map((row) => row._id),
      leading: leading.map((row) => row._id),
    }
  },
})

// Everyone's open auctions of one rarity or all: matching `search`, best first, or ending soonest
// first without.
const openAuctions = (
  ctx: QueryCtx,
  rarity: CardRarity | undefined,
  search: string | undefined
) => {
  const open = ctx.db.query("auctions")
  if (search) {
    return open.withSearchIndex("search_searchText", (q) => {
      const found = q.search("searchText", search).eq("status", "open")
      return rarity ? found.eq("rarity", rarity) : found
    })
  }
  if (rarity) {
    return open.withIndex("by_status_and_rarity_and_endsAt", (q) =>
      q.eq("status", "open").eq("rarity", rarity)
    )
  }
  return open.withIndex("by_status_and_endsAt", (q) => q.eq("status", "open"))
}

// The auctions `player` won, of one rarity or all: matching `search`, best first, or the latest
// won first without.
const wonAuctions = (
  ctx: QueryCtx,
  player: string,
  rarity: CardRarity | undefined,
  search: string | undefined
) => {
  const all = ctx.db.query("auctions")
  if (search) {
    return all.withSearchIndex("search_searchText", (q) => {
      const found = q
        .search("searchText", search)
        .eq("status", "sold")
        .eq("topBidderId", player)
      return rarity ? found.eq("rarity", rarity) : found
    })
  }
  if (rarity) {
    return all
      .withIndex("by_topBidderId_and_status_and_rarity_and_endsAt", (q) =>
        q.eq("topBidderId", player).eq("status", "sold").eq("rarity", rarity)
      )
      .order("desc")
  }
  return all
    .withIndex("by_topBidderId_and_status_and_endsAt", (q) =>
      q.eq("topBidderId", player).eq("status", "sold")
    )
    .order("desc")
}

// Auctions of one rarity or all, a page at a time: other players' open ones ("live", by default,
// ending soonest first), the player's own open ones ("mine") or those they've bid on ("bids"),
// both ending soonest first, or those they won ("won", latest first). With `text`, those whose
// card's title or artists match it, best match first for "live" and "won".
// `shared` (live only): the same list for every player, without reading who asks, so one run serves
// everyone watching it when a bid or a new auction changes it; the player's own are then in it,
// `isMine`/`isLeading` false, and the app sets them from `standing`.
export const auctions = query({
  args: {
    paginationOpts: paginationOptsValidator,
    scope: v.optional(
      v.union(
        v.literal("live"),
        v.literal("mine"),
        v.literal("bids"),
        v.literal("won")
      )
    ),
    rarity: v.optional(cardRarity),
    text: v.optional(v.string()),
    shared: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    { paginationOpts, scope = "live", rarity, text, shared = false }
  ) => {
    const search = text?.trim()
    if (scope === "live" && shared) {
      const rows = await openAuctions(ctx, rarity, search).paginate(
        paginationOpts
      )
      return { ...rows, page: await views(ctx, rows.page, null) }
    }
    const player = await playerId(ctx)
    if (scope === "mine" || scope === "bids") {
      // A few dozen at most: filtered here, all on one page.
      const rows = player ? await playerAuctions(ctx, player, scope) : []
      const wanted = normalizeText(search ?? "")
      const page = (
        await views(
          ctx,
          rows.filter((row) => !rarity || row.rarity === rarity),
          player
        )
      ).filter((view) =>
        normalizeText(sortKeys(view.card).searchText).includes(wanted)
      )
      return { page, isDone: true, continueCursor: "" }
    }
    if (scope === "won") {
      if (!player) return { page: [], isDone: true, continueCursor: "" }
      const rows = await wonAuctions(ctx, player, rarity, search).paginate(
        paginationOpts
      )
      return { ...rows, page: await views(ctx, rows.page, player) }
    }
    const rows = await openAuctions(ctx, rarity, search).paginate(
      paginationOpts
    )
    // Their own are under "mine": a page can come back short by those (proMaxOpenAuctions at most),
    // which the cursor still moves past.
    const others = rows.page.filter((row) => row.sellerId !== player)
    return { ...rows, page: await views(ctx, others, player) }
  },
})
