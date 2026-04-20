// ============================================================
// CarAutocomplete.jsx — Smart car details autocomplete
// Place at: src/components/CarAutocomplete.jsx
//
// USAGE — replace your existing car detail inputs with:
//   import CarAutocomplete from './components/CarAutocomplete';
//
//   <CarAutocomplete
//     value={carDetails}
//     onChange={setCarDetails}
//   />
//
//   carDetails = { make: '', model: '', color: '', plate: '' }
// ============================================================
import { useState, useRef, useEffect } from 'react';

// ── Car database ───────────────────────────────────────────
const CAR_MAKES = [
  'Acura','Alfa Romeo','Aston Martin','Audi','Bentley','BMW','Buick',
  'Cadillac','Chevrolet','Chrysler','Dodge','Ferrari','Fiat','Ford',
  'Genesis','GMC','Honda','Hyundai','Infiniti','Jaguar','Jeep','Kia',
  'Lamborghini','Land Rover','Lexus','Lincoln','Maserati','Mazda',
  'McLaren','Mercedes-Benz','MINI','Mitsubishi','Nissan','Polestar',
  'Porsche','Ram','Rivian','Rolls-Royce','Subaru','Tesla','Toyota',
  'Volkswagen','Volvo',
];

const MODELS_BY_MAKE = {
  'Toyota': ['Camry','Corolla','RAV4','Highlander','Tacoma','Tundra','Prius','4Runner','Sienna','Sequoia','Venza','C-HR','GR86','Supra'],
  'Honda': ['Civic','Accord','CR-V','Pilot','Odyssey','HR-V','Ridgeline','Passport','Insight','Element'],
  'Ford': ['F-150','Mustang','Explorer','Escape','Edge','Bronco','Maverick','Ranger','Expedition','EcoSport','Fusion','Focus'],
  'Chevrolet': ['Silverado','Equinox','Malibu','Traverse','Tahoe','Suburban','Colorado','Blazer','Trax','Camaro','Corvette'],
  'BMW': ['3 Series','5 Series','7 Series','X3','X5','X7','4 Series','2 Series','M3','M5','i4','iX','X1','X4','X6'],
  'Mercedes-Benz': ['C-Class','E-Class','S-Class','GLC','GLE','GLS','A-Class','CLA','GLA','AMG GT','EQS','EQE'],
  'Nissan': ['Altima','Sentra','Rogue','Pathfinder','Frontier','Titan','Maxima','Murano','Kicks','Armada','GT-R','Z'],
  'Audi': ['A4','A6','Q5','Q7','A3','Q3','A8','e-tron','Q8','TT','R8'],
  'Lexus': ['RX','ES','NX','GX','IS','LS','UX','LX','LC','RC'],
  'Jeep': ['Wrangler','Grand Cherokee','Cherokee','Compass','Renegade','Gladiator','Wagoner'],
  'Tesla': ['Model 3','Model Y','Model S','Model X','Cybertruck'],
  'Hyundai': ['Tucson','Santa Fe','Sonata','Elantra','Palisade','Kona','Ioniq 5','Ioniq 6'],
  'Kia': ['Telluride','Sorento','Sportage','Forte','Soul','Carnival','EV6','Stinger'],
  'Dodge': ['Charger','Challenger','Durango','RAM 1500'],
  'GMC': ['Sierra','Yukon','Terrain','Acadia','Canyon','Envoy'],
  'Subaru': ['Outback','Forester','Crosstrek','Impreza','Ascent','Legacy','WRX','BRZ'],
  'Volkswagen': ['Jetta','Passat','Tiguan','Atlas','Golf','ID.4','Arteon'],
  'Porsche': ['Cayenne','Macan','911','Panamera','Taycan','Boxster','Cayman'],
  'Ram': ['1500','2500','3500','ProMaster'],
  'Mazda': ['Mazda3','Mazda6','CX-5','CX-9','CX-30','MX-5 Miata','CX-50'],
  'Cadillac': ['Escalade','XT5','XT6','CT5','CT4','Lyriq'],
  'Acura': ['MDX','RDX','TLX','ILX','NSX'],
  'Infiniti': ['QX60','QX80','Q50','QX55','Q60'],
  'Lincoln': ['Navigator','Aviator','Corsair','Nautilus'],
  'Buick': ['Enclave','Encore','Envision','LaCrosse'],
  'Volvo': ['XC90','XC60','XC40','S60','V60','C40'],
  'Land Rover': ['Range Rover','Discovery','Defender','Evoque','Velar'],
  'Genesis': ['GV80','GV70','G80','G70','GV60'],
  'Rivian': ['R1T','R1S'],
  'Polestar': ['Polestar 2','Polestar 3'],
};

const COLORS = [
  'Black','White','Silver','Gray','Red','Blue','Navy','Dark Blue',
  'Green','Dark Green','Gold','Champagne','Beige','Brown','Tan',
  'Yellow','Orange','Purple','Burgundy','Maroon','Gunmetal',
  'Charcoal','Pearl White','Space Gray','Midnight Blue',
];

// ── Autocomplete input ─────────────────────────────────────
function AutoInput({ label, value, onChange, suggestions, placeholder, transform }) {
  const [open, setOpen] = useState(false);
  const [filtered, setFiltered] = useState([]);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (!ref.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleChange(e) {
    const val = transform ? transform(e.target.value) : e.target.value;
    onChange(val);
    if (val.length >= 1) {
      const f = suggestions.filter(s => s.toLowerCase().includes(val.toLowerCase())).slice(0, 8);
      setFiltered(f);
      setOpen(f.length > 0);
    } else {
      setOpen(false);
    }
  }

  function select(item) {
    onChange(item);
    setOpen(false);
  }

  return (
    <div ref={ref} style={{ position: 'relative', flex: 1 }}>
      <label style={styles.label}>{label}</label>
      <input
        style={styles.input}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => {
          if (value.length >= 1) {
            const f = suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase())).slice(0, 8);
            setFiltered(f);
            setOpen(f.length > 0);
          }
        }}
      />
      {open && (
        <div style={styles.dropdown}>
          {filtered.map(item => (
            <div key={item} style={styles.option} onMouseDown={() => select(item)}>
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────
export default function CarAutocomplete({ value = {}, onChange }) {
  const models = MODELS_BY_MAKE[value.make] || [];

  function update(field, val) {
    const updated = { ...value, [field]: val };
    if (field === 'make') updated.model = ''; // reset model on make change
    onChange(updated);
  }

  return (
    <div style={styles.wrap}>
      {/* Make + Model */}
      <div style={styles.row}>
        <AutoInput
          label="Make"
          value={value.make || ''}
          onChange={v => update('make', v)}
          suggestions={CAR_MAKES}
          placeholder="Toyota…"
        />
        <AutoInput
          label="Model"
          value={value.model || ''}
          onChange={v => update('model', v)}
          suggestions={models.length ? models : []}
          placeholder="Camry…"
        />
      </div>

      {/* Color */}
      <AutoInput
        label="Color"
        value={value.color || ''}
        onChange={v => update('color', v)}
        suggestions={COLORS}
        placeholder="Black…"
      />

      {/* Quick color chips */}
      <div style={styles.chips}>
        {['Black','White','Silver','Gray','Red','Blue','Navy'].map(c => (
          <button
            key={c}
            type="button"
            style={{
              ...styles.chip,
              background: colorHex(c),
              color: ['White','Silver','Champagne','Beige','Gold'].includes(c) ? '#333' : '#fff',
              border: value.color === c ? '2px solid #1a1a1a' : '2px solid transparent',
            }}
            onClick={() => update('color', c)}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Plate */}
      <div>
        <label style={styles.label}>License Plate</label>
        <input
          style={{ ...styles.input, fontFamily: 'monospace', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700 }}
          value={value.plate || ''}
          onChange={e => update('plate', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          placeholder="ABC 1234"
          maxLength={8}
        />
      </div>
    </div>
  );
}

function colorHex(c) {
  const map = {
    'Black': '#1a1a1a', 'White': '#f5f5f5', 'Silver': '#aaa',
    'Gray': '#777', 'Red': '#c0392b', 'Blue': '#2980b9',
    'Navy': '#1a3a5c', 'Dark Blue': '#1a3a5c', 'Green': '#27ae60',
    'Gold': '#c9a227', 'Champagne': '#e8d5a3', 'Beige': '#d4c5a0',
    'Brown': '#8b6914', 'Yellow': '#f1c40f', 'Orange': '#e67e22',
    'Purple': '#8e44ad', 'Burgundy': '#6d0f1f', 'Maroon': '#800000',
    'Gunmetal': '#4a4a4a', 'Charcoal': '#36454f',
  };
  return map[c] || '#888';
}

const styles = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 12 },
  row: { display: 'flex', gap: 10 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { width: '100%', boxSizing: 'border-box', padding: '12px 14px', border: '1px solid #ddd', borderRadius: 10, fontSize: 15, outline: 'none', background: '#fff' },
  dropdown: { position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #ddd', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 100, overflow: 'hidden', marginTop: 2 },
  option: { padding: '11px 14px', cursor: 'pointer', fontSize: 14, borderBottom: '1px solid #f5f5f5' },
  chips: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  chip: { padding: '4px 10px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontWeight: 500 },
};
