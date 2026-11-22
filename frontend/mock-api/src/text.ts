import { z } from "zod";

// Zero-width and BOM characters render as nothing, so "​" would otherwise
// pass a "not empty" check and show up as a blank message.
const INVISIBLE = /[​-‍⁠﻿]/g;

/** A string with invisible characters removed and whitespace trimmed, then length-checked. */
export function cleanText(min: number, max: number, messages: { min?: string; max?: string } = {}) {
  return z
    .string()
    .transform((value) => value.replace(INVISIBLE, "").trim())
    .pipe(z.string().min(min, messages.min).max(max, messages.max));
}

/** Optional free text: missing or empty becomes "". */
export const optionalText = (max: number) => cleanText(0, max).optional().default("");
