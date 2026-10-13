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
import type * as catalog from "../catalog.js";
import type * as http from "../http.js";
import type * as packs from "../packs.js";
import type * as playback from "../playback.js";
import type * as songs__lib_dedupe from "../songs/_lib/dedupe.js";
import type * as songs__lib_deezer from "../songs/_lib/deezer.js";
import type * as songs__lib_rarity from "../songs/_lib/rarity.js";
import type * as songs__lib_validators from "../songs/_lib/validators.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  catalog: typeof catalog;
  http: typeof http;
  packs: typeof packs;
  playback: typeof playback;
  "songs/_lib/dedupe": typeof songs__lib_dedupe;
  "songs/_lib/deezer": typeof songs__lib_deezer;
  "songs/_lib/rarity": typeof songs__lib_rarity;
  "songs/_lib/validators": typeof songs__lib_validators;
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
};
