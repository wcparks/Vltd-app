// ============================================================
// FILE: src/DamagePhotos.js
// PURPOSE: Multi-photo capture with labels, timestamps, damage notes
//          Photos are write-once (immutable) for legal protection
// USAGE: <DamagePhotos ticketId={ticketId} readonly={false} />
//        Use readonly={true} on the customer ticket view
// ============================================================

import React, { useState, useRef, useEffect } from "react";
import { db } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";

const PHOTO_TYPES = [
  { id: "front", label: "Front of Car", icon: "⬆️" },
  { id: "back", label: "Back of Car", icon: "⬇️" },
  { id: "driver", label: "Driver Side", icon: "◀️" },
  { id: "passenger", label: "Passenger Side", icon: "▶️" },
  { id: "damage", label: "Damage Closeup", icon: "⚠️", requiresNote: true },
  { id: "interior", label: "Interior", icon: "🪑" },
  { id: "other", label: "Other", icon: "📷" },
];

export default function DamagePhotos({ ticketId, readonly = false }) {
  const [photos, setPhotos] = useState([]);
  const [capturing, setCapturing] = useState(false);
  const [selectedType, setSelectedType] = useState(null);
  const [damageNote, setDamageNote] = useState("");
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (ticketId) loadPhotos();
    return () => stopCamera();
  }, [ticketId]);

  async function loadPhotos() {
    const snap = await getDocs(
      query(
        collection(db, "ticketPhotos"),
        where("ticketId", "==", ticketId),
        orderBy("capturedAt", "asc")
      )
    );
    setPhotos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }

  async function startCamera(photoType) {
    setSelectedType(photoType);
    setPreview(null);
    setDamageNote("");
    setError("");
    setCapturing(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: 1280, height: 960 },
        audio: false,
      });
      streamRef.current = stream;
      // Wait for video element to mount
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 100);
    } catch (err) {
      setError("Camera access denied. Please allow camera permissions.");
      setCapturing(false);
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 960;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    setPreview(dataUrl);
    stopCamera();
  }

  function retake() {
    setPreview(null);
    startCamera(selectedType);
  }

  async function savePhoto() {
    if (!preview || !selectedType) return;
    const typeInfo = PHOTO_TYPES.find((t) => t.id === selectedType.id);
    if (typeInfo?.requiresNote && !damageNote.trim()) {
      setError("Damage photos require a written note describing the damage.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await addDoc(collection(db, "ticketPhotos"), {
        ticketId,
        photoType: selectedType.id,
        photoLabel: selectedType.label,
        imageData: preview, // base64
        damageNote: damageNote.trim(),
        capturedAt: serverTimestamp(),
        capturedAtISO: new Date().toISOString(),
        // immutable — no update/delete allowed (see firestore.rules)
      });
      setCapturing(false);
      setPreview(null);
      setSelectedType(null);
      setDamageNote("");
      await loadPhotos();
    } catch (err) {
      setError("Failed to save photo. Try again.");
    }
    setSaving(false);
  }

  function cancelCapture() {
    stopCamera();
    setCapturing(false);
    setPreview(null);
    setSelectedType(null);
    setError("");
  }

  const coveredTypes = photos.map((p) => p.photoType);

  return (
    <div style={styles.container}>
      <h3 style={styles.heading}>
        📸 Vehicle Photos
        {photos.length > 0 && (
          <span style={styles.badge}>{photos.length} photos</span>
        )}
      </h3>

      {/* EXISTING PHOTOS */}
      {photos.length > 0 && (
        <div style={styles.photoGrid}>
          {photos.map((photo) => (
            <div key={photo.id} style={styles.photoCard}>
              <img
                src={photo.imageData}
                alt={photo.photoLabel}
                style={styles.photoImg}
              />
              <div style={styles.photoMeta}>
                <span style={styles.photoLabel}>
                  {PHOTO_TYPES.find((t) => t.id === photo.photoType)?.icon}{" "}
                  {photo.photoLabel}
                </span>
                <span style={styles.photoTime}>
                  {photo.capturedAtISO
                    ? new Date(photo.capturedAtISO).toLocaleString()
                    : "Timestamp pending"}
                </span>
                {photo.damageNote && (
                  <div style={styles.damageNote}>
                    ⚠️ {photo.damageNote}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {photos.length === 0 && readonly && (
        <p style={styles.muted}>No photos on this ticket.</p>
      )}

      {/* ADD PHOTO — valet only */}
      {!readonly && !capturing && (
        <div>
          <p style={styles.muted}>Tap a photo type to add:</p>
          <div style={styles.typeGrid}>
            {PHOTO_TYPES.map((type) => {
              const done = coveredTypes.includes(type.id);
              return (
                <button
                  key={type.id}
                  style={{
                    ...styles.typeBtn,
                    opacity: done ? 0.5 : 1,
                    borderColor: done ? "#22c55e" : "#334155",
                  }}
                  onClick={() => startCamera(type)}
                >
                  <span style={{ fontSize: 22 }}>{type.icon}</span>
                  <span style={styles.typeBtnLabel}>{type.label}</span>
                  {done && <span style={styles.checkmark}>✓</span>}
                  {type.requiresNote && (
                    <span style={styles.requiresNote}>note required</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* CAMERA / PREVIEW */}
      {capturing && (
        <div style={styles.cameraContainer}>
          <div style={styles.cameraHeader}>
            <span>
              {selectedType?.icon} {selectedType?.label}
            </span>
            <button style={styles.cancelBtn} onClick={cancelCapture}>
              ✕ Cancel
            </button>
          </div>

          {!preview ? (
            <>
              <video
                ref={videoRef}
                style={styles.video}
                autoPlay
                playsInline
                muted
              />
              <button style={styles.captureBtn} onClick={capturePhoto}>
                📸 Take Photo
              </button>
            </>
          ) : (
            <>
              <img src={preview} alt="preview" style={styles.video} />

              {selectedType?.requiresNote && (
                <textarea
                  style={styles.noteInput}
                  placeholder="⚠️ Describe the damage in detail (required for damage photos)"
                  value={damageNote}
                  onChange={(e) => setDamageNote(e.target.value)}
                  rows={3}
                />
              )}

              {error && <p style={styles.error}>{error}</p>}

              <div style={styles.actionRow}>
                <button style={styles.retakeBtn} onClick={retake}>
                  🔄 Retake
                </button>
                <button
                  style={styles.saveBtn}
                  onClick={savePhoto}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "✅ Save Photo"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {!capturing && error && <p style={styles.error}>{error}</p>}

      {/* Legal note for customer view */}
      {readonly && photos.length > 0 && (
        <div style={styles.legalNote}>
          🔒 These photos were taken at check-in and are timestamped. They document the condition of your vehicle when it was received.
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    background: "#1e293b",
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  heading: {
    fontSize: 16,
    fontWeight: 700,
    color: "#f1f5f9",
    marginBottom: 16,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  badge: {
    background: "#2563eb",
    color: "#fff",
    borderRadius: 20,
    padding: "2px 10px",
    fontSize: 12,
    fontWeight: 600,
  },
  photoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
    gap: 12,
    marginBottom: 16,
  },
  photoCard: {
    background: "#0f172a",
    borderRadius: 8,
    overflow: "hidden",
  },
  photoImg: {
    width: "100%",
    aspectRatio: "4/3",
    objectFit: "cover",
    display: "block",
  },
  photoMeta: {
    padding: 8,
  },
  photoLabel: {
    display: "block",
    color: "#f1f5f9",
    fontSize: 12,
    fontWeight: 600,
  },
  photoTime: {
    display: "block",
    color: "#64748b",
    fontSize: 10,
    marginTop: 2,
  },
  damageNote: {
    background: "#7f1d1d",
    color: "#fca5a5",
    borderRadius: 4,
    padding: "4px 6px",
    fontSize: 11,
    marginTop: 4,
  },
  typeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
    gap: 10,
    marginTop: 8,
  },
  typeBtn: {
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: 8,
    padding: "14px 10px",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    position: "relative",
  },
  typeBtnLabel: {
    color: "#cbd5e1",
    fontSize: 12,
    textAlign: "center",
  },
  checkmark: {
    position: "absolute",
    top: 6,
    right: 8,
    color: "#22c55e",
    fontSize: 14,
    fontWeight: 700,
  },
  requiresNote: {
    color: "#f87171",
    fontSize: 10,
    background: "#1e293b",
    padding: "2px 4px",
    borderRadius: 4,
  },
  cameraContainer: {
    background: "#0f172a",
    borderRadius: 10,
    padding: 12,
  },
  cameraHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    color: "#f1f5f9",
    fontSize: 15,
    fontWeight: 600,
    marginBottom: 10,
  },
  video: {
    width: "100%",
    borderRadius: 8,
    maxHeight: 320,
    objectFit: "cover",
    display: "block",
    background: "#000",
  },
  captureBtn: {
    width: "100%",
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: 14,
    fontSize: 17,
    fontWeight: 700,
    cursor: "pointer",
    marginTop: 10,
  },
  noteInput: {
    width: "100%",
    background: "#1e293b",
    border: "1px solid #f87171",
    borderRadius: 8,
    color: "#f1f5f9",
    padding: 10,
    fontSize: 14,
    marginTop: 10,
    resize: "vertical",
    boxSizing: "border-box",
  },
  actionRow: {
    display: "flex",
    gap: 10,
    marginTop: 10,
  },
  retakeBtn: {
    flex: 1,
    background: "#374151",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    cursor: "pointer",
  },
  saveBtn: {
    flex: 2,
    background: "#16a34a",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
  },
  cancelBtn: {
    background: "transparent",
    color: "#94a3b8",
    border: "1px solid #334155",
    borderRadius: 6,
    padding: "4px 10px",
    fontSize: 13,
    cursor: "pointer",
  },
  muted: { color: "#64748b", fontSize: 13 },
  error: { color: "#f87171", fontSize: 13, marginTop: 8 },
  legalNote: {
    background: "#0f2d1a",
    border: "1px solid #166534",
    borderRadius: 8,
    padding: "10px 14px",
    color: "#86efac",
    fontSize: 12,
    marginTop: 12,
  },
};
