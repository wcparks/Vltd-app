// ============================================================
// FILE: src/CarAutocomplete.js
// PURPOSE: Smart autocomplete for make/model, color, plate
//          Learns from previous tickets, common cars bubble up
// USAGE:
//   <CarMakeModelInput value={make} onChange={setMake} ticketHistory={[]} />
//   <CarColorInput value={color} onChange={setColor} />
//   <PlateInput value={plate} onChange={setPlate} />
// ============================================================

import React, { useState, useRef, useEffect } from "react";

// ── CAR DATABASE ──────────────────────────────────────────
const CAR_MAKES = [
  "Acura", "Alfa Romeo", "Aston Martin", "Audi", "Bentley", "BMW",
  "Buick", "Cadillac", "Chevrolet", "Chrysler", "Dodge", "Ferrari",
  "Fiat", "Ford", "Genesis", "GMC", "Honda", "Hyundai", "Infiniti",
  "Jaguar", "Jeep", "Kia", "Lamborghini", "Land Rover", "Lexus",
  "Lincoln", "Maserati", "Mazda", "McLaren", "Mercedes-Benz", "MINI",
  "Mitsubishi", "Nissan", "Porsche", "Ram", "Rivian", "Rolls-Royce",
  "Subaru", "Tesla", "Toyota", "Volkswagen", "Volvo",
];

const CAR_MODELS = {
  Toyota: ["Camry", "Corolla", "RAV4", "Highlander", "Tacoma", "Tundra", "4Runner", "Prius", "Sienna", "Venza", "Crown", "Sequoia", "Land Cruiser", "GR86", "Supra"],
  Honda: ["Accord", "Civic", "CR-V", "Pilot", "Odyssey", "HR-V", "Ridgeline", "Passport", "Insight", "Element"],
  Ford: ["F-150", "Mustang", "Explorer", "Escape", "Edge", "Bronco", "Expedition", "Maverick", "Ranger", "EcoSport"],
  Chevrolet: ["Silverado", "Equinox", "Traverse", "Tahoe", "Suburban", "Malibu", "Colorado", "Blazer", "Camaro", "Corvette", "Trax"],
  BMW: ["3 Series", "5 Series", "7 Series", "X1", "X3", "X5", "X7", "M3", "M5", "i4", "iX"],
  "Mercedes-Benz": ["C-Class", "E-Class", "S-Class", "GLC", "GLE", "GLS", "A-Class", "CLA", "AMG GT", "EQS", "G-Class"],
  Audi: ["A4", "A6", "A8", "Q3", "Q5", "Q7", "Q8", "e-tron", "TT", "R8"],
  Lexus: ["ES", "IS", "LS", "RX", "NX", "GX", "LX", "UX", "RC", "LC"],
  Nissan: ["Altima", "Sentra", "Rogue", "Murano", "Pathfinder", "Armada", "Frontier", "Titan", "370Z", "GT-R", "Leaf"],
  Jeep: ["Grand Cherokee", "Wrangler", "Cherokee", "Compass", "Gladiator", "Renegade"],
  Ram: ["1500", "2500", "3500", "ProMaster"],
  GMC: ["Sierra", "Yukon", "Acadia", "Terrain", "Canyon", "Envoy"],
  Hyundai: ["Sonata", "Elantra", "Tucson", "Santa Fe", "Palisade", "Kona", "Ioniq 5", "Ioniq 6"],
  Kia: ["Optima", "Forte", "Sorento", "Telluride", "Sportage", "Soul", "Stinger", "EV6"],
  Subaru: ["Outback", "Forester", "Impreza", "Legacy", "Crosstrek", "Ascent", "WRX", "BRZ"],
  Volkswagen: ["Jetta", "Passat", "Tiguan", "Atlas", "Golf", "GTI", "ID.4", "Arteon"],
  Tesla: ["Model 3", "Model Y", "Model S", "Model X", "Cybertruck"],
  Porsche: ["911", "Cayenne", "Macan", "Panamera", "Taycan", "Boxster"],
  Cadillac: ["Escalade", "CT5", "CT4", "XT5", "XT6", "Lyriq"],
  Acura: ["MDX", "RDX", "TLX", "ILX", "NSX", "Integra"],
  Infiniti: ["Q50", "Q60", "QX50", "QX60", "QX80"],
  Lincoln: ["Navigator", "Aviator", "Corsair", "Nautilus"],
  Buick: ["Enclave", "Encore", "Envision"],
  Volvo: ["XC90", "XC60", "XC40", "S60", "S90", "V60"],
  Genesis: ["G70", "G80", "G90", "GV70", "GV80"],
  Mazda: ["Mazda3", "Mazda6", "CX-5", "CX-9", "CX-30", "CX-50", "MX-5 Miata"],
  Mitsubishi: ["Outlander", "Eclipse Cross", "Galant"],
  Dodge: ["Challenger", "Charger", "Durango", "Journey"],
  Chrysler: ["Pacifica", "300"],
  "Land Rover": ["Range Rover", "Discovery", "Defender", "Evoque"],
  Jaguar: ["F-Pace", "E-Pace", "XE", "XF", "F-Type", "I-Pace"],
  Maserati: ["Ghibli", "Quattroporte", "Levante", "Grecale"],
  Ferrari: ["Roma", "Portofino", "SF90", "F8", "812"],
  Lamborghini: ["Urus", "Huracan", "Aventador"],
  Bentley: ["Bentayga", "Continental GT", "Flying Spur"],
  "Rolls-Royce": ["Ghost", "Phantom", "Cullinan", "Wraith", "Dawn"],
  "Aston Martin": ["DBX", "Vantage", "DB11", "DBS"],
  Rivian: ["R1T", "R1S"],
};

const COLORS = [
  "Black", "White", "Silver", "Gray", "Red", "Blue", "Dark Blue", "Navy",
  "Green", "Dark Green", "Gold", "Brown", "Yellow", "Orange", "Purple",
  "Burgundy", "Beige", "Champagne", "Cream", "Charcoal", "Gunmetal",
  "Rose Gold", "Bronze", "Copper", "Midnight Blue", "Forest Green",
  "Pearl White", "Matte Black", "Matte Gray",
];

// ── GENERIC AUTOCOMPLETE INPUT ────────────────────────────
function AutocompleteInput({
  value, onChange, suggestions, placeholder, style = {}, onSelect,
  uppercase = false, maxLength,
}) {
  const [open, setOpen] = useState(false);
  const [filtered, setFiltered] = useState([]);
  const wrapRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleChange(e) {
    let val = e.target.value;
    if (uppercase) val = val.toUpperCase();
    onChange(val);
    const q = val.toLowerCase();
    if (q.length === 0) {
      setFiltered(suggestions.slice(0, 8));
      setOpen(true);
      return;
    }
    const starts = suggestions.filter((s) =>
      s.toLowerCase().startsWith(q)
    );
    const contains = suggestions.filter(
      (s) => !s.toLowerCase().startsWith(q) && s.toLowerCase().includes(q)
    );
    setFiltered([...starts, ...contains].slice(0, 8));
    setOpen(true);
  }

  function select(val) {
    onChange(val);
    setOpen(false);
    if (onSelect) onSelect(val);
  }

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <input
        style={{ ...inputStyle, ...style }}
        value={value}
        onChange={handleChange}
        onFocus={() => {
          const q = value.toLowerCase();
          const res = q
            ? suggestions.filter((s) => s.toLowerCase().includes(q))
            : suggestions.slice(0, 8);
          setFiltered(res.slice(0, 8));
          setOpen(true);
        }}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div style={dropdownStyle}>
          {filtered.map((s) => (
            <div
              key={s}
              style={dropItemStyle}
              onMouseDown={() => select(s)}
              onTouchStart={() => select(s)}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── CAR MAKE + MODEL COMBINED ─────────────────────────────
export function CarMakeModelInput({ make, model, onMakeChange, onModelChange, recentCars = [] }) {
  // Build make suggestions — recent makes first
  const recentMakes = [...new Set(recentCars.map((c) => c.make))].filter(Boolean);
  const makeSuggestions = [
    ...recentMakes,
    ...CAR_MAKES.filter((m) => !recentMakes.includes(m)),
  ];

  // Build model suggestions based on selected make
  const recentModels = recentCars
    .filter((c) => c.make === make)
    .map((c) => c.model)
    .filter(Boolean);
  const makeModels = CAR_MODELS[make] || [];
  const modelSuggestions = [
    ...new Set([...recentModels, ...makeModels]),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <AutocompleteInput
        value={make}
        onChange={onMakeChange}
        suggestions={makeSuggestions}
        placeholder="Make (e.g. Toyota)"
        onSelect={(val) => {
          onMakeChange(val);
          // Clear model when make changes
          onModelChange("");
        }}
      />
      <AutocompleteInput
        value={model}
        onChange={onModelChange}
        suggestions={modelSuggestions}
        placeholder={make ? `Model (e.g. ${(CAR_MODELS[make] || ["Camry"])[0]})` : "Model"}
      />
    </div>
  );
}

// ── COLOR INPUT ───────────────────────────────────────────
export function CarColorInput({ value, onChange }) {
  const colorDots = {
    Black: "#1a1a1a", White: "#f8f8f8", Silver: "#c0c0c0", Gray: "#808080",
    Red: "#dc2626", Blue: "#2563eb", "Dark Blue": "#1e3a5f", Navy: "#1e3a8a",
    Green: "#16a34a", "Dark Green": "#14532d", Gold: "#d97706", Brown: "#92400e",
    Yellow: "#eab308", Orange: "#ea580c", Purple: "#7c3aed", Burgundy: "#881337",
    Beige: "#d2b48c", Champagne: "#f7e7ce", Cream: "#fffdd0", Charcoal: "#374151",
    Gunmetal: "#4a5568", "Pearl White": "#f0f0f0",
  };

  return (
    <div>
      <AutocompleteInput
        value={value}
        onChange={onChange}
        suggestions={COLORS}
        placeholder="Color (e.g. Black)"
      />
      {/* Color chip preview */}
      {value && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {COLORS.filter((c) =>
            c.toLowerCase().includes(value.toLowerCase())
          ).slice(0, 6).map((c) => (
            <button
              key={c}
              style={{
                background: colorDots[c] || "#475569",
                border: value === c ? "2px solid #3b82f6" : "2px solid #334155",
                borderRadius: 20,
                padding: "4px 10px",
                color: ["White", "Beige", "Champagne", "Cream", "Pearl White", "Silver", "Gold"].includes(c) ? "#0f172a" : "#fff",
                fontSize: 12,
                cursor: "pointer",
                fontWeight: value === c ? 700 : 400,
              }}
              onMouseDown={() => onChange(c)}
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── LICENSE PLATE INPUT ───────────────────────────────────
export function PlateInput({ value, onChange }) {
  return (
    <input
      style={{
        ...inputStyle,
        textTransform: "uppercase",
        letterSpacing: 4,
        fontSize: 20,
        textAlign: "center",
        fontFamily: "monospace",
        fontWeight: 700,
      }}
      value={value}
      onChange={(e) => onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
      placeholder="ABC 1234"
      maxLength={8}
    />
  );
}

// ── FULL CAR DETAILS FORM ─────────────────────────────────
// Drop-in replacement for your existing car input section
export function CarDetailsForm({ values, onChange, recentCars = [] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <label style={labelStyle}>License Plate</label>
      <PlateInput
        value={values.plate}
        onChange={(v) => onChange({ ...values, plate: v })}
      />

      <label style={labelStyle}>Make & Model</label>
      <CarMakeModelInput
        make={values.make}
        model={values.model}
        onMakeChange={(v) => onChange({ ...values, make: v })}
        onModelChange={(v) => onChange({ ...values, model: v })}
        recentCars={recentCars}
      />

      <label style={labelStyle}>Color</label>
      <CarColorInput
        value={values.color}
        onChange={(v) => onChange({ ...values, color: v })}
      />

      <label style={labelStyle}>Parking Spot</label>
      <input
        style={{ ...inputStyle, textTransform: "uppercase" }}
        value={values.spot}
        onChange={(e) => onChange({ ...values, spot: e.target.value.toUpperCase() })}
        placeholder="Spot (e.g. A12)"
        maxLength={10}
      />
    </div>
  );
}

// ── SHARED STYLES ─────────────────────────────────────────
const inputStyle = {
  background: "#1e293b",
  border: "1px solid #334155",
  borderRadius: 8,
  padding: "12px 14px",
  color: "#f1f5f9",
  fontSize: 16,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const dropdownStyle = {
  position: "absolute",
  top: "100%",
  left: 0,
  right: 0,
  background: "#1e293b",
  border: "1px solid #334155",
  borderRadius: "0 0 8px 8px",
  zIndex: 1000,
  maxHeight: 220,
  overflowY: "auto",
  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
};

const dropItemStyle = {
  padding: "12px 14px",
  color: "#cbd5e1",
  fontSize: 15,
  cursor: "pointer",
  borderBottom: "1px solid #0f172a",
};

const labelStyle = {
  color: "#94a3b8",
  fontSize: 13,
  fontWeight: 600,
  marginBottom: -4,
};
