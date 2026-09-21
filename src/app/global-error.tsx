"use client";

import { useEffect } from "react";

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("Application shell failed", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#f7f9f2", color: "#17211b", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
          <section role="alert" style={{ width: "min(100%, 480px)", border: "1px solid #d9e1d6", borderRadius: 16, background: "white", padding: 32, textAlign: "center" }}>
            <title>Application error</title>
            <h1 style={{ margin: 0, fontSize: 24 }}>South Emerald could not start</h1>
            <p style={{ margin: "12px 0 0", color: "#5f6f65", lineHeight: 1.6 }}>No changes were made. Try loading the application again.</p>
            {error.digest && <p style={{ margin: "10px 0 0", color: "#5f6f65", fontFamily: "monospace", fontSize: 12 }}>Reference: {error.digest}</p>}
            <button type="button" onClick={retry} style={{ marginTop: 24, minHeight: 44, border: 0, borderRadius: 12, background: "#147a43", color: "white", cursor: "pointer", padding: "0 20px", fontWeight: 700 }}>Try again</button>
          </section>
        </main>
      </body>
    </html>
  );
}
