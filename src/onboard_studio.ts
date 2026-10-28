import { createInfraiClient } from "./infrai_client.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before running the example");

const domain = "changba.com";
const ownerEmail = "chenhua@changba.com";
const infrai = createInfraiClient(apiKey);

const proof = await infrai.verifyDomain({ domain });
if (!proof.verified) {
  console.log(JSON.stringify({ state: "awaiting_domain_proof", domain }, null, 2));
  process.exit(0);
}

const owner = await infrai.getUserByEmail(ownerEmail);
console.log(JSON.stringify({ state: "ready", owner: { id: owner.id, email: owner.email } }, null, 2));
