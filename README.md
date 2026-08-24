# Turbo Start Sanity

Turbo Start Sanity is a free, open-source Sanity template: a Next.js page builder
starter with visual editing, hyper-optimised SEO, and a Turborepo monorepo structure.
Built by [Roboto Studio](https://robotostudio.com) and used in production client builds.

[Turbo Start Sanity](https://raw.githubusercontent.com/robotostudio/turbo-start-sanity/main/tasteful-safe-option-og.png)

> **This repo has diverged from the template.** It started as
> [robotostudio/turbo-start-sanity](https://github.com/robotostudio/turbo-start-sanity)
> and has since been updated to use Next.js Cache Components, the Sanity Live Content API,
> Presentation, and a sync-tag-invalidate Sanity Function. Initializing a fresh copy with
> `npm create sanity@latest --template robotostudio/turbo-start-sanity` will **not** give you
> this codebase. Clone this repo instead, as described below.

## Features

### Monorepo Structure

- Apps: web (Next.js frontend) and studio (Sanity Studio)
- Shared packages: UI components, TypeScript config, environment utilities, logger
- Turborepo for build orchestration and caching

### Frontend (Web)

- Next.js App Router with TypeScript
- Shadcn UI components with Tailwind CSS
- Server Components and Server Actions
- SEO optimization with metadata
- Blog system with rich text editor
- Table of contents generation
- Responsive layouts

### Content Management (Studio)

- Sanity Studio v6
- Custom document types (Blog, FAQ, Pages)
- Visual editing integration
- Structured content with schemas
- Live preview capabilities
- Asset management

### Content Operations (Functions)

- Sync Tag Invalidate Function for query-level cache invalidation
- Document Function that generates redirects when a slug changes
- Blueprint-managed deploys via the Sanity CLI

## Getting Started

### Installing the template

#### 1. Clone and install

```shell
git clone https://github.com/demo-repositories/next-sanity-demo.git
cd next-sanity-demo
pnpm install
```

#### 2. Run Studio and Next.js app locally

Navigate to the template directory using `cd <your app name>`, and start the development servers by running the following command

```shell
pnpm run dev
```

#### 3. Open the app and sign in to the Studio

Open the Next.js app running locally in your browser on [http://localhost:3000](http://localhost:3000).

Open the Studio running locally in your browser on [http://localhost:3333](http://localhost:3333). You should now see a screen prompting you to log in to the Studio. Use the same service (Google, GitHub, or email) that you used when you logged in to the CLI.

### Adding content with Sanity

#### 1. Publish your first document

The template comes pre-defined with a schema containing `Author`, `Blog`, `BlogIndex`, `FAQ`, `Footer`, `HomePage`, `Navbar`, `Page`, and `Settings` document types.

From the Studio, click "+ Create" and select the `Blog` document type. Go ahead and create and publish the document.

Your content should now appear in your Next.js app ([http://localhost:3000](http://localhost:3000)) as well as in the Studio on the "Presentation" Tab

#### 2. Sample Content

When you initialize the template using the Sanity CLI, sample content is not automatically imported into your project. However, you can import it after the init is done. This data includes example blog posts, authors, and other content types to help you get started quickly (see next step).

#### 3. Seed data using script

To add sample data programmatically, run the following command:

```shell
cd apps/studio
npx sanity dataset import ./seed-data.tar.gz production --replace
```

This command imports seed content into your Sanity dataset.

#### 4. Extending the Sanity schema

The schemas for all document types are defined in the `studio/schemaTypes/documents` directory. You can [add more document types](https://www.sanity.io/docs/schema-types) to the schema to suit your needs.

### Cache invalidation and Functions

This template does not revalidate on a timer. Content changes propagate through
[Sanity Functions](https://www.sanity.io/docs/functions/functions-introduction),
which invalidate the exact queries whose results changed rather than everything of a
given document type.

Two things have to be true for that to work, and both are already wired up here:
queries must be tagged, and something must invalidate those tags when content changes.

#### How the pieces fit together

Queries run through `sanityFetch` from `defineLive`
(`packages/sanity/src/live.ts`), which tags every cache entry it writes with
`sanity:`-prefixed sync tags. The Next.js app runs with `cacheComponents: true` and
`cacheLife: { default: sanity }` (`apps/web/next.config.ts`), so those tags key the
cached route segments.

Invalidation then arrives by two independent paths:

| Path                                                          | Trigger                                       | Reaches                                                           |
| ------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------- |
| `<SanityLive>` &rarr; `revalidateSyncTags` server action      | Live Content API event in an open browser tab | Whoever currently has the page open, plus editors in Presentation |
| `invalidate-tags` Function &rarr; `/api/revalidate-sync-tags` | Any publish, server to server                 | Every visitor, including first paint on a cold route              |

The second path is the one that matters for cache cost, and it is the one most
templates leave out. The three files are:

```text
apps/studio/sanity.blueprint.ts                        declares the function
apps/studio/functions/invalidate-tags/index.ts         forwards sync tags, calls done()
apps/web/src/app/api/revalidate-sync-tags/route.ts     revalidates the tags
```

The blueprint declares the function and scopes it to a single dataset:

```ts
// apps/studio/sanity.blueprint.ts
defineSyncTagInvalidateFunction({
  name: "invalidate-tags",
  project: "xbiitlth",
  event: {
    resource: { type: "dataset", id: "xbiitlth.production" },
  },
})
```

The function receives the invalidated sync tags, forwards them to the Next.js app,
and then calls `done()`:

```ts
// apps/studio/functions/invalidate-tags/index.ts
const handler = syncTagInvalidateEventHandler(async ({ event, done }) => {
  const { syncTags } = event.data
  await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/revalidate-sync-tags`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.SANITY_REVALIDATE_SECRET}`,
    },
    body: JSON.stringify({ syncTags }),
  })
  await done(syncTags)
})
```

And the route validates the shared secret and revalidates:

```ts
// apps/web/src/app/api/revalidate-sync-tags/route.ts
for (const tag of syncTags as string[]) {
  revalidateTag(`sanity:${tag}`, { expire: 0 })
}
```

#### Three details that fail quietly

**The `sanity:` prefix is required.** `sanityFetch` stores its cache entries as
`sanity:${tag}`, so a call to `revalidateTag(tag)` without the prefix matches nothing.
The route still returns `200` and nothing is invalidated, which looks identical to a
working integration. Raw sync tags from the function event are unprefixed, so the route
adds the prefix; live events already carry it, which is why `parseTags` in
`apps/web/src/app/actions/revalidate.ts` keeps it instead.

**`done()` is not cleanup.** Calling it is what releases the invalidation to clients
subscribed to the Live Content API with `waitFor="function"` — which is exactly how
`<SanityLive>` is configured in `apps/web/src/app/layout.tsx`. If `done()` never
resolves, those clients never see the change. Wrap it in `try`/`catch` and log failures.

**One sync tag invalidate function per dataset.** Deploying more than one against the
same dataset causes race conditions and inflated usage. Scope the function with an
`event.resource` as shown above rather than letting it default to every dataset in the
project.

#### Environment variables

The sync tag flow needs two variables that the rest of the template does not:

| Variable                   | Where                               | Purpose                                                                                                             |
| -------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`     | Function environment                | Base URL the function posts to. Must be reachable from Sanity's infrastructure, so a deployed URL, not `localhost`. |
| `SANITY_REVALIDATE_SECRET` | Function environment and `apps/web` | Shared secret. The function sends it as a bearer token; the route rejects anything else with a `401`.               |

Set the same value for `SANITY_REVALIDATE_SECRET` in both places, or every invalidation
will be rejected.

#### Using this in your own project

The blueprint hardcodes the project ID `xbiitlth` in four places. Replace it with your
own project ID and dataset before deploying, otherwise the deploy targets a project you
do not own:

```ts
project: "your-project-id",
event: {
  resource: { type: "dataset", id: "your-project-id.production" },
},
```

#### The document function

`apps/studio/functions/auto-redirect` is a second, unrelated Function included as a
worked example. It creates a redirect document whenever a page's slug changes, and it is
worth reading as a model for how to keep a Function cheap: the blueprint filters at the
event level so the function only runs when the field actually changed, and the handler
early-returns on top of that.

```ts
// blueprint: only fire when this field changed
filter: "delta::changedAny(slug.current)",

// handler: bail out before doing any work
if (!(slug && beforeSlug)) return
if (slug === beforeSlug) return
```

Functions bill on invocations and GB-seconds, so a document function subscribed to
`create` and `update` with no filter and no early return will run on every edit,
including ones that change nothing it cares about.

### Deploying your application and inviting editors

#### 1. Deploy Sanity Studio

Your Next.js frontend (`/web`) and Sanity Studio (`/studio`) are still only running on your local computer. It's time to deploy and get it into the hands of other content editors.

> **⚠️ Important**: When initializing the template with the Sanity CLI, the `.github` folder may not be included or might be renamed to `github` (without the dot). If you don't see a `.github` folder in your project root, you'll need to manually create it and copy the GitHub Actions workflows from the [template repository](https://github.com/robotostudio/turbo-start-sanity/tree/main/.github) for the deployment automation to work.

The template includes a GitHub Actions workflow [`deploy-sanity.yml`](https://raw.githubusercontent.com/robotostudio/turbo-start-sanity/main/.github/workflows/deploy-sanity.yml) that automatically deploys your Sanity Studio whenever changes are pushed to the `studio` directory.

> **Note**: To use the GitHub Actions workflow, make sure to configure the following secrets in your repository settings:
>
> - `SANITY_DEPLOY_TOKEN`
> - `SANITY_STUDIO_PROJECT_ID`
> - `SANITY_STUDIO_DATASET`
> - `SANITY_STUDIO_TITLE`
> - `SANITY_STUDIO_PRESENTATION_URL`
> - `SANITY_STUDIO_APP_ID`

`SANITY_STUDIO_APP_ID` identifies your deployed Studio application. Run `npx sanity deploy` from `apps/studio` **locally** the first time — Sanity creates the application and gives you its app ID — then set `SANITY_STUDIO_APP_ID` to that value, both locally and in your GitHub repository secrets, so every later deploy targets the same Studio. The GitHub Actions workflow runs non-interactively (`CI: true`) and can't create the app for you, so that first deploy has to happen locally; until the secret is set, the CI deploy will fail. This replaces the deprecated `studioHost` / `*.sanity.studio` hostname setup ([details](https://www.sanity.io/docs/help/studio-host-user-applications)).

Set `SANITY_STUDIO_PRESENTATION_URL` to your web app front-end URL (from the Vercel deployment). This URL is required for production deployments and should be:

- Set in your GitHub repository secrets for CI/CD deployments
- Set in your local environment if deploying manually with `npx sanity deploy`
- Not needed for local development, where preview will automatically use `http://localhost:3000`

You can then manually deploy from your Studio directory (`/studio`) using:

```shell
npx sanity deploy
```

**Note**: To use the live preview feature, your browser needs to enable third party cookies.

#### 2. Deploy Next.js app to Vercel

You have the freedom to deploy your Next.js app to your hosting provider of choice. With Vercel and GitHub being a popular choice, we'll cover the basics of that approach.

1. Create a GitHub repository from this project. [Learn more](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github).
2. Create a new Vercel project and connect it to your Github repository.
3. Set the `Root Directory` to your Next.js app (`/apps/web`).
4. Configure your Environment Variables.

#### 3. Deploy Sanity Functions

The Functions live in a [blueprint](https://www.sanity.io/docs/blueprints/blueprints-introduction)
and deploy separately from the Studio. Nothing in the GitHub Actions workflow deploys
them, so this step is manual unless you add it to CI.

First, set the two environment variables the sync tag function needs:

```shell
cd apps/studio
npx sanity blueprints env add NEXT_PUBLIC_SITE_URL
npx sanity blueprints env add SANITY_REVALIDATE_SECRET
```

Then deploy the stack:

```shell
npx sanity blueprints deploy
```

Set the same `SANITY_REVALIDATE_SECRET` value in your Vercel project environment
variables so the route accepts what the function sends.

Publish a document and check that it worked:

```shell
npx sanity functions logs invalidate-tags
```

You should see the tag count and an HTTP status from your site, followed by the status
Sanity returned to `done()`. A `401` means the secret does not match on both sides. A
`404` usually means `NEXT_PUBLIC_SITE_URL` points somewhere without the route deployed.

To test locally before deploying, `npx sanity functions dev` opens a playground that
sends a dummy sync tag payload to the function without touching your usage quota.

#### 4. Configure CORS Origins

Your production URLs must be added to your Sanity project's CORS origins, otherwise the frontend will be blocked from fetching content.

1. Go to [Sanity Manage](https://www.sanity.io/manage), select your project, and navigate to **API** > **CORS origins**.
2. Add the following origins:
   - Your production URL (e.g. `https://your-app.vercel.app`)
   - Your custom domain if applicable (e.g. `https://yourdomain.com`)
   - `http://localhost:3000` (for local development — added by default)
3. Enable **Allow credentials** for each origin that needs authenticated requests (e.g. live preview, visual editing).

> **Note**: Vercel preview deployments use unique URLs per commit. If you need CORS access on preview deployments, add a wildcard origin like `https://*-your-project.vercel.app` or add specific preview URLs as needed.

#### 5. Invite a collaborator

Now that you've deployed your Next.js application and Sanity Studio, you can optionally invite a collaborator to your Studio. Open up [Manage](https://www.sanity.io/manage), select your project and click "Invite project members"

They will be able to access the deployed Studio, where you can collaborate together on creating content.
