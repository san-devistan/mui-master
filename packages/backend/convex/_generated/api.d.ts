/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as billing from "../billing.js";
import type * as catalog from "../catalog.js";
import type * as collection from "../collection.js";
import type * as crons from "../crons.js";
import type * as flags from "../flags.js";
import type * as grants from "../grants.js";
import type * as http from "../http.js";
import type * as market from "../market.js";
import type * as notify from "../notify.js";
import type * as packs from "../packs.js";
import type * as playback from "../playback.js";
import type * as players from "../players.js";
import type * as profile from "../profile.js";
import type * as push from "../push.js";
import type * as related from "../related.js";
import type * as songs__lib_dedupe from "../songs/_lib/dedupe.js";
import type * as songs__lib_deezer from "../songs/_lib/deezer.js";
import type * as songs__lib_economy from "../songs/_lib/economy.js";
import type * as songs__lib_rarity from "../songs/_lib/rarity.js";
import type * as songs__lib_validators from "../songs/_lib/validators.js";
import type * as throttle from "../throttle.js";
import type * as upgrades from "../upgrades.js";
import type * as wallet from "../wallet.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  billing: typeof billing;
  catalog: typeof catalog;
  collection: typeof collection;
  crons: typeof crons;
  flags: typeof flags;
  grants: typeof grants;
  http: typeof http;
  market: typeof market;
  notify: typeof notify;
  packs: typeof packs;
  playback: typeof playback;
  players: typeof players;
  profile: typeof profile;
  push: typeof push;
  related: typeof related;
  "songs/_lib/dedupe": typeof songs__lib_dedupe;
  "songs/_lib/deezer": typeof songs__lib_deezer;
  "songs/_lib/economy": typeof songs__lib_economy;
  "songs/_lib/rarity": typeof songs__lib_rarity;
  "songs/_lib/validators": typeof songs__lib_validators;
  throttle: typeof throttle;
  upgrades: typeof upgrades;
  wallet: typeof wallet;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
  resend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
  stripe: import("@convex-dev/stripe/_generated/component.js").ComponentApi<"stripe">;
  stripeSandbox: import("@convex-dev/stripe/_generated/component.js").ComponentApi<"stripeSandbox">;
};
