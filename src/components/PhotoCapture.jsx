import { useState, useRef } from 'react';

const ACCENT = '#C8F04B';
const CARD = '#161616';
const BORDER = '#2a2a2a';

const PHOTO_TYPES = [
  { id: 'front',     label: 'Front',          isDamage: false },
  { id: 'back',      label: 'Back',           isDamage: false },
  { id: 'driver',    label: 'Driver Side',    isDamage: false },
  { id: 'passenger', label: 'Passenger Side', isDamage: false },
  { id: 'damage',    label: 'Damage',         isDamage: true  },
  { id: 'other',     label: 'Other',          isDamage: false },
];

function processImage(file, onDone) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    const MAX = 1000;
    let w = img.width, h = img.height;
    if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
    URL.revokeObjectURL(url);
    onDone(dataUrl);
  };
  img.onerror = () => { URL.revokeObjectURL(url); onDone(null); };
  img.src = url;
}

export default function PhotoCapture({ onChange }) {
  const [photos, setPhotos] = useState([]);
  const [selectedType, setSelectedType] = useState(PHOTO_TYPES[0]);
  const [damageNote, setDamageNote] = useState('');
  const fileRef = useRef(null);

  function handleFileInput(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (selectedType.isDamage && !damageNote.trim()) {
      alert('Please describe the damage before taking the photo.');
      e.target.value = '';
      return;
    }
    processImage(file, (dataUrl) => {
      if (!dataUrl) return;
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
    });
    e.target.value = '';
  }

  function removePhoto(id) {
    const updated = photos.filter(p => p.id !== id);
    setPhotos(updated);
    onChange?.(updated);
  }

  return (
    <div>
      <input ref={fileRef} type="file" accept="image/*"  style={{ display: 'none' }} onChange={handleFileInput} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: '8px', color: '#888', letterSpacing: '2px' }}>VEHICLE PHOTOS</div>
        <div style={{ fontSize: '10px', color: '#888' }}>{photos.length} photo{photos.length !== 1 ? 's' : ''}</div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {PHOTO_TYPES.map(t => (
          <button key={t.id} type="button" onClick={() => setSelectedType(t)} style={{
            padding: '5px 10px', borderRadius: 20,
            border: selectedType.id === t.id ? '1px solid ' + (t.isDamage ? '#ff4444' : ACCENT) : '1px solid ' + BORDER,
            background: selectedType.id === t.id ? (t.isDamage ? '#ff444422' : '#C8F04B22') : 'transparent',
            color: selectedType.id === t.id ? (t.isDamage ? '#ff4444' : ACCENT) : '#666',
            fontSize: 11, cursor: 'pointer',
          }}>
            {t.isDamage ? '! ' : ''}{t.label}
          </button>
        ))}
      </div>

      {selectedType.isDamage && (
        <textarea
          style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', marginBottom: 10, background: '#111', border: '1px solid #ff444466', borderRadius: 8, color: '#fff', fontSize: 13, fontFamily: "'DM Mono', monospace", resize: 'none', outline: 'none' }}
          placeholder="Describe the damage before taking photo..."
          value={damageNote}
          onChange={e => setDamageNote(e.target.value)}
          rows={2}
        />
      )}

      <button type="button" onClick={() => { if (fileRef.current) { fileRef.current.value = ''; fileRef.current.click(); } }}
        style={{ width: '100%', padding: '12px', background: ACCENT, color: '#000', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', marginBottom: 12, letterSpacing: '1px', fontFamily: 'sans-serif' }}>
        + ADD {selectedType.label.toUpperCase()} PHOTO
      </button>

      {photos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {photos.map(photo => (
            <div key={photo.id} style={{ background: CARD, border: '1px solid ' + (photo.isDamage ? '#ff444466' : BORDER), borderRadius: 10, overflow: 'hidden', position: 'relative' }}>
              <img src={photo.dataUrl} alt={photo.label} style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }} />
              <div style={{ padding: '6px 8px' }}>
                <div style={{ fontSize: 10, color: photo.isDamage ? '#ff4444' : '#aaa', fontWeight: 600 }}>{photo.label}</div>
                {photo.notes && <div style={{ fontSize: 9, color: '#ff4444', marginTop: 2 }}>{photo.notes}</div>}
              </div>
              <button type="button" onClick={() => removePhoto(photo.id)} style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none', borderRadius: 10, width: 20, height: 20, fontSize: 10, cursor: 'pointer' }}>x</button>
            </div>
          ))}
        </div>
      )}

      {photos.length === 0 && <div style={{ textAlign: 'center', color: '#333', fontSize: 11, padding: '8px 0' }}>Add photos for liability protection</div>}
    </div>
  );
}

export function SpotPhotoViewer({ url, label = 'Park Location Photo' }) {
  const [open, setOpen] = useState(false);
  if (!url) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: '8px', color: '#888', letterSpacing: '2px', marginBottom: 8 }}>{label.toUpperCase()}</div>
      <img src={url} alt={label} onClick={() => setOpen(true)} style={{ width: '100%', height: 'auto', borderRadius: 10, cursor: 'pointer', display: 'block' }} />
      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <img src={url} alt={label} style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 12 }} />
          <div style={{ color: '#fff', marginTop: 12, fontWeight: 700 }}>{label}</div>
          <button onClick={e => { e.stopPropagation(); setOpen(false); }} style={{ marginTop: 20, padding: '12px 32px', background: '#222', color: '#fff', border: '1px solid #333', borderRadius: 10, cursor: 'pointer' }}>Close</button>
        </div>
      )}
    </div>
  );
}

export function PhotoViewer({ photos = [] }) {
  const [selected, setSelected] = useState(null);
  if (!photos.length) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: '8px', color: '#888', letterSpacing: '2px', marginBottom: 8 }}>VEHICLE PHOTOS ({photos.length})</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {photos.map((photo, i) => (
          <div key={photo.url || photo.dataUrl || i} onClick={() => setSelected(photo)} style={{ background: CARD, border: '1px solid ' + (photo.isDamage ? '#ff444466' : BORDER), borderRadius: 10, overflow: 'hidden', cursor: 'pointer' }}>
            <img src={photo.url || photo.dataUrl} alt={photo.label} style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }} />
            <div style={{ padding: '6px 8px' }}>
              <div style={{ fontSize: 10, color: photo.isDamage ? '#ff4444' : '#aaa' }}>{photo.label}</div>
              {photo.notes && <div style={{ fontSize: 9, color: '#ff4444', marginTop: 2 }}>{photo.notes}</div>}
            </div>
          </div>
        ))}
      </div>
      {selected && (
        <div onClick={() => setSelected(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <img src={selected.url || selected.dataUrl} alt={selected.label} style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 12 }} />
          <div style={{ color: '#fff', marginTop: 12, fontWeight: 700 }}>{selected.label}</div>
          {selected.notes && <div style={{ color: '#ff4444', fontSize: 13, marginTop: 4 }}>{selected.notes}</div>}
          <button onClick={() => setSelected(null)} style={{ marginTop: 20, padding: '12px 32px', background: '#222', color: '#fff', border: '1px solid #333', borderRadius: 10, cursor: 'pointer' }}>Close</button>
        </div>
      )}
    </div>
  );
}
