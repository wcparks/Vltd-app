// ============================================================
// PrivacyPage.jsx -- /privacy route
// Place at: src/components/PrivacyPage.jsx
//
// Add to your router in App.js:
//   if (path === '/privacy' || window.location.pathname === '/privacy') {
//     return <PrivacyPage />;
//   }
//
// Or React Router:
//   <Route path="/privacy" element={<PrivacyPage />} />
//
// Link from your customer ticket page Terms section:
//   <a href="/privacy">Privacy Policy</a>
// ============================================================

export default function PrivacyPage() {
  const effective = 'April 16, 2026';

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.logo}>VLTD</div>
        <h1 style={styles.title}>Privacy Policy</h1>
        <div style={styles.effective}>Effective: {effective}</div>

        <Section title="What We Collect">
          <p>When you use VLTD valet services, we collect only what is necessary to provide you with safe, efficient valet parking:</p>
          <ul>
            <li><strong>Name</strong> -- so valets can greet you personally (optional)</li>
            <li><strong>Phone number</strong> -- to notify you when your car is ready (optional, only used if SMS/WhatsApp is active)</li>
            <li><strong>Vehicle information</strong> -- make, model, color, and license plate to identify your car</li>
            <li><strong>Vehicle photos</strong> -- timestamped photos documenting your car's condition at check-in for your protection</li>
            <li><strong>Parking spot</strong> -- where your car is parked</li>
            <li><strong>Tip amount</strong> -- if you choose to tip your valet</li>
            <li><strong>Rating and review</strong> -- if you choose to leave feedback</li>
          </ul>
        </Section>

        <Section title="Why We Collect It">
          <ul>
            <li><strong>Ticket management</strong> -- to create, track, and retrieve your vehicle</li>
            <li><strong>Notifications</strong> -- to alert you when your car is ready</li>
            <li><strong>Liability protection</strong> -- timestamped photos protect both you and us in case of any dispute about your vehicle's condition</li>
            <li><strong>Service improvement</strong> -- ratings help us maintain quality</li>
          </ul>
        </Section>

        <Section title="How Long We Keep It">
          <div style={styles.retentionTable}>
            <RetentionRow item="Your name" period="90 days" />
            <RetentionRow item="Phone number" period="90 days" />
            <RetentionRow item="Vehicle info (make, model, plate)" period="90 days" />
            <RetentionRow item="Vehicle photos" period="90 days" />
            <RetentionRow item="Damage notes" period="90 days" />
            <RetentionRow item="Tip amounts" period="1 year (tax purposes)" />
            <RetentionRow item="Payment records" period="1 year (tax purposes)" />
            <RetentionRow item="Login logs" period="30 days" />
          </div>
          <p style={{ color: '#888', fontSize: 14 }}>
            We retain vehicle records for 90 days because damage disputes and insurance claims can surface weeks after an event. After 90 days, all ticket data is permanently and automatically deleted.
          </p>
        </Section>

        <Section title="What We Never Do">
          <ul>
            <li>? We never sell your personal information to third parties</li>
            <li>? We never use your data for advertising</li>
            <li>? We never store your payment card information (Stripe handles payments directly)</li>
            <li>? We never share your data with anyone outside of providing valet services</li>
          </ul>
        </Section>

        <Section title="Your Rights">
          <ul>
            <li><strong>Access</strong> -- you can request a copy of your data</li>
            <li><strong>Deletion</strong> -- you can request your data be deleted before the automatic 90-day expiry</li>
            <li><strong>Opt out</strong> -- name and phone number are optional; you can use VLTD without providing them</li>
          </ul>
          <p>To exercise any of these rights, speak with a valet manager at your event, or contact us directly.</p>
        </Section>

        <Section title="Data Security">
          <p>Your data is stored securely in Google Firebase, which uses industry-standard encryption. Access is restricted to authorized valet staff only. Vehicle photos and ticket information are protected and cannot be accessed by the general public.</p>
        </Section>

        <Section title="California Residents (CCPA)">
          <p>If you are a California resident, you have the right to know what personal information we collect, to request deletion, and to opt out of any sale of personal information. We do not sell personal information. For requests, contact us at your event.</p>
        </Section>

        <Section title="Changes to This Policy">
          <p>If we materially change this policy, we will update the effective date above. Continued use of VLTD valet services constitutes acceptance of the updated policy.</p>
        </Section>

        <div style={styles.footer}>
          <div style={styles.footerLogo}>VLTD</div>
          <div style={styles.footerText}>Questions? Ask your valet manager at the event.</div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid #eee' }}>{title}</h2>
      <div style={{ fontSize: 15, color: '#333', lineHeight: 1.7 }}>{children}</div>
    </div>
  );
}

function RetentionRow({ item, period }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f0f0', fontSize: 14 }}>
      <span>{item}</span>
      <span style={{ fontWeight: 600, color: '#888' }}>{period}</span>
    </div>
  );
}

const styles = {
  page: { background: '#f8f8f8', minHeight: '100vh', padding: '24px 16px', fontFamily: 'system-ui, sans-serif' },
  container: { maxWidth: 640, margin: '0 auto', background: '#fff', borderRadius: 20, padding: 28, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  logo: { fontSize: 12, fontWeight: 900, letterSpacing: 5, color: '#aaa', marginBottom: 16 },
  title: { fontSize: 28, fontWeight: 900, margin: '0 0 8px' },
  effective: { color: '#888', fontSize: 13, marginBottom: 28 },
  retentionTable: { background: '#f8f8f8', borderRadius: 10, padding: '4px 14px', marginBottom: 12 },
  footer: { marginTop: 32, paddingTop: 24, borderTop: '1px solid #eee', textAlign: 'center' },
  footerLogo: { fontSize: 14, fontWeight: 900, letterSpacing: 5, marginBottom: 8, color: '#1a1a1a' },
  footerText: { fontSize: 13, color: '#888' },
};
