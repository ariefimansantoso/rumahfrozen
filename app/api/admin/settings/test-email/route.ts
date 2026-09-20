import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { connectDB } from "@/lib/db";
import { getSettings } from "@/models";
import { auth, reloadAuthInstance } from "@/lib/auth";
import { USER_ROLES } from "@/config/app.config";
import {
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_STORE_NAME,
} from "@/config/branding.config";
import { createSmtpTransport, sendEmail } from "@/lib/email";
import { getSmtpConfigurationFingerprint } from "@/lib/smtp-verification";
import { getDemoModeMutationResponse } from "@/lib/demo-mode";

/**
 * POST /api/admin/settings/test-email
 * Test SMTP configuration by sending a test email
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json(
        { success: false, message: "Authentication required" },
        { status: 401 },
      );
    }
    if (session.user.role !== USER_ROLES.ADMIN) {
      return NextResponse.json(
        { success: false, message: "Admin access required" },
        { status: 403 },
      );
    }
    const demoBlock = getDemoModeMutationResponse();
    if (demoBlock) return demoBlock;

    await connectDB();

    const body = await request.json();
    const { testEmail } = body;

    if (
      typeof testEmail !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail.trim())
    ) {
      return NextResponse.json(
        { success: false, message: "A valid test email address is required" },
        { status: 400 },
      );
    }

    const settings = await getSettings();

    // Resolve SMTP config from DB settings with per-field .env fallback.
    const transport = createSmtpTransport(settings);
    if (!transport) {
      return NextResponse.json(
        {
          success: false,
          message:
            "SMTP is not configured. Please fill in the SMTP settings (or set SMTP_* in your environment) first.",
        },
        { status: 400 },
      );
    }

    const { config: smtp } = transport;
    const storeName = settings.general?.storeName || DEFAULT_STORE_NAME;
    const primaryColor =
      settings.appearance?.primaryColor || DEFAULT_PRIMARY_COLOR;

    // Send test email
    const sent = await sendEmail({
      to: testEmail.trim(),
      subject: `Test Email from ${storeName}`,
      settings,
      category: "smtp-test",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: ${primaryColor};">Email Configuration Test</h2>
          <p>This is a test email from <strong>${storeName}</strong>.</p>
          <p>If you received this email, your SMTP configuration is working correctly!</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #666; font-size: 12px;">
            Sent from ${storeName} Admin Panel
          </p>
        </div>
      `,
    });

    if (!sent) {
      return NextResponse.json(
        {
          success: false,
          message:
            "SMTP test failed. Check the sanitized delivery log for the provider response.",
        },
        { status: 502 },
      );
    }

    const fingerprint = getSmtpConfigurationFingerprint(settings);
    if (!fingerprint) {
      return NextResponse.json(
        {
          success: false,
          message:
            "SMTP test succeeded, but its configuration could not be verified securely. Configure BETTER_AUTH_SECRET and retry.",
        },
        { status: 500 },
      );
    }
    settings.security.smtpVerifiedAt = new Date();
    settings.security.smtpVerificationFingerprint = fingerprint;
    await settings.save();

    const requestedFrom = settings.email?.fromEmail?.trim();
    const authenticatedAs = smtp.auth.user.trim().toLowerCase();
    const aliasWarning =
      smtp.host.toLowerCase().includes("gmail") &&
      requestedFrom &&
      requestedFrom.toLowerCase() !== authenticatedAs
        ? ` Confirm that ${requestedFrom} appears as the From address in the received message; otherwise authorize it as a Gmail sender alias.`
        : "";

    // A successful transport test makes verification enforcement eligible.
    await reloadAuthInstance();

    return NextResponse.json({
      success: true,
      message: `Test email sent successfully using ${smtp.port === 465 ? "implicit TLS" : smtp.port === 587 ? "STARTTLS" : `SMTP port ${smtp.port}`}.${aliasWarning}`,
    });
  } catch (error: unknown) {
    console.error("Failed to run SMTP test:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to run SMTP test. Check the server and sanitized delivery logs.",
      },
      { status: 500 },
    );
  }
}
