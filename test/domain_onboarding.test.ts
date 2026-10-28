import assert from "node:assert/strict";
import test from "node:test";
import { onboardGameStudio, onboardingRequestSchema, type OnboardingRequest } from "../src/domain_onboarding.js";
import type { InfraiClient } from "../src/infrai_client.js";

const request: OnboardingRequest = {
  studioDomain: "studio.example",
  ownerEmail: "owner@studio.example",
  txtName: "_game-platform-verification",
  txtValue: "proof-123",
  assets: [{ id: "skin-7", kind: "skin" }],
  liveEvents: [{ id: "cup-1", startsAt: "2026-10-01T18:00:00.000Z" }],
  moderationQueue: [{ assetId: "skin-7", reason: "player upload" }],
};

test("onboarding stays pending and does not resolve the owner before domain proof", async () => {
  let ownerLookups = 0;
  const fakeInfrai = {
    addDomain: async () => ({ zone_id: "zone-42" }),
    upsertTxt: async (body: { zone_id: string }) => {
      assert.equal(body.zone_id, "zone-42");
      return { record_id: "record-9" };
    },
    verifyDomain: async () => ({ verified: false }),
    getUserByEmail: async () => {
      ownerLookups += 1;
      return { id: "user-1", email: request.ownerEmail };
    },
  } as InfraiClient;

  const result = await onboardGameStudio(request, fakeInfrai, "attempt-1");
  assert.deepEqual(result, { state: "awaiting_domain_proof", domain: "studio.example" });
  assert.equal(ownerLookups, 0);
});

test("request validation binds the owner to the domain being proven", () => {
  const result = onboardingRequestSchema.safeParse({ ...request, ownerEmail: "owner@another.example" });
  assert.equal(result.success, false);
});
