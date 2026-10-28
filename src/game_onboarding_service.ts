import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { onboardGameStudio, onboardingRequestSchema } from "./domain_onboarding.js";
import { createInfraiClient, InfraiError } from "./infrai_client.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

const infrai = createInfraiClient(apiKey);
const port = Number(process.env.PORT ?? 3000);

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/studio-onboarding") {
    response.writeHead(404, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "not_found" }));
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const input = onboardingRequestSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const result = await onboardGameStudio(input, infrai, randomUUID());
    response.writeHead(result.state === "ready" ? 201 : 202, { "Content-Type": "application/json" });
    response.end(JSON.stringify(result));
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      response.writeHead(400, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "invalid_request" }));
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      response.writeHead(status, { "Content-Type": "application/json" }).end(
        JSON.stringify({ error: error.code, message: error.message }),
      );
      return;
    }
    response.writeHead(502, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "upstream_error" }));
  }
}).listen(port, () => console.log(`Game onboarding service listening on http://localhost:${port}`));
