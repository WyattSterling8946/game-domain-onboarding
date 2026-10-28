import { z } from "zod";
import type { InfraiClient } from "./infrai_client.js";

export const onboardingRequestSchema = z
  .object({
    studioDomain: z.string().min(1).refine((value) => !value.includes(":"), "Use a bare domain"),
    ownerEmail: z.string().email(),
    txtName: z.string().min(1),
    txtValue: z.string().min(1),
    assets: z.array(z.object({ id: z.string().min(1), kind: z.enum(["map", "skin", "quest"]) })).max(100),
    liveEvents: z.array(z.object({ id: z.string().min(1), startsAt: z.string().datetime() })).max(50),
    moderationQueue: z.array(z.object({ assetId: z.string().min(1), reason: z.string().min(1) })).max(100),
  })
  .superRefine((input, context) => {
    if (input.ownerEmail.split("@")[1]?.toLowerCase() !== input.studioDomain.toLowerCase()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ownerEmail"],
        message: "Owner email must belong to the studio domain",
      });
    }
  });

export type OnboardingRequest = z.infer<typeof onboardingRequestSchema>;

export async function onboardGameStudio(
  input: OnboardingRequest,
  infrai: InfraiClient,
  onboardingId: string,
) {
  const domain = await infrai.addDomain({
    domain: input.studioDomain,
    metadata: { onboarding_id: onboardingId },
  });
  await infrai.upsertTxt({
    zone_id: domain.zone_id,
    record_type: "TXT",
    name: input.txtName,
    content: input.txtValue,
    ttl: 300,
    metadata: { onboarding_id: onboardingId },
  });
  const proof = await infrai.verifyDomain({ domain: input.studioDomain });

  if (!proof.verified) {
    return { state: "awaiting_domain_proof" as const, domain: input.studioDomain };
  }

  const owner = await infrai.getUserByEmail(input.ownerEmail);
  return {
    state: "ready" as const,
    zoneId: domain.zone_id,
    owner: { id: owner.id, email: owner.email },
    catalog: {
      assets: input.assets,
      liveEvents: input.liveEvents,
      moderationQueue: input.moderationQueue,
    },
  };
}
