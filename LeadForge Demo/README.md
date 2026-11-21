# LeadForge AU — manager demo

A standalone, Vercel-ready product demo for a Melbourne prospect-intelligence workflow. It is intentionally separate from the existing plumbing and High Fire Heating sites.

## Demo contents

- Fictional prospect records, clearly labelled as sample data.
- Interactive prospect search, niche/stage filters and prospect drawer.
- Review trend and theme visualisations, website audit and opportunity notes.
- Discovery configuration with a simulated Google Maps / Apify run.
- An explicit approval checkbox before generating a sample website concept.
- A personalised pitch preview, simulated Hunter verification, and a final confirmation before the simulated Resend action.
- Sample pitch status can be changed to interested, accepted or declined.
- Local UI only: buttons do not call providers, use credits or deliver email.

## Run locally

Open `index.html` directly, or serve this folder with a static server. No build step is required.

## Deploy to Vercel

Import this folder as a new Vercel project, or run `vercel --prod` from this directory. Do not attach it to another website's existing Vercel project. The demo has no production API routes and requires no environment variables.

## Production integration plan

1. **Authentication and workspace membership:** add Supabase Auth and workspace roles; scope every query by workspace and enforce Row Level Security.
2. **Discovery:** create a server-side job endpoint that starts an Apify actor run. Store run state and actor dataset IDs; fetch results in pages, normalize public business data, deduplicate by provider place ID/domain/phone, and persist provenance and timestamps.
3. **Audits:** store original review references and capture dates. Keep machine-generated review-theme summaries clearly marked as analysis, with links to the source reviews. Fetch website pages through a controlled worker with rate limits and SSRF protections; audit mobile usability, accessibility, page speed and local SEO.
4. **Generation approval:** record the approving user, prospect, requested scope, estimated spend, maximum spend, prompt/model version and approval timestamp. Require approval and a budget ceiling on the server before generating. Use idempotency keys and job status so retries do not create duplicate paid generations.
5. **Demo sites:** generate an isolated preview under an unguessable, time-limited URL; add basic abuse controls and a removal/expiry policy. Do not publish to a prospect's domain without a separate explicit authorization.
6. **Email:** verify candidate addresses with Hunter, retain the result and timestamp, show the exact draft and intended recipient, then ask for final human confirmation. Send using Resend from a verified sender domain. Add business identity, unsubscribe/opt-out handling, suppression list, bounce/complaint webhooks, rate limits and an auditable send record before live outreach.
7. **Workflow orchestration:** connect Hermes only to authenticated, narrow server actions. Keep approvals, budget ceilings, email confirmation and audit logging enforced in the application server, not delegated to the agent.
8. **Secrets:** store provider credentials only in Vercel server-side environment variables. Never put Apify, Supabase service-role, Hunter, Resend or model keys in browser code. The Supabase anon key is public by design only when RLS is correctly enabled.

`supabase/schema.sql` is a starting relational schema, not an applied migration. Review it against the final auth, retention and consent model before production. Scraping, privacy, marketing consent and email outreach rules vary; confirm the appropriate Australian requirements before sending real campaigns.
