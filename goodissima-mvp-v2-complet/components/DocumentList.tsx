"use client";

export function DocumentList({
  documents,
  caseId,
  candidateAccessToken,
}: {
  documents: Array<{ id: string; fileName: string }>;
  caseId?: string;
  candidateAccessToken?: string;
}) {
  async function openDocument(documentId: string) {
    const res = await fetch(`/api/documents/${encodeURIComponent(documentId)}/signed-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseId, candidateAccessToken }),
    });

    if (!res.ok) {
      alert("Impossible d'ouvrir le document.");
      return;
    }

    const { signedUrl } = await res.json();
    window.open(signedUrl, "_blank", "noopener,noreferrer");
  }

  if (documents.length === 0) {
    return <p className="text-sm text-slate-500">Aucun document.</p>;
  }

  return (
    <>
      {documents.map((doc) => (
        <button
          key={doc.id}
          type="button"
          onClick={() => openDocument(doc.id)}
          className="block w-full rounded-xl border p-3 text-left text-sm hover:bg-slate-50"
        >
          {doc.fileName}
        </button>
      ))}
    </>
  );
}
