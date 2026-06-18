import { defineBlueprint, defineDocumentFunction, defineSyncTagInvalidateFunction } from "@sanity/blueprints";

export default defineBlueprint({
  resources: [
    defineDocumentFunction({
      name: "auto-redirect",
      src: "./functions/auto-redirect",
      project: "xbiitlth",
      memory: 2,
      timeout: 30,
      event: {
        on: ["publish"],
        filter: "delta::changedAny(slug.current)",
        projection:
          "{'beforeSlug': before().slug.current, 'slug': after().slug.current}",
        resource: {
          type: "dataset",
          id: "xbiitlth.production",
        },
      },
    }),
    defineSyncTagInvalidateFunction({
      name: "invalidate-tags",
      project: "xbiitlth",
      event: {
        resource: {
          type: "dataset",
          id: "xbiitlth.production",
        },
      },
    }),
  ],
});
