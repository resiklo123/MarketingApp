import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <h1>Resiklo marketing</h1>
      <p className="co-muted">Public marketing pages live here.</p>
      <p>
        <Link href="/admin/contentops">Internal ContentOps dashboard</Link>
      </p>
    </main>
  );
}
