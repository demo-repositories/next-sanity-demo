function syncTagInvalidateEventHandler(handler2) {
  if (typeof handler2 !== "function")
    throw new TypeError("`handler` must be a function");
  return handler2;
}
const REVALIDATE_URL = `${process.env.NEXT_PUBLIC_SITE_URL}/api/revalidate-sync-tags`;
const handler = syncTagInvalidateEventHandler(async ({ event, done }) => {
  const { syncTags } = event.data;
  const res = await fetch(REVALIDATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.SANITY_REVALIDATE_SECRET}`
    },
    body: JSON.stringify({ syncTags })
  });
  console.log(`Revalidated ${syncTags.length} tags, HTTP ${res.status}`);
  const response = await done(syncTags);
  console.log("Invalidation complete, Sanity responded with HTTP", response.status);
});
export {
  handler
};
//# sourceMappingURL=index.js.map
