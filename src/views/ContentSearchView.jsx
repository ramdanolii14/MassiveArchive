import { useState } from "react";
import { IDB } from "../database.js";
import { Crypto } from "../crypto.js";
import { fileExtension, fmtSize } from "../utils.js";
import { logAudit } from "../audit.js";

const TEXT_EXTS = new Set([
  "txt","md","csv","log","json","xml","yaml","yml","html","htm",
  "css","js","jsx","ts","tsx","svg"
]);

function snippet(text, index, length = 180) {
  const start = Math.max(0, index - 70);
  const end = Math.min(text.length, start + length);
  const value = text.slice(start, end).replace(/s+/g, " ").trim();
  return start > 0 ? "..." + value : value;
}

async function extractText(blob, ext) {
  if (TEXT_EXTS.has(ext)) return blob.text();

  if (ext === "docx") {
    const mod = await import("mammoth");
    const mammoth = mod.default || mod;
    const result = await mammoth.extractRawText({
      arrayBuffer: await blob.arrayBuffer(),
    });
    return result.value || "";
  }

  if (ext === "pdf") {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const data = new Uint8Array(await blob.arrayBuffer());
    const pdf = await pdfjs.getDocument({ data, disableWorker: true }).promise;
    const pages = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      pages.push(content.items.map(item => item.str || "").join(" "));
    }
    return pages.join("
");
  }

  if (["xlsx", "xls", "xlsm", "ods"].includes(ext)) {
    const mod = await import("xlsx");
    const XLSX = mod.default || mod;
    const wb = XLSX.read(await blob.arrayBuffer(), { type: "array" });
    return wb.SheetNames.map(name =>
      XLSX.utils.sheet_to_csv(wb.Sheets[name])
    ).join("
");
  }

  return "";
}

export function ContentSearchView({ session, toast, onDetail }) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [results, setResults] = useState([]);

  const search = async () => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) {
      toast("Masukkan minimal 2 karakter.", "err");
      return;
    }

    setBusy(true);
    setResults([]);
    try {
      const archives = await IDB.listMeta({
        scope: "accessible",
      });

      const found = [];
      let fileTotal = archives.reduce((n, a) => n + (a.fileCount || 0), 0);
      let fileDone = 0;

      for (const arc of archives) {
        if (!arc.files?.length) continue;

        let archiveKey = null;
        if (arc.keyMode === "envelope-v1") {
          const env = (arc.keyEnvelopes || []).find(e => e.keyId === session.keyId);
          if (!env || !session.identityPrivateKey) continue;
          try {
            archiveKey = await Crypto.unwrapKey(
              env.wrappedKey,
              session.identityPrivateKey
            );
          } catch {
            continue;
          }
        }

        for (let i = 0; i < arc.files.length; i++) {
          const file = arc.files[i];
          fileDone++;
          setProgress(`Mencari ${fileDone}/${fileTotal}`);

          try {
            const encrypted = await IDB.fileData(arc.id, i, session, "view");
            let plain;

            if (arc.keyMode === "envelope-v1") {
              plain = await Crypto.decryptWithKey(encrypted, archiveKey);
            } else {
              plain = await Crypto.decrypt(encrypted, session.passphrase);
            }

            const blob = new Blob([plain], {
              type: file.type || "application/octet-stream",
            });
            const ext = fileExtension(file.name);
            const text = await extractText(blob, ext);
            const index = text.toLowerCase().indexOf(q);

            if (index >= 0) {
              found.push({
                archiveId: arc.id,
                archiveNum: arc.archiveId,
                title: arc.title,
                fileName: file.name,
                size: file.size,
                snippet: snippet(text, index),
              });
              setResults([...found]);
            }
          } catch {
            // Format tidak terbaca atau akses file ditolak dilewati.
          }
        }
      }

      await logAudit(session, "search", {
        query: q,
        results: found.length,
      });
      setProgress("");
      if (!found.length) toast("Tidak ditemukan dokumen yang cocok.");
    } catch (e) {
      setProgress("");
      toast(e.message || "Pencarian isi gagal.", "err");
    }
    setBusy(false);
  };

  return (
    <div style={{ maxWidth: 980 }} className="stack">
      <div className="panel pad">
        <div className="search-content-row">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && search()}
            placeholder="Cari kata atau kalimat di dalam dokumen"
            disabled={busy}
          />
          <button className="btn btn-p" onClick={search} disabled={busy}>
            {busy ? (progress || "Mencari...") : "Cari isi"}
          </button>
        </div>
        <div className="hint">
          Pencarian dilakukan setelah dokumen didekripsi di browser.
        </div>
      </div>

      <div className="panel tbl-wrap">
        {results.length === 0 ? (
          <div className="empty">
            <h3>Belum ada hasil</h3>
            <p>Hasil dokumen yang cocok akan tampil di sini.</p>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr><th>Arsip</th><th>Berkas</th><th>Ukuran</th><th>Cuplikan</th></tr>
            </thead>
            <tbody>
              {results.map((item, index) => (
                <tr key={`${item.archiveId}-${index}`}
                  onClick={() => onDetail(item.archiveId)}>
                  <td>
                    <div className="td-title">{item.title}</div>
                    <div className="td-sub">{item.archiveNum}</div>
                  </td>
                  <td className="td-title">{item.fileName}</td>
                  <td className="mono">{fmtSize(item.size)}</td>
                  <td className="td-sub search-snippet">{item.snippet}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
