import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms and Conditions" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="font-serif text-3xl font-semibold text-ink-900">Terms and Conditions</h1>
      <p className="mt-2 text-sm text-ink-500">Last updated: [DATE]</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-ink-700">
        <section>
          <h2 className="font-serif text-xl font-semibold text-ink-900">The service</h2>
          <p className="mt-2">
            RealityTV Intel (operated by [OPERATOR NAME], referred to as &quot;we&quot; or &quot;us&quot;) is a
            tracker that publishes reality television contestant information and Instagram follower statistics
            retrieved from public profile data. By using this site, you agree to these terms.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-ink-900">Accounts</h2>
          <p className="mt-2">
            The public tracker does not offer or require visitor accounts. A single administrator account exists
            for editing and publishing tracker data and is restricted to authorized operators of this site.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-ink-900">User responsibilities</h2>
          <p className="mt-2">
            You agree not to attempt to gain unauthorized access to the administrator workspace, interfere with
            the service, or use automated means to place excessive load on the site or its underlying Apify and
            GitHub integrations.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-ink-900">Content</h2>
          <p className="mt-2">
            Follower counts and related figures are retrieved from public Instagram profile data at the time of
            each refresh and may lag behind the live count shown on Instagram itself. Editorial information (such
            as status, tier, and biography text) reflects the tracker&apos;s own editorial judgment and is
            provided for informational purposes.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-ink-900">Ownership</h2>
          <p className="mt-2">
            The tracker&apos;s software, design, and original editorial content are owned by [OPERATOR NAME] or
            its licensors. Contestant names, show names, and Instagram content referenced by the tracker remain
            the property of their respective owners.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-ink-900">Restrictions</h2>
          <p className="mt-2">
            You may not reproduce, resell, or redistribute substantial portions of this site&apos;s data in a
            competing product without permission, other than through the export functionality provided for
            individual, non-commercial reference.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-ink-900">Availability</h2>
          <p className="mt-2">
            The service depends on third-party infrastructure, including Vercel for hosting, GitHub for data
            storage, and Apify for follower data retrieval. We do not guarantee uninterrupted availability of the
            service or of any third-party dependency it relies on.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-ink-900">Termination</h2>
          <p className="mt-2">
            We may suspend or discontinue the service, or an administrator&apos;s access to it, at any time,
            including in response to misuse.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-ink-900">Intellectual property</h2>
          <p className="mt-2">
            All trademarks, show names, and contestant names referenced on this site belong to their respective
            owners and are used for identification and editorial purposes only. No affiliation with or
            endorsement by any show, network, or contestant is implied.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-ink-900">Changes</h2>
          <p className="mt-2">
            We may update these terms from time to time. Continued use of the site after an update constitutes
            acceptance of the revised terms.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-ink-900">Governing law</h2>
          <p className="mt-2">These terms are governed by the laws of [JURISDICTION].</p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-ink-900">Contact</h2>
          <p className="mt-2">Questions about these terms can be sent to [CONTACT EMAIL].</p>
        </section>
      </div>
    </div>
  );
}
