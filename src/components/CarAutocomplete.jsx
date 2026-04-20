import { useState, useRef, useEffect } from 'react';

const ACCENT = '#C8F04B';
const BG = '#111';
const BORDER = '#2a2a2a';
const TEXT = '#fff';

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
  'Toyota': ['Camry','Corolla','RAV4','Highlander','Tacoma','Tundra','Prius','4Runner','Sienna','Sequoia','Venza','Supra'],
  'Honda': ['Civic','Accord','CR-V','Pilot','Odyssey','HR-V','Ridgeline','Passport'],
  'Ford': ['F-150','Mustang','Explorer','Escape','Edge','Bronco','Maverick','Ranger','Expedition'],
  'Chevrolet': ['Silverado','Equinox','Malibu','Traverse','Tahoe','Suburban','Colorado','Blazer','Camaro','Corvette'],
  'BMW': ['3 Series','5 Series','7 Series','X3','X5','X7','4 Series','M3','M5','i4','iX','X1'],
  'Mercedes-Benz': ['C-Class','E-Class','S-Class','GLC','GLE','GLS','A-Class','CLA','GLA','EQS'],
  'Nissan': ['Altima','Sentra','Rogue','Pathfinder','Frontier','Titan','Maxima','Murano','Kicks','GT-R','Z'],
  'Audi': ['A4','A6','Q5','Q7','A3','Q3','A8','Q8','TT','R8'],
  'Lexus': ['RX','ES','NX','GX','IS','LS','UX','LX'],
  'Jeep': ['Wrangler','Grand Cherokee','Cherokee','Compass','Gladiator'],
  'Tesla': ['Model 3','Model Y','Model S','Model X','Cybertruck'],
  'Hyundai': ['Tucson','Santa Fe','Sonata','Elantra','Palisade','Kona','Ioniq 5','Ioniq 6'],
  'Kia': ['Telluride','Sorento','Sportage','Forte','Soul','Carnival','EV6','Stinger'],
  'Dodge': ['Charger','Challenger','Durango'],
  'GMC': ['Sierra','Yukon','Terrain','Acadia','Canyon'],
  'Subaru': ['Outback','Forester','Crosstrek','Impreza','Ascent','WRX'],
  'Volkswagen': ['Jetta','Passat','Tiguan','Atlas','Golf','ID.4'],
  'Porsche': ['Cayenne','Macan','911','Panamera','Taycan'],
  'Ram': ['1500','2500','3500'],
  'Mazda': ['Mazda3','Mazda6','CX-5','CX-9','CX-30','MX-5 Miata'],
  'Cadillac': ['Escalade','XT5','XT6','CT5','CT4'],
  'Acura': ['MDX','RDX','TLX'],
  'Infiniti': ['QX60','QX80','Q50','QX55'],
  'Lincoln': ['Navigator','Aviator','Corsair','Nautilus'],
  'Volvo': ['XC90','XC60','XC40','S60'],
  'Land Rover': ['Range Rover','Discovery','Defender','Evoque'],
  'Genesis': ['GV80','GV70','G80','G70'],
  'Rivian': ['R1T','R1S'],
};

const COLORS = ['Black','White','Silver','Gray','Red','Blue','Navy','Dark Blue','Green','Gold','Champagne','Beige','Brown','Yellow','Orange','Purple','Burgundy','Maroon','Gunmetal','Charcoal'];

const COLOR_HEX = {
  'Black':'#1a1a1a','White':'#f5f5f5','Silver':'#aaa','Gray':'#777',
  'Red':'#c0392b','Blue':'#2980b9','Navy':'#1a3a5c','Dark Blue':'#1a3a5c',
  'Green':'#27ae60','Gold':'#c9a227','Champagne':'#e8d5a3','Beige':'#d4c5a0',
  'Brown':'#8b6914','Yellow':'#f1c40f','Orange':'#e67e22','Purple':'#8e44ad',
  'Burgundy':'#6d0f1f','Maroon':'#800000','Gunmetal':'#4a4a4a','Charcoal':'#36454f',
};

function DarkAutoInput({ label, value, onChange, suggestions, placeholder, mono }) {
  const [open, setOpen] = useState(false);
  const [filtered, setFiltered] = useState([]);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) { if (!ref.current?.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleChange(e) {
    const val = mono ? e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'') : e.target.value;
    onChange(val);
    if (val.length >= 1 && suggestions.length) {
      const f = suggestions.filter(s => s.toLowerCase().startsWith(val.toLowerCase())).slice(0, 8);
      const f2 = suggestions.filter(s => !s.toLowerCase().startsWith(val.toLowerCase()) && s.toLowerCase().includes(val.toLowerCase())).slice(0, 4);
      const combined = [...f, ...f2].slice(0, 8);
      setFiltered(combined);
      setOpen(combined.length > 0);
    } else {
      setOpen(false);
    }
  }

  return (
    <div ref={ref} style={{ flex: 1, position: 'relative' }}>
      <div style={{ fontSize: '8px', color: '#888', letterSpacing: '2px', marginBottom: 6 }}>{label}</div>
      <input
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: '12px', background: BG,
          border: '1px solid ' + BORDER, borderRadius: 10,
          color: TEXT, fontSize: mono ? 15 : 13,
          fontFamily: mono ? "'DM Mono', monospace" : 'sans-serif',
          letterSpacing: mono ? 2 : 0,
          outline: 'none',
        }}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => {
          if (value.length >= 1 && suggestions.length) {
            const f = suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase())).slice(0, 8);
            setFiltered(f); setOpen(f.length > 0);
          }
        }}
      />
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          background: '#1a1a1a', border: '1px solid ' + ACCENT + '44',
          borderRadius: 10, zIndex: 999, overflow: 'hidden', marginTop: 2,
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
        }}>
          {filtered.map(item => (
            <div
              key={item}
              onMouseDown={() => { onChange(item); setOpen(false); }}
              onTouchEnd={() => { onChange(item); setOpen(false); }}
              style={{
                padding: '13px 14px', cursor: 'pointer',
                fontSize: 14, color: '#fff',
                borderBottom: '1px solid #2a2a2a',
                fontFamily: 'sans-serif',
              }}
            >
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CarAutocomplete({ value = {}, onChange }) {
  const models = MODELS_BY_MAKE[value.make] || [];

  function update(field, val) {
    const updated = { ...value, [field]: val };
    if (field === 'make') updated.model = '';
    onChange(updated);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <DarkAutoInput label="MAKE" value={value.make || ''} onChange={v => update('make', v)} suggestions={CAR_MAKES} placeholder="Toyota..." />
        <DarkAutoInput label="MODEL" value={value.model || ''} onChange={v => update('model', v)} suggestions={models} placeholder="Camry..." />
      </div>

      <DarkAutoInput label="COLOR" value={value.color || ''} onChange={v => update('color', v)} suggestions={COLORS} placeholder="Black..." />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {['Black','White','Silver','Gray','Red','Blue','Navy'].map(c => (
          <button key={c} type="button"
            onClick={() => update('color', c)}
            style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 11,
              cursor: 'pointer', fontWeight: 600, border: '2px solid',
              borderColor: value.color === c ? ACCENT : 'transparent',
              background: COLOR_HEX[c] || '#888',
              color: ['White','Silver','Champagne','Beige','Gold'].includes(c) ? '#000' : '#fff',
            }}
          >{c}</button>
        ))}
      </div>

      <DarkAutoInput label="LICENSE PLATE" value={value.plate || ''} onChange={v => update('plate', v)} suggestions={[]} placeholder="ABC1234" mono />
    </div>
  );
}
