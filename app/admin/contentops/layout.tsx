import { ContentOpsAuthShell } from "@/components/contentops/auth-shell";
import { ContentOpsNavLinks } from "@/components/contentops/nav-links";

export default function ContentOpsLayout({ children }: { children: React.ReactNode }) {
  const masterSheetId = process.env.CONTENTOPS_MASTER_SHEET_ID?.trim();
  const masterSheetUrl = masterSheetId ? `https://docs.google.com/spreadsheets/d/${masterSheetId}/edit` : null;
  return (
    <ContentOpsAuthShell>
      <header
        style={{
          borderBottom: "1px solid var(--border)",
          background: "var(--panel)",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "0.75rem 1.25rem",
            display: "flex",
            gap: "1rem",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <strong>ContentOps</strong>
          <ContentOpsNavLinks />
          {masterSheetUrl ? (
            <a href={masterSheetUrl} target="_blank" rel="noreferrer">
              Open master sheet
            </a>
          ) : null}
        </div>
      </header>
      <main style={{ maxWidth: 1100 }}>{children}</main>
    </ContentOpsAuthShell>
  );
}
