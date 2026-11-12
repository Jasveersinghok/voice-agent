import { AccessToken, AgentDispatchClient } from "livekit-server-sdk";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const identity = body.identity || `seller-${Math.random().toString(36).substring(2, 8)}`;
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL;

    if (!apiKey || !apiSecret || !livekitUrl) {
      return NextResponse.json(
        {
          error:
            "LiveKit credentials missing. Ensure LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_URL are configured in .env.local",
        },
        { status: 500 }
      );
    }

    const roomName = body.roomName || `kam-session-${Date.now()}`;
    const agentName = body.agentName || "kam-agent";

    // Create participant access token
    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name: body.agentName ? `${identity} (${body.agentName})` : identity,
      ttl: "2h",
    });

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    // Automatically dispatch agent to this room if not already running in dev mode
    try {
      const httpUrl = livekitUrl.replace(/^wss:\/\//, "https://").replace(/^ws:\/\//, "http://");
      const dispatchClient = new AgentDispatchClient(httpUrl, apiKey, apiSecret);
      await dispatchClient.createDispatch(roomName, agentName);
      console.log(`[Token API] Dispatched agent '${agentName}' to room '${roomName}'`);
    } catch (dispatchErr: any) {
      // Non-fatal: if agent is registered via local dev mode, it joins via job assignment automatically
      console.warn(`[Token API] Agent dispatch note: ${dispatchErr?.message || dispatchErr}`);
    }

    return NextResponse.json({
      token,
      url: livekitUrl,
      roomName,
    });
  } catch (error: any) {
    console.error("Token generation error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate access token" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return POST(new Request("http://localhost/api/token", { method: "POST", body: "{}" }));
}
