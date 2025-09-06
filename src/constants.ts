// src/constants.ts
import { Teacher, ScheduleEntry } from './types';

export const TEACHERS: Teacher[] = [
  { id: 'MJ', name: 'Moktar bin Jaman' },
  { id: 'KV', name: 'Kenny Voo Kai Lin' },
  { id: 'MN', name: 'Muhd Nazmi bin Rosli' },
  { id: 'MA', name: 'Mohamad Ali bin Kaling' },
  { id: 'BB', name: 'Baby Trucy Sedrek' },
  { id: 'FS', name: 'Florida Engillia Sim' },
  { id: 'SD', name: 'Surayadi binti Drahman' },
  { id: 'JL', name: 'Jessy Lessy' },
  { id: 'NS', name: 'Nur Syafiqah binti Roslan' },
  { id: 'IM', name: 'Idrus bin Matjisin' },
  { id: 'NZ', name: 'Mohd Nazrin bin Ibrahim' },
  { id: 'AY', name: 'Amy Syahida binti Ahbasah' },
];

// Full day (Mon–Wed): 11 slots incl. REHAT
const FULL_SLOTS = [
  "0720-0750", "0750-0820", "0820-0850", "0850-0920", "0920-0950",
  "0950-1010", // REHAT
  "1010-1040", "1040-1110", "1110-1140", "1140-1210", "1210-1240",
];

// Short day (Thu–Fri): 10 slots (ends 12:10), still includes REHAT
const SHORT_SLOTS = [
  "0720-0750", "0750-0820", "0820-0850", "0850-0920", "0920-0950",
  "0950-1010", // REHAT
  "1010-1040", "1040-1110", "1110-1140", "1140-1210",
];

// Choose which day uses which template
const TIME_SLOTS_BY_DAY: Record<string, string[]> = {
  ISNIN: FULL_SLOTS,
  SELASA: FULL_SLOTS,
  RABU: FULL_SLOTS,
  KHAMIS: SHORT_SLOTS,
  JUMAAT: SHORT_SLOTS,
};

// Treat these as non-teaching “special” blocks that keep timing aligned
const SPECIAL_CODES = new Set(['PH', 'R', 'E', 'H', 'A', 'T']);

// ⚠️ Keep your corrected rawData here (exactly one cell per slot).
// Use 11 cells for ISNIN/SELASA/RABU, 10 cells for KHAMIS/JUMAAT.
// If a class has no activity in a slot, just put "" (empty string).
const rawData: Record<string, Record<string, string[]>> = {
  ISNIN: {
    "TAHUN 1": ["BM/NS", "BM/NS", "PK/NZ", "BI/FS", "BI/FS", "R", "PM/AY PI/IM", "PM/AY PI/IM", "MT/SD", "MT/SD", ""],
    "TAHUN 2": ["BM/JL", "BM/JL", "BM/JL", "MT/KV", "MT/KV", "PM/MN", "PM/MN", "BI/FS", "BI/FS", "", ""],
    "TAHUN 3": ["SN/KV", "SN/KV", "BI/BB", "BI/BB", "MT/NS", "PM/SD PI/IM", "PM/SD PI/IM", "BM/JL", "BM/JL", "", ""],
    "TAHUN 4": ["BI/MN", "BI/MN", "MT/IM", "SN/AY", "SN/AY", "R", "BM/NS", "PK/NZ", "PS/BB", "PS/BB", ""],
    "TAHUN 5": ["BI/FS", "BI/FS", "MT/SD", "BM/NZ", "BM/NZ", "R", "SN/JL", "PM/BB", "PM/BB", "RBT/AY", "RBT/AY"],
    "TAHUN 6": ["BI/BB", "SEJ/AY", "SEJ/AY", "MT/IM", "MT/IM", "R", "BM/NZ", "MZ/IM", "SN/MA", "SN/MA", ""],
  },
  SELASA: {
    "TAHUN 1": ["BM/NS", "BM/NS", "BI/FS", "BI/FS", "MT/SD", "R", "MT/SD", "PS/NS", "PS/NS", "", ""],
    "TAHUN 2": ["BM/JL", "BM/JL", "PM/MN", "PM/MN", "MT/KV", "R", "MT/KV", "BI/FS", "BI/FS", "", ""],
    "TAHUN 3": ["BI/BB", "BI/BB", "PK/NZ", "BM/JL", "BM/JL", "R", "BM/JL", "PS/SD", "PS/SD", "", ""],
    "TAHUN 4": ["MT/IM", "MT/IM", "RBT/AY", "RBT/AY", "BM/NS", "R", "BM/NS", "SN/AY", "BI/MN", "BI/MN", ""],
    "TAHUN 5": ["BI/FS", "BI/FS", "MT/SD", "MT/SD", "SEJ/AY", "R", "SEJ/AY", "BM/NZ", "PM/BB", "PM/BB", ""],
    "TAHUN 6": ["BM/NZ", "BM/NZ", "MT/IM", "MT/IM", "PK/MA", "R", "BI/BB", "BI/BB", "SN/MA", "SN/MA", ""],
  },
  RABU: {
    "TAHUN 1": ["BI/FS", "BI/FS", "PM/AY PI/IM", "BM/NS", "BM/NS", "H", "BM/NS", "MZ/KV", "PM/AY PI/IM", "PM/AY PI/IM", ""],
    "TAHUN 2": ["PM/MN", "BM/JL", "BM/JL", "SN/MA", "SN/MA", "R", "BI/FS", "BI/FS", "MT/KV", "MT/KV", ""],
    "TAHUN 3": ["MT/NS", "MT/NS", "PM/SD PI/IM", "BI/BB", "BI/BB", "R", "BM/JL", "PM/SD PI/IM", "PM/SD PI/IM", "", ""],
    "TAHUN 4": ["PJ/NZ", "PJ/NZ", "BI/MN", "SEJ/AY", "SEJ/AY", "R", "PM/SD PI/IM", "BM/NS", "BM/NS", "MZ/NZ", ""], // check "MZ/NZ"
    "TAHUN 5": ["PJ/MA", "PJ/MA", "PM/BB", "BI/FS", "BI/FS", "R", "MZ/AY", "BM/NZ", "BM/NZ", "SN/JL", ""],
    "TAHUN 6": ["PS/SD", "PS/SD", "BM/NZ", "MT/IM", "MT/IM", "R", "PM/MJ PI/IM", "BI/BB", "BI/BB", "MT/IM", ""],
  },
  KHAMIS: {
    "TAHUN 1": ["BM/NS", "BM/NS", "PJ/NZ", "PJ/NZ", "BI/FS", "R", "SN/AY", "SN/AY", "MT/SD", "MT/SD"],
    "TAHUN 2": ["BI/FS", "BI/FS", "PJ/IM", "PJ/IM", "PK/AY", "R", "PS/FS", "PS/FS", "BM/JL", "BM/JL"],
    "TAHUN 3": ["BM/JL", "BM/JL", "MZ/SD", "SN/KV", "SN/KV", "R", "BI/BB", "BI/BB", "MT/NS", "MT/NS"],
    "TAHUN 4": ["BI/MN", "BI/MN", "SN/AY", "SN/AY", "BM/NS", "R", "PM/SD PI/IM", "MT/IM", "MT/IM", ""],
    "TAHUN 5": ["MT/SD", "MT/SD", "BI/FS", "SN/JL", "SN/JL", "R", "BM/NZ", "BM/NZ", "PS/AY", "PS/AY"],
    "TAHUN 6": ["BI/BB", "BI/BB", "SN/MA", "RBT/BB", "RBT/BB", "R", "PM/MJ PI/IM", "BM/NZ", "BM/NZ", ""],
  },
  JUMAAT: {
    "TAHUN 1": ["BI/FS", "BI/FS", "SN/AY", "SN/AY", "MT/SD", "R", "BM/NS", "BM/NS", "", ""],
    "TAHUN 2": ["BM/JL", "BM/JL", "MT/KV", "BI/FS", "MZ/IM", "R", "SN/MA", "SN/MA", "", ""],
    "TAHUN 3": ["BI/BB", "PJ/NZ", "PJ/NZ", "MT/NS", "MT/NS", "R", "BM/JL", "BM/JL", "", ""],
    "TAHUN 4": ["BM/NS", "BM/NS", "PM/SD PI/IM", "BI/MN", "BI/MN", "R", "MT/IM", "MT/IM", "", ""],
    "TAHUN 5": ["MT/SD", "MT/SD", "PK/MA", "BM/NZ", "BM/NZ", "R", "BI/FS", "BI/FS", "", ""],
    "TAHUN 6": ["PJ/MA", "PJ/MA", "PM/MJ PI/IM", "BI/BB", "BI/BB", "R", "BM/NZ", "BM/NZ", "", ""],
  },
};

export const TIMETABLE: ScheduleEntry[] = [];

// Build a row for every slot, keeping specials to preserve alignment
Object.entries(rawData).forEach(([day, classes]) => {
  const daySlots = TIME_SLOTS_BY_DAY[day] || FULL_SLOTS;

  Object.entries(classes).forEach(([className, cells]) => {
    // ensure length matches time slots (pad or trim)
    const row = [...cells];
    if (row.length < daySlots.length) {
      row.push(...Array(daySlots.length - row.length).fill(""));
    } else if (row.length > daySlots.length) {
      row.length = daySlots.length;
    }

    for (let i = 0; i < daySlots.length; i++) {
      let cell = row[i]?.trim();

      // If break slot empty, auto-fill as R (Rehat) so timing stays obvious
      if (daySlots[i] === "0950-1010" && !cell) cell = "R";

      if (!cell) continue;

      // Special non-teaching blocks (no teacher)
      if (SPECIAL_CODES.has(cell)) {
        TIMETABLE.push({
          day,
          time: daySlots[i],
          class: className,
          subjects: [{ subject: cell, teacherId: "" }],
        });
        continue;
      }

      // Combined subjects like "PM/AY PI/IM"
      const parts = cell.split(" ").filter(Boolean);

      const parsed = parts
        .map((p) => p.split("/"))
        .filter((arr) => arr.length === 2)
        .map(([subject, teacherId]) => ({
          subject: subject.trim(),
          teacherId: (teacherId || "").trim(),
        }));

      // If typo like "BIFS" (no slash), show it as subject (no teacher)
      if (parsed.length === 0 && cell) {
        TIMETABLE.push({
          day,
          time: daySlots[i],
          class: className,
          subjects: [{ subject: cell, teacherId: "" }],
        });
      } else {
        TIMETABLE.push({
          day,
          time: daySlots[i],
          class: className,
          subjects: parsed,
          isJoint: parsed.length > 1,
        });
      }
    }
  });
});
