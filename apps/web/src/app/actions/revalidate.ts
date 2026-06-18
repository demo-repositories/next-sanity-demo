"use server";

import { revalidateTag, updateTag } from "next/cache";
import { draftMode } from "next/headers";
import { parseTags } from "next-sanity/live";

/**
 * Server action invoked by <SanityLive> for every live event.
 *
 * Live events carry `sanity:`-prefixed tags; `parseTags` validates them and keeps
 * the prefix so they match the cache tags `sanityFetch` sets on its `'use cache'`
 * segments (the Layer 3 components in the three-layer pattern).
 */
export async function revalidateSyncTags(unsafeTags: unknown) {
  const { isEnabled: isDraftMode } = await draftMode();
  const { tags } = parseTags(unsafeTags);

  if (isDraftMode) {
    // In Presentation/draft mode the draft content is still wrapped in `'use cache'`,
    // so a bare `router.refresh()` reuses the cached segment and shows stale content.
    // `updateTag` busts those tags with read-your-own-writes semantics, so the editor
    // sees their own edits live without manually refreshing Presentation.
    for (const tag of tags) {
      updateTag(tag);
    }
    return;
  }

  // Published mode: purge the cached segments for any visitor with the page open,
  // then refresh the client router so the new content renders.
  for (const tag of tags) {
    revalidateTag(tag, "max");
  }
  return "refresh" as const;
}
