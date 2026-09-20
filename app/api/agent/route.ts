import { astraBrain } from "@/lib/brain/adapter";
import {
  errorResponse,
  guardRequest,
  parseAgentRequest,
  readJson,
} from "@/lib/brain/http";

export async function GET(request: Request) {
  try {
    guardRequest(request);
    return Response.json(await astraBrain.status());
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    guardRequest(request, true);
    const body = parseAgentRequest(await readJson(request));
    const options = { provider: body.provider, signal: request.signal };
    const result =
      body.mode === "execute"
        ? await astraBrain.execute(
            {
              input: body.message,
              approved: body.approved,
              approvalToken: body.approvalToken,
            },
            options,
          )
        : await astraBrain.chat(body.message, options);

    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
