import { useEffect, useRef, useState } from "react";
import { fileExtension } from "../utils.js";

export function OfficePreview({ blob, fileName }) {
  const ref = useRef(null);
  const viewerRef = useRef(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    setError("");
    viewerRef.current = null;
    if (ref.current) ref.current.innerHTML = "";

    const run = async () => {
      const ext = fileExtension(fileName || "");
      try {
        if (!blob || !ref.current) return;

        if (ext === "docx") {
          const mod = await import("docx-preview");
          if (cancelled) return;
          await mod.renderAsync(blob, ref.current, ref.current, {
            breakPages: true,
            ignoreWidth: false,
            ignoreHeight: false,
          });
        } else if (ext === "xlsx") {
          const mod = await import("xlsx-preview");
          if (cancelled) return;
          const fn = mod.xlsx2Html || mod.default?.xlsx2Html;
          if (!fn) throw new Error("Mesin pratinjau XLSX tidak tersedia.");
          const result = await fn(blob);
          if (cancelled) return;
          const html = typeof result === "string"
            ? result
            : result?.html || result?.value || "";
          if (!html) throw new Error("Spreadsheet tidak menghasilkan pratinjau.");
          ref.current.innerHTML = html;
        } else if (ext === "pptx") {
          const mod = await import("pptx-preview");
          if (cancelled) return;
          const init = mod.init || mod.default?.init;
          if (!init) throw new Error("Mesin pratinjau PPTX tidak tersedia.");
          viewerRef.current = init(ref.current, { width: 960, height: 540 });
          await viewerRef.current.preview(await blob.arrayBuffer());
        } else {
          throw new Error("Format Office ini belum memiliki renderer lokal.");
        }
      } catch (e) {
        if (!cancelled) setError(e.message || "Pratinjau Office gagal.");
      } finally {
        if (!cancelled) setBusy(false);
      }
    };

    run();
    return () => {
      cancelled = true;
      try { viewerRef.current?.destroy?.(); } catch {}
      if (ref.current) ref.current.innerHTML = "";
    };
  }, [blob, fileName]);

  if (busy) return <div className="office-state">Memuat pratinjau...</div>;
  if (error) return <div className="note">{error}</div>;
  return <div ref={ref} className="office-preview" />;
}
