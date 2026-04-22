import { useRef } from "react";
import PhotoCapture from "./PhotoCapture";
import CarAutocomplete from "./CarAutocomplete";

const ACCENT = "#C8F04B";
const BG = "#0D0D0D";
const BORDER = "#2a2a2a";

const S = {
  app: { background: BG, minHeight: "100vh", color: "#fff", fontFamily: "'DM Mono', monospace" },
  header: { paddingTop: "calc(12px + env(safe-area-inset-top))", paddingBottom: "12px", paddingLeft: "16px", paddingRight: "16px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: BG, zIndex: 10 },
  logo: { fontFamily: "sans-serif", fontSize: "20px", fontWeight: 900, color: ACCENT },
  sub: { fontSize: "10px", color: "#999", letterSpacing: "2px", marginTop: "2px" },
  content: { padding: "12px 16px" },
  input: { width: "100%", background: "#111", border: `1px solid ${BORDER}`, borderRadius: "10px", padding: "13px", color: "#fff", fontFamily: "'DM Mono', monospace", fontSize: "14px", marginBottom: "10px", outline: "none", boxSizing: "border-box" },
  btn: { background: ACCENT, color: "#000", border: "none", borderRadius: "12px", padding: "15px", width: "100%", fontFamily: "sans-serif", fontSize: "13px", fontWeight: 700, cursor: "pointer", marginBottom: "8px", letterSpacing: "1px" },
  btnOutline: { background: "transparent", color: "#aaa", border: `1px solid ${BORDER}`, borderRadius: "12px", padding: "11px 16px", fontFamily: "'DM Mono', monospace", fontSize: "12px", cursor: "pointer" },
  label: { fontSize: "9px", color: "#aaa", letterSpacing: "2px", marginBottom: "6px" },
};

export default function TicketDetailsForm({ ticket, carDetails, setCarDetails, form, setForm, ticketPhotos, setTicketPhotos, spotPhoto, setSpotPhoto, saving, onSave, onBack }) {
  const spotPhotoRef = useRef(null);

  return (
    <div style={S.app}>
      <div style={S.header}>
        <div><div style={S.logo}>VLTD</div><div style={S.sub}>TICKET #{ticket.ticketNum}</div></div>
        <button style={S.btnOutline} onClick={onBack}>Back</button>
      </div>
      <div style={S.content}>
        <div style={{ marginBottom: "16px" }}>
          <div style={S.label}>VEHICLE DETAILS</div>
          <div style={{ background: "#111", borderRadius: "12px", padding: "14px", border: `1px solid ${BORDER}` }}>
            <CarAutocomplete value={carDetails} onChange={setCarDetails} />
          </div>
        </div>
        <div style={S.label}>PARKING SPOT</div>
        <input style={S.input} placeholder="e.g. B-14" value={form.spot} onChange={e => setForm({ ...form, spot: e.target.value })} />
        <div style={S.label}>DAMAGE NOTES</div>
        <input style={S.input} placeholder="Any existing damage..." value={form.damage} onChange={e => setForm({ ...form, damage: e.target.value })} />
        <div style={{ background: "#111", borderRadius: "12px", padding: "14px", border: `1px solid ${BORDER}`, marginBottom: "12px" }}>
          <PhotoCapture onChange={setTicketPhotos} />
        </div>

        <div style={{ marginBottom: "12px" }}>
          <div style={S.label}>PARK LOCATION PHOTO</div>
          <input
            ref={spotPhotoRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={e => {
              const file = e.target.files[0];
              if (!file) return;
              const url = URL.createObjectURL(file);
              const img = new Image();
              img.onload = () => {
                const canvas = document.createElement("canvas");
                const MAX = 800; let w = img.width, h = img.height;
                if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
                canvas.width = w; canvas.height = h;
                canvas.getContext("2d").drawImage(img, 0, 0, w, h);
                setSpotPhoto(canvas.toDataURL("image/jpeg", 0.7));
                URL.revokeObjectURL(url);
              };
              img.src = url;
              e.target.value = "";
            }}
          />
          {spotPhoto ? (
            <div style={{ position: "relative" }}>
              <img src={spotPhoto} alt="spot" style={{ width: "100%", borderRadius: 10, maxHeight: 140, objectFit: "cover" }} />
              <button type="button" onClick={() => setSpotPhoto("")} style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.7)", color: "#fff", border: "none", borderRadius: 10, width: 24, height: 24, fontSize: 12, cursor: "pointer" }}>x</button>
            </div>
          ) : (
            <button type="button" onClick={() => spotPhotoRef.current?.click()} style={{ ...S.btnOutline, width: "100%", padding: "12px", textAlign: "center" }}>
              + ADD LOCATION PHOTO
            </button>
          )}
        </div>

        <button style={{ ...S.btn, opacity: saving ? 0.6 : 1 }} onClick={onSave} disabled={saving}>
          {saving ? "SAVING..." : "SAVE & MARK PARKED"}
        </button>
      </div>
    </div>
  );
}
