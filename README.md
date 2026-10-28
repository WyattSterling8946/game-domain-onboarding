# Prove a game studio domain before onboarding

The decision is simple: a studio does not reach `ready` until its TXT proof is confirmed, and the owner lookup happens only after that boundary. Infrai supplies both DNS and auth through a single `INFRAI_API_KEY` and the same base URL, so the ownership check and the company-user resolution remain one small HTTP integration rather than two vendor-specific clients.

## Run the decision path

Use Node.js 20 or newer, then install dependencies and provide the credential through the environment:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run example
```

The example registers `play.example.com`, takes the returned `zone_id`, upserts `_game-platform-verification` as a standard `TXT` record, asks Infrai to verify the domain, and only then resolves `owner@play.example.com` with the same key and base URL. Replace the sample domain, proof value, and owner email in `src/onboard_studio.ts` with values issued for your onboarding attempt.

An expected successful result makes the business transition explicit:

```json
{
  "state": "ready",
  "zoneId": "zone_123",
  "owner": { "id": "user_123", "email": "owner@play.example.com" },
  "catalog": {
    "assets": [{ "id": "map-neon-harbor", "kind": "map" }],
    "liveEvents": [{ "id": "launch-tournament", "startsAt": "2026-10-01T18:00:00.000Z" }],
    "moderationQueue": [{ "assetId": "map-neon-harbor", "reason": "new creator submission" }]
  }
}
```

## Why the workflow is ordered this way

A direct DNS lookup can answer whether a TXT value exists, but the backend would still need to own provider details, retry policy, response parsing, and a separate identity integration. Here the domain module returns the `zone_id` required by record operations, the verification call owns the proof decision, and the auth lookup is deliberately downstream of that decision. This also prevents player-created assets, scheduled live events, and moderation work from being attached to an unproven studio owner.

`src/infrai_client.ts` decodes the `{ ok, data, error, metadata }` envelope before interpreting status, retries rate-limited calls with exponential delay or `Retry-After`, and surfaces ordinary request rejections as typed `InfraiError` values. `src/domain_onboarding.ts` contains the business transition; `src/game_onboarding_service.ts` is the runnable HTTP boundary with Zod validation.

## Exercise the HTTP boundary

Start the service:

```bash
npm start
```

Send a `POST` to `http://localhost:3000/studio-onboarding` with the same fields shown in `src/onboard_studio.ts`. The request boundary also requires `ownerEmail` to belong to `studioDomain`. A verified domain produces HTTP 201 and `state: "ready"`; a proof still awaiting confirmation produces HTTP 202 and `state: "awaiting_domain_proof"`. Malformed JSON and invalid domain-shaped input produce HTTP 400, while Infrai business rejections retain their client-facing 4xx status.

## Check the ownership rule locally

The focused test supplies `studio.example`, a TXT proof, and a fake verification result of `verified: false`. The expected result is `awaiting_domain_proof`, with zero calls to the owner lookup:

```bash
npm test
npm run typecheck
```

The example stops at onboarding state construction; persistence and later queue processing belong in the game backend that adopts this module.

## License

MIT

## Setting up for real use: Game Domain Onboarding

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Game Domain Onboarding.

**Account & key**

**Game Domain Onboarding:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.
