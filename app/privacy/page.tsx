import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="font-serif text-3xl font-semibold text-ink-900">Privacy Policy</h1>
      <p className="mt-2 text-sm text-ink-500">Last updated: [DATE]</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-ink-700">
        <section>
          <h2 className="font-serif text-xl font-semibold text-ink-900">Who this policy covers</h2>
          <p className="mt-2">
            This policy describes how RealityTV Intel (the tracker, operated by [OPERATOR NAME]) handles
            information. The public tracker does not require visitors to create an account, log in, or provide
            personal information to browse contestant data, rankings, or exports.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-ink-900">Account information</h2>
          <p className="mt-2">
            There are no public user accounts. The only account-like credential in this application is a single
            administrator password, configured by the site operator as an environment variable and never stored in
            the codebase or displayed to visitors.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-ink-900">Admin authentication</h2>
          <p className="mt-2">
            When an administrator signs in, the server verifies the submitted password against a server-side
            configuration value and, if correct, issues a signed session cookie. The cookie contains only an
            expiration timestamp and a cryptographic signature. It does not contain the password and cannot be
            read or reused without the server&apos;s secret key. The cookie is HTTP-only, marked secure in
            production, and expires automatically.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-ink-900">Tracker information</h2>
          <p className="mt-2">
            The tracker publishes information about reality television contestants: name, show, status, tier,
            profession, publicly stated biography details, an Instagram handle, and follower counts retrieved from
            that public Instagram profile. This information concerns public figures in their public capacity as
            contestants on broadcast reality television programs, and the Instagram data reflects only publicly
            visible profile statistics.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-ink-900">Local storage</h2>
          <p className="mt-2">
            When an administrator is editing tracker data, unpublished draft edits are saved in the
            administrator&apos;s own browser using local storage, so in-progress edits survive a page refresh
            before they are published. This draft data stays on the administrator&apos;s device and is not sent
            anywhere until the administrator chooses to publish.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-ink-900">Cookies</h2>
          <p className="mt-2">
            The only cookie set by this application is the administrator session cookie described above. Public
            visitors browsing the tracker are not issued any cookies by this application.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-ink-900">GitHub</h2>
          <p className="mt-2">
            Published tracker data is stored as a file in a GitHub repository, which also provides the version
            history of every published change. When an administrator publishes an update, the server sends the
            updated tracker data to GitHub using a private access token that is never exposed to the browser.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-ink-900">Apify</h2>
          <p className="mt-2">
            To retrieve real Instagram follower counts, the server sends the Instagram handle being refreshed to
            Apify, a third-party web data platform, using a private access token. Apify&apos;s own privacy
            practices govern its processing of that request. This application does not send any information about
            site visitors to Apify, only the Instagram handles that an administrator chooses to refresh.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-ink-900">Vercel</h2>
          <p className="mt-2">
            This application is hosted on Vercel. Vercel processes standard web request data (such as IP address
            and request metadata) as part of operating its hosting infrastructure, in accordance with
            Vercel&apos;s own privacy practices.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-ink-900">Server logs</h2>
          <p className="mt-2">
            Standard operational logs may record request metadata (such as timestamps, request paths, and response
            statuses) for debugging and reliability purposes. Passwords, session secrets, and access tokens are
            never logged.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-ink-900">Data retention</h2>
          <p className="mt-2">
            Published tracker data is retained in the GitHub repository indefinitely as part of its version
            history, the same way any file in a Git repository is retained, unless the repository owner removes
            it. Draft edits in browser local storage remain until the administrator publishes, clears them, or
            clears their browser storage.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-ink-900">Security</h2>
          <p className="mt-2">
            Administrator authentication uses a signed, time-limited session cookie. Access tokens for GitHub and
            Apify are stored only as server-side environment variables and are never sent to the browser. All
            outbound requests to GitHub and Apify use enforced timeouts so a slow or unresponsive third party
            cannot leave the application in an indefinite loading state.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-ink-900">User rights</h2>
          <p className="mt-2">
            If a contestant featured on the tracker has questions about the information published about them,
            including requests for correction, they may use the contact details below.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-ink-900">Contact</h2>
          <p className="mt-2">Questions about this policy can be sent to [CONTACT EMAIL].</p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-ink-900">Changes to this policy</h2>
          <p className="mt-2">
            This policy may be updated as the application&apos;s functionality changes. The &quot;Last
            updated&quot; date at the top of this page reflects the most recent revision.
          </p>
        </section>
      </div>
    </div>
  );
}
