import { NextRequest, NextResponse } from "next/server";
import { processPendingEmailDeliveries } from "@/lib/email";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const result = await processPendingEmailDeliveries(25);
  return NextResponse.json({ success: true, data: result });
}
