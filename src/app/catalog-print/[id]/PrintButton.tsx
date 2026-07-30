"use client";

export default function PrintButton() {
  return (
    <div className="no-print" style={{ position: "fixed", top: 16, right: 16, zIndex: 50 }}>
      <button
        onClick={() => window.print()}
        style={{ background: "#0d9488", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 14px rgba(13,148,136,.35)" }}
      >
        🖨 ພິມ / ບັນທຶກ PDF
      </button>
    </div>
  );
}
