import {revalidateTag} from 'next/cache'
import {type NextRequest, NextResponse} from 'next/server'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.SANITY_REVALIDATE_SECRET) {
    return new Response('Unauthorized', {status: 401})
  }
  const body = await req.json()
  const syncTags: unknown = body?.syncTags
  if (!Array.isArray(syncTags) || syncTags.length === 0) {
    return new Response('Bad Request: syncTags must be a non-empty array', {status: 400})
  }
  for (const tag of syncTags as string[]) {
    // sanityFetch stores cache entries as `sanity:${tag}` — prefix is required for the tag to match
    // {expire: 0} ensures no stale-while-revalidate window: all visitors see fresh content immediately
    revalidateTag(`sanity:${tag}`, {expire: 0})
  }
  return NextResponse.json({revalidated: true, syncTags})
}
