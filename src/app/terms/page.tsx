import Link from "next/link";
import { LegalShell, H, P, UL, LI, B, A } from "@/components/legal";

export const metadata = {
  title: "Terms of Service · PSX Tracker",
  description: "The terms for using PSX Tracker.",
};

const UPDATED = "27 July 2026";
const CONTACT = "faisalqayyum.se@gmail.com";

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated={UPDATED}>
      <P>
        By using PSX Tracker (&ldquo;the app&rdquo;), you agree to these terms. If you do not agree,
        please do not use the app.
      </P>

      <H>What the app is</H>
      <P>
        PSX Tracker is a free, personal tool for tracking a Pakistan Stock Exchange (PSX) portfolio
        and practising virtual trading. All trading in the app is <B>simulated</B> — it uses virtual
        cash and does not place real orders, move real money, or connect to any brokerage.
      </P>

      <H>Not financial advice</H>
      <P>
        The app is provided for informational and educational purposes only. Nothing in the app is
        financial, investment, tax, or legal advice, or a recommendation to buy or sell any
        security. Market data may be delayed, incomplete, or inaccurate. You are solely responsible
        for any decisions you make. Always do your own research and consult a licensed professional
        before making real investment decisions.
      </P>

      <H>Market data</H>
      <P>
        Live prices, the KSE-100 index, and price history are sourced from the public Pakistan Stock
        Exchange data service and are provided <B>&ldquo;as is&rdquo;</B>, without warranty of
        accuracy, completeness, or timeliness. The app is not affiliated with, endorsed by, or
        operated by the Pakistan Stock Exchange.
      </P>

      <H>Your account and data</H>
      <UL>
        <LI>You sign in with your Google account, and your data is stored in your own Google Drive.</LI>
        <LI>You are responsible for keeping your Google account secure.</LI>
        <LI>
          How we handle your data is described in our{" "}
          <Link href="/privacy" className="font-medium text-brand hover:underline">
            Privacy Policy
          </Link>
          .
        </LI>
      </UL>

      <H>Acceptable use</H>
      <P>
        You agree not to misuse the app — including attempting to disrupt or overload it, access data
        that is not yours, or use it for any unlawful purpose.
      </P>

      <H>Availability</H>
      <P>
        The app is provided free of charge with no guarantee of availability or uptime. It may be
        changed, suspended, or discontinued at any time. Because your data lives in your own Google
        Drive, it remains yours regardless of the app&rsquo;s availability.
      </P>

      <H>Limitation of liability</H>
      <P>
        To the fullest extent permitted by law, the app and its developer are not liable for any
        loss or damage arising from your use of the app, including any decisions made based on data
        shown in the app. The app is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;
        without warranties of any kind.
      </P>

      <H>Changes to these terms</H>
      <P>
        We may update these terms and will revise the date at the top of this page. Continued use of
        the app after a change means you accept the updated terms.
      </P>

      <H>Contact</H>
      <P>
        Questions about these terms: <A href={`mailto:${CONTACT}`}>{CONTACT}</A> (Faisal Qayyum).
      </P>

      <p className="mt-10 text-[13px] text-ink-3">
        See also our{" "}
        <Link href="/privacy" className="font-medium text-brand hover:underline">
          Privacy Policy
        </Link>
        .
      </p>
    </LegalShell>
  );
}
