// ============================================================
// PhotoCapture.jsx — Multi-photo + damage documentation
// Place at: src/components/PhotoCapture.jsx
//
// USAGE in your ticket creation form:
//   import PhotoCapture from './components/PhotoCapture';
//   <PhotoCapture onChange={(photos) => setTicketPhotos(photos)} />
//
// Then save photos array to Firestore with the ticket.
// Each photo: { label, dataUrl, timestamp, isDamage, notes }
// ============================================================
import { useState, useRef } from 'react';

const PHOTO_TYPES = [
  { id: 'front', label: '🚗 Front', isDamage: false },
  { id: 'back', label: '🚗 Back', isDamage: false },
  { id: 'driver', label: '🚪 Driver Side', isDamage: false },
  { id: 'passenger', label: '🚪 Passenger Side', isDamage: false },
  { id: 'damage', label: '⚠️ Damage', isDamage: true },
  { id: 'other', label: '📷 Other', isDamage: false },
];

export default function PhotoCapture({ onChange }) {
  const [photos, setPhotos] = useState([]);
  const [selectedType, setSelectedType] = useState(PHOTO_TYPES[0]);
  const [damageNote, setDamageNote] = useState('');
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const fileRef = useRef(null);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraActive(true);
    } catch {
      // fallback to file picker
      fileRef.current?.click();
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    setCameraActive(false);
  }

  function captureFromCamera() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
    addPhoto(dataUrl);
    stopCamera();
  }

  function handleFileInput(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => addPhoto(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function addPhoto(dataUrl) {
    if (selectedType.isDamage && !damageNote.trim()) {
      alert('Damage photos require a written description. Please describe the damage.');
      return;
    }
    const photo = {
      id: Date.now().toString(),
      label: selectedType.label,
      type: selectedType.id,
      isDamage: selectedType.isDamage,
      notes: selectedType.isDamage ? damageNote.trim() : '',
      dataUrl,
      timestamp: new Date().toISOString(),
    };
    const updated = [...photos, photo];
    setPhotos(updated);
    onChange?.(updated);
    if (selectedType.isDamage) setDamageNote('');
  }

  function removePhoto(id) {
    const updated = photos.filter(p => p.id !== id);
    setPhotos(updated);
    onChange?.(updated);
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.sectionHeader}>
        <span style={styles.sectionTitle}>📸 Vehicle Photos</span>
        <span style={styles.count}>{photos.length} photo{photos.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Type selector */}
      <div style={styles.typeRow}>
        {PHOTO_TYPES.map(t => (
          <button
            key={t.id}
            style={{
              ...styles.typeBtn,
              ...(selectedType.id === t.id ? styles.typeBtnActive : {}),
              ...(t.isDamage ? styles.typeBtnDamage : {}),
            }}
            onClick={() => setSelectedType(t)}
            type="button"
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Damage note required */}
      {selectedType.isDamage && (
        <textarea
          style={styles.damageNote}
          placeholder="⚠️ Required: Describe the damage (location, severity, type)…"
          value={damageNote}
          onChange={e => setDamageNote(e.target.value)}
          rows={2}
        />
      )}

      {/* Camera UI */}
      {cameraActive ? (
        <div style={styles.cameraWrap}>
          <video ref={videoRef} style={styles.video} playsInline muted />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          <div style={styles.cameraControls}>
            <button type="button" style={styles.btnCapture} onClick={captureFromCamera}>
              📷 Capture
            </button>
            <button type="button" style={styles.btnCancel} onClick={stopCamera}>
              ✕ Cancel
            </button>
          </div>
        </div>
      ) : (
        <div style={styles.addRow}>
          <button type="button" style={styles.btnAdd} onClick={startCamera}>
            📷 Take Photo
          </button>
          <button type="button" style={styles.btnAddAlt} onClick={() => fileRef.current?.click()}>
            🖼️ Upload
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileInput} />
        </div>
      )}

      {/* Photo grid */}
      {photos.length > 0 && (
        <div style={styles.grid}>
          {photos.map(photo => (
            <div key={photo.id} style={{ ...styles.photoCard, ...(photo.isDamage ? styles.photoCardDamage : {}) }}>
              <img src={photo.dataUrl} alt={photo.label} style={styles.thumb} />
              <div style={styles.photoMeta}>
                <div style={styles.photoLabel}>{photo.label}</div>
                {photo.isDamage && photo.notes && (
                  <div style={styles.photoNotes}>⚠️ {photo.notes}</div>
                )}
                <div style={styles.photoTime}>
                  {new Date(photo.timestamp).toLocaleTimeString()}
                </div>
              </div>
              <button type="button" style={styles.removeBtn} onClick={() => removePhoto(photo.id)}>✕</button>
            </div>
          ))}
        </div>
      )}

      {photos.length === 0 && (
        <div style={styles.empty}>
          Add photos for liability protection. Damage photos require a description.
        </div>
      )}
    </div>
  );
}

// ── Read-only viewer (for ticket detail / customer QR page) ─
export function PhotoViewer({ photos = [] }) {
  const [selected, setSelected] = useState(null);

  if (!photos.length) return null;

  return (
    <div style={styles.wrap}>
      <div style={styles.sectionHeader}>
        <span style={styles.sectionTitle}>📸 Vehicle Photos</span>
        <span style={styles.count}>{photos.length} photo{photos.length !== 1 ? 's' : ''}</span>
      </div>
      <div style={styles.grid}>
        {photos.map((photo, i) => (
          <div
            key={i}
            style={{ ...styles.photoCard, ...(photo.isDamage ? styles.photoCardDamage : {}), cursor: 'pointer' }}
            onClick={() => setSelected(photo)}
          >
            <img src={photo.dataUrl} alt={photo.label} style={styles.thumb} />
            <div style={styles.photoMeta}>
              <div style={styles.photoLabel}>{photo.label}</div>
              {photo.isDamage && photo.notes && (
                <div style={styles.photoNotes}>⚠️ {photo.notes}</div>
              )}
              <div style={styles.photoTime}>{new Date(photo.timestamp).toLocaleTimeString()}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {selected && (
        <div style={styles.lightboxBg} onClick={() => setSelected(null)}>
          <div style={styles.lightbox} onClick={e => e.stopPropagation()}>
            <img src={selected.dataUrl} alt={selected.label} style={styles.lightboxImg} />
            <div style={styles.lightboxMeta}>
              <strong>{selected.label}</strong>
              {selected.isDamage && selected.notes && <div style={{ color: '#c00' }}>⚠️ {selected.notes}</div>}
              <div style={{ color: '#888', fontSize: 12 }}>{new Date(selected.timestamp).toLocaleString()}</div>
            </div>
            <button style={styles.lightboxClose} onClick={() => setSelected(null)}>✕ Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: { marginBottom: 16 },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontWeight: 700, fontSize: 15 },
  count: { background: '#f0f0f0', borderRadius: 20, padding: '2px 10px', fontSize: 13, color: '#555' },
  typeRow: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  typeBtn: { padding: '6px 10px', borderRadius: 20, border: '1px solid #ddd', background: '#f8f8f8', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' },
  typeBtnActive: { background: '#1a1a1a', color: '#fff', borderColor: '#1a1a1a' },
  typeBtnDamage: { borderColor: '#f99' },
  damageNote: { width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '2px solid #f99', borderRadius: 8, fontSize: 14, marginBottom: 10, background: '#fff9f9', resize: 'none' },
  addRow: { display: 'flex', gap: 8, marginBottom: 12 },
  btnAdd: { flex: 1, padding: '12px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  btnAddAlt: { flex: 1, padding: '12px', background: '#f0f0f0', color: '#333', border: 'none', borderRadius: 10, fontSize: 14, cursor: 'pointer' },
  cameraWrap: { borderRadius: 12, overflow: 'hidden', marginBottom: 12, background: '#000' },
  video: { width: '100%', display: 'block' },
  cameraControls: { display: 'flex', gap: 8, padding: 10, background: '#111' },
  btnCapture: { flex: 1, padding: '12px', background: '#fff', color: '#000', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer' },
  btnCancel: { padding: '12px 16px', background: '#333', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 },
  photoCard: { border: '1px solid #eee', borderRadius: 10, overflow: 'hidden', position: 'relative', background: '#fff' },
  photoCardDamage: { border: '2px solid #f99' },
  thumb: { width: '100%', height: 100, objectFit: 'cover', display: 'block' },
  photoMeta: { padding: '6px 8px' },
  photoLabel: { fontWeight: 600, fontSize: 12 },
  photoNotes: { fontSize: 11, color: '#c00', marginTop: 2 },
  photoTime: { fontSize: 10, color: '#aaa', marginTop: 2 },
  removeBtn: { position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: 12, width: 22, height: 22, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  empty: { textAlign: 'center', color: '#aaa', fontSize: 13, padding: '16px 0' },
  lightboxBg: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  lightbox: { background: '#fff', borderRadius: 16, overflow: 'hidden', maxWidth: 500, width: '100%' },
  lightboxImg: { width: '100%', maxHeight: '60vh', objectFit: 'contain', background: '#000' },
  lightboxMeta: { padding: '12px 16px' },
  lightboxClose: { display: 'block', width: '100%', padding: 12, background: '#f0f0f0', border: 'none', cursor: 'pointer', fontSize: 14 },
};
