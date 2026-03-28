import { NextRequest, NextResponse } from "next/server";
import { getTokensFromCode } from "@/lib/google-auth";
import { cookies } from "next/headers";
import { createPortfolio, getPortfolios } from "@/lib/gdrive";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=no_code", request.url));
  }

  try {
    const tokens = await getTokensFromCode(code);

    // Store tokens in httpOnly cookie
    const cookieStore = await cookies();
    cookieStore.set("google_tokens", JSON.stringify(tokens), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });

    // Check if user has any portfolios, if not create a default one
    try {
      const portfolios = await getPortfolios();
      if (portfolios.length === 0) {
        await createPortfolio({
          name: "My Portfolio",
          type: "Personal",
          cashBalance: 1000000,
        });
      }
    } catch {
      // First time — Drive operations may fail until next request
      // The default portfolio will be created on first portfolio access
    }

    return NextResponse.redirect(new URL("/dashboard", request.url));
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.redirect(
      new URL("/login?error=auth_failed", request.url)
    );
  }
}
