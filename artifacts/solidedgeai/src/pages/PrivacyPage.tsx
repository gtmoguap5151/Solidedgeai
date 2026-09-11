export default function PrivacyPage() {
  return (
    <div className="bg-stone-50 py-12 sm:py-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-10 shadow-sm">
          <h1 className="text-3xl sm:text-4xl font-bold text-stone-900">Privacy Policy</h1>
          <p className="mt-2 text-sm text-stone-500">Effective September 11, 2026</p>

          <div className="mt-8 space-y-7 text-stone-700 leading-relaxed">
            <section>
              <h2 className="text-xl font-bold text-stone-900">Information we collect</h2>
              <p className="mt-2">Solid Edge AI may collect information you choose to provide, such as your email address when you join our list or information needed to complete a purchase. Our free assessment currently processes the answers you enter in your browser to generate your report.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-stone-900">Payments</h2>
              <p className="mt-2">Payments are processed by Stripe. Solid Edge AI does not store full payment-card numbers. Stripe may collect payment and billing information under its own privacy practices.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-stone-900">How we use information</h2>
              <p className="mt-2">We use information to provide purchased products, operate and improve Solid Edge AI, respond to support requests, prevent fraud or abuse, and send updates when you have chosen to join our list.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-stone-900">Sharing</h2>
              <p className="mt-2">We may share information with service providers that help us operate the service, such as payment processing, hosting, database, email, analytics, and security providers. We do not sell your personal information as a standalone product.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-stone-900">Data retention and security</h2>
              <p className="mt-2">We retain information only as reasonably needed for business, legal, security, support, and transaction-record purposes. We use reasonable administrative and technical safeguards, but no internet service can guarantee absolute security.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-stone-900">Your choices</h2>
              <p className="mt-2">You may ask us to correct or delete personal information we control, subject to legal and transaction-record requirements. You may also unsubscribe from marketing communications at any time.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-stone-900">Contact</h2>
              <p className="mt-2">Questions about privacy can be sent to support@aiautomationforcontractors.com.</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
