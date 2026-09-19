import { NextResponse } from "next/server";
import { astraBrain } from "@/lib/brain/adapter";
import type { AgentRequest } from "@/lib/agent/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<AgentRequest>;
    const message = body.message?.trim();

    if (!message) {
      return NextResponse.json(
        { ok: false, error: "message is required" },
        { status: 400 },
      );
    }

    if (message.length > 4000) {
      return NextResponse.json(
        { ok: false, error: "message is too long" },
        { status: 413 },
      );
    }

    const result = await astraBrain.chat(message);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid request" },
      { status: 400 },
    );
  }
}
