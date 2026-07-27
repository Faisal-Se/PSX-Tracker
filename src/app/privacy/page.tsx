import Link from "next/link";
import { LegalShell, H, P, UL, LI, B, Code, A } from "@/components/legal";

export const metadata = {
  title: "Privacy Policy · PSX Tracker",
  description: "How PSX Tracker handles your data.",
};

const UPDATED = "27 July 2026";
const CONTACT = "faisalqayyum.se@gmail.com";

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated={UPDATED}>
      <P>
        PSX Tracker (&ldquo;the app&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) is a personal
        Pakistan Stock Exchange (PSX) portfolio tracker and virtual-trading tool. This policy
        explains what data the app accesses, how it is used, and how it is stored. We have tried
        to keep it plain and honest.
      </P>

      <H>The short version</H>
      <P>
        Your portfolio data is stored in <B>your own Google Drive</B>, not on our servers. We do
        not sell your data, we do not run ads, and we do not share your information with third
        parties. The app exists to show you your own PSX portfolio.
      </P>

      <H>What we access, and why</H>
      <P>When you sign in with Google, the app requests the following:</P>
      <UL>
        <LI>
          <B>Your name, email address, and profile picture</B> (Google scopes{" "}
          <Code>userinfo.profile</Code> and <Code>userinfo.email</Code>) — used only to identify
          your account, greet you in the app, and show your avatar. We do not email you.
        </LI>
        <LI>
          <B>A private application-data folder in your Google Drive</B> (Google scope{" "}
          <Code>drive.appdata</Code>) — the app stores your portfolios, holdings, model
          portfolios, watchlist, and transaction history here as JSON files. This is a hidden,
          app-specific folder: the app <B>cannot see, read, or modify any of your other Google
          Drive files</B>, and other apps cannot read the folder created by this app.
        </LI>
      </UL>
      <P>
        We request only these scopes — the minimum needed for the app to function. We never request
        access to your full Drive, your contacts, your email content, or any other Google service.
      </P>

      <H>Where your data lives</H>
      <P>
        All portfolio and account data is written to the private app-data folder in{" "}
        <B>your</B> Google Drive. It is not copied to, or persisted on, any server we control. When
        the app needs to show your portfolio, it reads these files directly from your Drive using
        the access you granted, and writes them back when you make a change (for example, recording
        a trade).
      </P>
      <P>
        Live market data (KSE-100 index values, stock prices, and price history) is fetched from the
        public Pakistan Stock Exchange data service (<Code>dps.psx.com.pk</Code>). This is public
        market information and contains none of your personal data.
      </P>

      <H>Authentication tokens</H>
      <P>
        To keep you signed in, the app stores your Google session token in a secure, HTTP-only
        cookie in your browser. This token is used solely to read and write your own Drive app-data
        folder and to fetch your basic profile. You can revoke the app&rsquo;s access at any time
        (see below), which invalidates this access.
      </P>

      <H>What we do NOT do</H>
      <UL>
        <LI>We do not sell, rent, or trade your personal information.</LI>
        <LI>We do not use your data for advertising or profiling.</LI>
        <LI>We do not share your data with third parties.</LI>
        <LI>We do not access any Google data beyond the scopes listed above.</LI>
        <LI>
          We do not use Google user data to develop, improve, or train generalized/non-personalized
          AI or machine-learning models.
        </LI>
      </UL>

      <H>Google API Services User Data Policy</H>
      <P>
        PSX Tracker&rsquo;s use and transfer of information received from Google APIs adheres to the{" "}
        <A href="https://developers.google.com/terms/api-services-user-data-policy">
          Google API Services User Data Policy
        </A>
        , including the Limited Use requirements.
      </P>

      <H>Your control and data deletion</H>
      <P>
        Because your data lives in your own Google Drive, you are always in control of it. You can:
      </P>
      <UL>
        <LI>Delete individual portfolios, holdings, or transactions from within the app.</LI>
        <LI>
          Revoke the app&rsquo;s access entirely at{" "}
          <A href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</A>.
          This immediately stops all access.
        </LI>
        <LI>
          Delete the app&rsquo;s stored data by removing the hidden application-data folder for this
          app in your Google Drive, or by requesting deletion via the contact email below.
        </LI>
      </UL>

      <H>Children</H>
      <P>
        The app is not directed to children under 13 and does not knowingly collect data from them.
      </P>

      <H>Changes to this policy</H>
      <P>
        If this policy changes, we will update the date at the top of this page. Continued use of the
        app after a change constitutes acceptance of the updated policy.
      </P>

      <H>Contact</H>
      <P>
        Questions, concerns, or data-deletion requests:{" "}
        <A href={`mailto:${CONTACT}`}>{CONTACT}</A> (Faisal Qayyum).
      </P>

      <p className="mt-10 text-[13px] text-ink-3">
        See also our{" "}
        <Link href="/terms" className="font-medium text-brand hover:underline">
          Terms of Service
        </Link>
        .
      </p>
    </LegalShell>
  );
}
