/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as catalog from "../catalog.js";
import type * as collection from "../collection.js";
import type * as crons from "../crons.js";
import type * as playback from "../playback.js";
import type * as songs__lib_audiometa from "../songs/_lib/audiometa.js";
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
  catalog: typeof catalog;
  collection: typeof collection;
  crons: typeof crons;
  playback: typeof playback;
  "songs/_lib/audiometa": typeof songs__lib_audiometa;
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

export declare const components: {};
