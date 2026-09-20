import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (process.env.NODE_ENV !== "production") {
      console.error("client-error", body);
    } else {
      console.error("client-error", {
        message: body?.message,
        digest: body?.digest,
        route: body?.route,
        locale: body?.locale,
        occurredAt: body?.occurredAt,
      });
    }
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

