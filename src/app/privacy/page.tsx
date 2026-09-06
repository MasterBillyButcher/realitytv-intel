export const metadata = { title: "Privacy Policy — RealityTV Intel" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-14 prose-content">
      <h1 className="text-3xl mb-6">Privacy Policy</h1>
      <p className="text-sm mb-8" style={{ color: "var(--ink-soft)" }}>
        This policy describes what RealityTV Intel actually collects and how it is used. It does not
        describe hypothetical or planned data collection.
      </p>

      <Section title="Public visitors">
        <p>
          Browsing the public tracker does not require an account and does not collect personal
          information beyond standard server logs described below.
        </p>
      </Section>

      <Section title="Admin authentication">
        <p>
          The admin editor is protected by a single shared password configured by the site operator. On
          successful login, the server issues a signed session cookie. The cookie contains no personal
          information: it stores a role marker and an expiration timestamp, cryptographically signed so it
          cannot be forged. The cookie expires automatically and can be cleared at any time by logging out.
        </p>
      </Section>

      <Section title="Local storage">
        <p>
          The admin editor stores an in-progress draft of tracker edits in your browser&apos;s local
          storage so unsaved changes survive a page reload. This data stays on your device and is not sent
          anywhere until you choose to publish it.
        </p>
      </Section>

      <Section title="Cookies">
        <p>
          The only cookie set by this application is the admin session cookie described above. It is not
          used for analytics, advertising, or tracking, and it is not set for visitors who do not log in.
        </p>
      </Section>

      <Section title="GitHub">
        <p>
          Published tracker data (contestant records, show records, and follower history) is stored in a
          GitHub repository and updated through the GitHub API when an admin publishes changes. This data
          concerns public reality television contestants and their public Instagram follower counts, not
          site visitors.
        </p>
      </Section>

      <Section title="Apify">
        <p>
          Follower counts are retrieved using Apify, a third-party web data platform, which fetches
          publicly available Instagram profile data for the handles configured in the tracker. No visitor
          data is sent to Apify.
        </p>
      </Section>

      <Section title="Vercel and server logs">
        <p>
          The application is hosted on Vercel, which may retain standard infrastructure logs (such as
          request timestamps, IP addresses, and response codes) for operational and security purposes,
          consistent with Vercel&apos;s own hosting practices.
        </p>
      </Section>

      <Section title="Data retention">
        <p>
          Published tracker data is retained in the GitHub repository&apos;s history indefinitely, as with
          any version-controlled file. Session cookies expire automatically. Local drafts remain only in
          your browser until cleared.
        </p>
      </Section>

      <Section title="Security">
        <p>
          Admin authentication uses a signed, expiring session cookie served over HTTPS in production.
          Server-only credentials (the admin password, session signing secret, GitHub token, and Apify
          token) are never exposed to the browser.
        </p>
      </Section>

      <Section title="Your rights">
        <p>
          If you are a contestant or represent a contestant featured on this tracker and have a question
          about the information shown, use the contact details on this site to reach the operator.
        </p>
      </Section>

      <Section title="Contact">
        <p>Questions about this policy can be directed through the contact page linked in the footer.</p>
      </Section>

      <Section title="Changes to this policy">
        <p>
          This policy may be updated as the application changes. The version in the repository at any
          given time reflects the current implementation.
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-xl mb-2">{title}</h2>
      <div className="text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>
        {children}
      </div>
    </section>
  );
}
