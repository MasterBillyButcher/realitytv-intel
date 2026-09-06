export const metadata = { title: "Terms and Conditions — RealityTV Intel" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-14">
      <h1 className="text-3xl mb-6">Terms and Conditions</h1>
      <p className="text-sm mb-8" style={{ color: "var(--ink-soft)" }}>
        These terms govern use of RealityTV Intel (the &quot;Service&quot;). Business and legal details
        below marked in brackets should be filled in by the site operator before relying on this document.
      </p>

      <Section title="The service">
        <p>
          RealityTV Intel is an editorial tracker of reality television contestants and their public
          Instagram follower counts. It is provided on an as-is basis for informational purposes.
        </p>
      </Section>

      <Section title="Accounts">
        <p>
          The Service has a single administrative role, protected by a password set by the operator. There
          are no public user accounts.
        </p>
      </Section>

      <Section title="User responsibilities">
        <p>
          Anyone with access to the admin credentials is responsible for keeping them confidential and for
          the accuracy of data published through the admin editor.
        </p>
      </Section>

      <Section title="Content">
        <p>
          Contestant names, professions, and Instagram handles are drawn from public sources. Follower
          counts are retrieved from Instagram at the time of refresh and may not reflect real-time changes
          on Instagram itself.
        </p>
      </Section>

      <Section title="Ownership">
        <p>
          Original site design, code, and editorial text belong to the operator, [Operator legal name].
          Contestant names and likenesses remain the property of their respective owners and are referenced
          here for editorial and informational purposes only.
        </p>
      </Section>

      <Section title="Restrictions">
        <p>
          You may not attempt to circumvent admin authentication, scrape the Service at a rate that
          degrades it for others, or use published data to harass any individual featured on the tracker.
        </p>
      </Section>

      <Section title="Availability">
        <p>
          The Service is provided without uptime guarantees. Follower refresh and publishing features
          depend on third-party services (GitHub, Apify, Vercel) and may be temporarily unavailable if
          those services are unavailable.
        </p>
      </Section>

      <Section title="Termination">
        <p>The operator may suspend or discontinue the Service at any time.</p>
      </Section>

      <Section title="Intellectual property">
        <p>
          Except for third-party content (contestant likenesses, show names, and Instagram data), the
          Service&apos;s code and design are the property of the operator.
        </p>
      </Section>

      <Section title="Changes">
        <p>These terms may be updated from time to time. Continued use of the Service after a change constitutes acceptance of the revised terms.</p>
      </Section>

      <Section title="Governing law">
        <p>These terms are governed by the laws of [Governing jurisdiction], without regard to conflict-of-law principles.</p>
      </Section>

      <Section title="Contact">
        <p>Questions about these terms can be directed through the contact page linked in the footer.</p>
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
