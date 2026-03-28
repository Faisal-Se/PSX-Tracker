import { google } from "googleapis";
import { cookies } from "next/headers";

const SCOPES = [
  "https://www.googleapis.com/auth/drive.appdata",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function getAuthUrl(): string {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });
}

export async function getTokensFromCode(code: string) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export async function getAuthenticatedClient() {
  const cookieStore = await cookies();
  const tokensCookie = cookieStore.get("google_tokens")?.value;

  if (!tokensCookie) return null;

  try {
    const tokens = JSON.parse(tokensCookie);
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials(tokens);

    // Check if access token is expired and refresh if needed
    if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
      if (!tokens.refresh_token) return null;
      const { credentials } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(credentials);

      // Update cookie with new tokens
      const newTokens = { ...tokens, ...credentials };
      cookieStore.set("google_tokens", JSON.stringify(newTokens), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: "/",
      });
    }

    return oauth2Client;
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const client = await getAuthenticatedClient();
  if (!client) return null;

  try {
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const { data } = await oauth2.userinfo.get();
    return {
      id: data.id!,
      name: data.name || "User",
      email: data.email || "",
      picture: data.picture || "",
    };
  } catch {
    return null;
  }
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete("google_tokens");
}
