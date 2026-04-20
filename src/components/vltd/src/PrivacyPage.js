// ============================================================
// FILE: src/PrivacyPage.js
// PURPOSE: Public /privacy route — plain English privacy policy
// ADD TO ROUTER: <Route path="/privacy" element={<PrivacyPage />} />
// ============================================================

import React from "react";

export default function PrivacyPage() {
  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <span style={styles.logo}>VLTD</span>
          <h1 style={styles.title}>Privacy Policy</h1>
          <p style={styles.date}>Last updated: April 16, 2026</p>
        </div>

        <Section title="What We Collect">
          <p>When you use our valet service, we collect:</p>
          <ul>
            <li>Your first name (optional)</li>
            <li>Your phone number (optional — only if SMS is active)</li>
            <li>Your vehicle information: make, model, color, and license plate</li>
            <li>Photos of your vehicle taken at check-in</li>
            <li>Your rating and tip amount (if provided)</li>
            <li>Written review (if provided)</li>
          </ul>
          <p>We do <strong>not</strong> collect payment card numbers directly. Tips paid via card are processed by Stripe, which has its own privacy policy.</p>
        </Section>

        <Section title="Why We Collect It">
          <ul>
            <li><strong>Name &amp; phone</strong> — so we can alert you when your car is ready</li>
            <li><strong>Vehicle info</strong> — to identify and locate your car</li>
            <li><strong>Photos</strong> — to document your vehicle's condition at check-in for your protection and ours</li>
            <li><strong>Ratings &amp; reviews</strong> — to help us improve our service</li>
          </ul>
        </Section>

        <Section title="How Long We Keep It">
          <p>Your data is automatically deleted on the following schedule:</p>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Data Type</th>
                <th style={styles.th}>Retention</th>
                <th style={styles.th}>Reason</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Name, phone, car info", "90 days", "Damage disputes & insurance claims"],
                ["Vehicle photos", "90 days", "Liability documentation"],
                ["Damage notes", "90 days", "Legal protection"],
                ["Ticket records", "90 days", "Dispute resolution"],
                ["Tip & payment records", "1 year", "Tax compliance"],
                ["Login logs", "30 days", "Security audit"],
              ].map(([type, retention, reason]) => (
                <tr key={type}>
                  <td style={styles.td}>{type}</td>
                  <td style={styles.td}><strong>{retention}</strong></td>
                  <td style={styles.td}>{reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={styles.highlight}>
            After 90 days, all ticket data is permanently and automatically deleted from our systems.
          </p>
        </Section>

        <Section title="Who Sees Your Data">
          <ul>
            <li><strong>Valets</strong> — see your name, phone, and vehicle info to do their job</li>
            <li><strong>Managers</strong> — see all ticket data for the events they manage</li>
            <li><strong>You</strong> — can view your own ticket by scanning your QR code</li>
            <li><strong>Nobody else</strong> — we never sell, rent, or share your data with third parties</li>
          </ul>
        </Section>

        <Section title="Your Rights">
          <p>You have the right to:</p>
          <ul>
            <li><strong>Access</strong> your data — scan your QR code to see everything we have</li>
            <li><strong>Delete</strong> your data — text or call us and we'll remove your information immediately</li>
            <li><strong>Opt out</strong> — name and phone are optional; you can use the service anonymously</li>
          </ul>
          <p>
            To request deletion, contact us at: <a href="mailto:privacy@vltd.app" style={styles.link}>privacy@vltd.app</a>
          </p>
        </Section>

        <Section title="Cookies & Local Storage">
          <p>
            Your browser saves your name and phone number locally (on your own device only) so you don't have to re-enter it next time. This data never leaves your device unless you use it on a ticket. You can clear it anytime by clearing your browser data.
          </p>
        </Section>

        <Section title="Security">
          <p>
            All data is stored in Google Firebase, which uses industry-standard encryption in transit and at rest. Vehicle photos are stored as documented evidence and are write-once — they cannot be modified or deleted by valets.
          </p>
          <p>
            Our Firebase database has security rules that prevent unauthorized access. Only authenticated staff can access ticket data.
          </p>
        </Section>

        <Section title="California Residents (CCPA)">
          <p>
            If you are a California resident, you have the right to know what personal information we collect, request deletion, and opt out of sale (we don't sell data). Contact us to exercise these rights.
          </p>
        </Section>

        <Section title="Contact">
          <p>Questions about this policy? Reach us at:</p>
          <p>
            📧 <a href="mailto:privacy@vltd.app" style={styles.link}>privacy@vltd.app</a>
          </p>
        </Section>

        <div style={styles.footer}>
          <a href="/" style={styles.link}>← Back to App</a>
          <span style={styles.muted}> · </span>
          <a href="/terms" style={styles.link}>Terms &amp; Conditions</a>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section style={styles.section}>
      <h2 style={styles.sectionTitle}>{title}</h2>
      <div style={styles.sectionBody}>{children}</div>
    </section>
  );
}

const styles = {
  page: {
    background: "#0f172a",
    minHeight: "100vh",
    padding: "40px 20px",
    fontFamily: "Georgia, 'Times New Roman', serif",
    color: "#cbd5e1",
  },
  container: {
    maxWidth: 720,
    margin: "0 auto",
  },
  header: {
    textAlign: "center",
    marginBottom: 48,
    borderBottom: "1px solid #1e293b",
    paddingBottom: 32,
  },
  logo: {
    fontSize: 13,
    fontFamily: "monospace",
    letterSpacing: 6,
    color: "#64748b",
    display: "block",
    marginBottom: 16,
  },
  title: {
    fontSize: 36,
    fontWeight: 700,
    color: "#f1f5f9",
    margin: "0 0 8px",
    fontFamily: "Georgia, serif",
  },
  date: { color: "#64748b", fontSize: 14, margin: 0 },
  section: {
    marginBottom: 40,
    borderBottom: "1px solid #1e293b",
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: "#f1f5f9",
    marginBottom: 16,
    fontFamily: "Georgia, serif",
  },
  sectionBody: {
    lineHeight: 1.8,
    fontSize: 15,
  },
  highlight: {
    background: "#1e3a5f",
    borderLeft: "3px solid #3b82f6",
    padding: "12px 16px",
    borderRadius: "0 8px 8px 0",
    marginTop: 16,
    color: "#93c5fd",
    fontSize: 14,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    marginTop: 12,
    fontSize: 14,
  },
  th: {
    textAlign: "left",
    padding: "10px 12px",
    background: "#1e293b",
    color: "#94a3b8",
    fontWeight: 600,
    borderBottom: "1px solid #334155",
  },
  td: {
    padding: "10px 12px",
    borderBottom: "1px solid #1e293b",
    color: "#cbd5e1",
    verticalAlign: "top",
  },
  link: { color: "#3b82f6", textDecoration: "none" },
  footer: {
    textAlign: "center",
    marginTop: 48,
    paddingTop: 24,
    fontSize: 14,
  },
  muted: { color: "#475569" },
};
