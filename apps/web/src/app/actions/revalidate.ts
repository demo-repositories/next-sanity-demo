'use server'
import {revalidateTag} from 'next/cache'
import {draftMode} from 'next/headers'

export async function revalidateSyncTags(unsafeTags: unknown) {
  if ((await draftMode()).isEnabled) {
    return 'refresh' as const
  }
  const syncTags = Array.isArray(unsafeTags) ? (unsafeTags as string[]) : []
  for (const tag of syncTags) {
    revalidateTag(tag, {expire: 0})
  }
  return 'refresh' as const
}
