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
  { id: 'MZ', name: 'Mohd Zamri' }, // from timetable
];

const timeSlots = [
  "0720-0750", "0750-0820", "0820-0850", "0850-0920", "0920-0950",
  "0950-1010", // rehat / perhimpunan etc.
  "1010-1040", "1040-1110", "1110-1140", "1140-1210", "1210-1240"
];

// ✅ Raw data extracted from Jadual Waktu Induk 2025
// Each slot is either: "", "PH", "R", "H", "E", "A", "T" (ignored) OR "SUBJECT/TEACHER"
const rawData: Record<string, Record<string, string[]>> = {
  ISNIN: {
    "TAHUN 1": ["BM/NS", "BM/NS", "PK/NZ", "BI/FS", "BI/FS", "R", "PM/AY PI/IM", "PM/AY PI/IM", "MT/SD", "MT/SD"],
    "TAHUN 2": ["BM/JL", "BM/JL", "BM/JL", "MT/KV", "MT/KV", "R", "PM/MN", "PM/MN", "BI/FS", "BI/FS"],
    "TAHUN 3": ["SN/KV", "SN/KV", "BI/BB", "BI/BB", "MT/NS", "R", "PM/SD PI/IM", "PM/SD PI/IM", "BM/JL", "BM/JL"],
    "TAHUN 4": ["BI/MN", "BI/MN", "MT/IM", "SN/AY", "SN/AY", "R", "BM/NS", "BM/NS", "PK/NZ", "PS/BB"],
    "TAHUN 5": ["BI/FS", "BI/FS", "MT/SD", "BM/NZ", "BM/NZ", "R", "SN/JL", "PM/BB", "PM/BB", "RBT/AY"],
    "TAHUN 6": ["BI/BB", "SEJ/AY", "SEJ/AY", "MT/IM", "MT/IM", "R", "BM/NZ", "BM/NZ", "MZ/IM", "SN/MA"],
  },
  SELASA: {
    "TAHUN 1": ["", "BM/NS", "BM/NS", "BI/FS", "BI/FS", "R", "MT/SD", "MT/SD", "PS/NS", "PS/NS"],
    "TAHUN 2": ["", "BM/JL", "BM/JL", "PM/MN", "PM/MN", "R", "MT/KV", "MT/KV", "BI/FS", "BI/FS"],
    "TAHUN 3": ["PH", "PH", "PH", "PH", "PH", "R", "BM/JL", "BM/JL", "PS/SD", "PS/SD"],
    "TAHUN 4": ["", "MT/IM", "MT/IM", "RBT/AY", "RBT/AY", "R", "BM/NS", "BM/NS", "SN/AY", "BI/MN"],
    "TAHUN 5": ["", "BI/FS", "BI/FS", "MT/SD", "MT/SD", "R", "SEJ/AY", "SEJ/AY", "BM/NZ", "PM/BB"],
    "TAHUN 6": ["", "BM/NZ", "BM/NZ", "MT/IM", "MT/IM", "R", "MT/IM", "BI/BB", "BI/BB", "SN/MA"],
  },
  RABU: {
    "TAHUN 1": ["BI/FS", "BI/FS", "PM/AY PI/IM", "BM/NS", "BM/NS", "H", "BM/NS", "MZ/KV", "PM/AY PI/IM", "PM/AY PI/IM"],
    "TAHUN 2": ["PM/MN", "PJ/IM", "PJ/IM", "BM/JL", "BM/JL", "H", "BI/FS", "BI/FS", "MT/KV", "MT/KV"],
    "TAHUN 3": ["MT/NS", "MT/NS", "PM/SD PI/IM", "BI/BB", "BI/BB", "H", "BM/JL", "BM/JL", "PM/SD PI/IM", "PM/SD PI/IM"],
    "TAHUN 4": ["PJ/NZ", "PJ/NZ", "BI/MN", "SEJ/AY", "SEJ/AY", "H", "PM/SD PI/IM", "PM/SD PI/IM", "BM/NS", "PK/NZ"],
    "TAHUN 5": ["PJ/MA", "PJ/MA", "PM/BB", "BI/FS", "BI/FS", "H", "MZ/AY", "BM/NZ", "BM/NZ", "SN/JL"],
    "TAHUN 6": ["PS/SD", "PS/SD", "BM/NZ", "MT/IM", "MT/IM", "H", "PM/MJ PI/IM", "PM/MJ PI/IM", "BI/BB", "PK/MA"],
  },
  KHAMIS: {
    "TAHUN 1": ["BI/FS", "PJ/NZ", "PJ/NZ", "BM/NS", "BM/NS", "R", "SN/AY", "SN/AY", "MT/SD", "MT/SD"],
    "TAHUN 2": ["MT/KV", "MT/KV", "BI/FS", "BI/FS", "R", "PK/AY", "PS/FS", "PS/FS", "BM/JL", "BM/JL"],
    "TAHUN 3": ["BM/JL", "BM/JL", "MZ/SD", "BI/BB", "BI/BB", "R", "SN/KV", "SN/KV", "MT/NS", "MT/NS"],
    "TAHUN 4": ["BM/NS", "SN/AY", "SN/AY", "PM/SD PI/IM", "PM/SD PI/IM", "R", "BI/MN", "BI/MN", "MT/IM", "MT/IM"],
    "TAHUN 5": ["MT/SD", "MT/SD", "SN/JL", "SN/JL", "BI/FS", "R", "BM/NZ", "BM/NZ", "PS/AY", "PS/AY"],
    "TAHUN 6": ["BI/BB", "BI/BB", "SN/MA", "PM/MJ PI/IM", "PM/MJ PI/IM", "R", "RBT/BB", "RBT/BB", "BM/NZ", "BM/NZ"],
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

// ✅ Build final timetable
export const TIMETABLE: ScheduleEntry[] = [];

Object.entries(rawData).forEach(([day, classes]) => {
  Object.entries(classes).forEach(([className, subjects]) => {
    subjects.forEach((subjectTeacher, index) => {
      if (!subjectTeacher || ["PH", "R", "H", "E", "A", "T"].includes(subjectTeacher)) return;

      // Multiple teachers
      if (subjectTeacher.includes(" ")) {
        const parsedSubjects = subjectTeacher.split(" ").map((p) => {
          const [subject, teacherId] = p.split("/");
          return { subject, teacherId };
        });
        TIMETABLE.push({
          day,
          time: timeSlots[index],
          class: className,
          subjects: parsedSubjects,
          isJoint: true,
        });
      }
      // Single teacher
      else if (subjectTeacher.includes("/")) {
        const [subject, teacherId] = subjectTeacher.split("/");
        TIMETABLE.push({
          day,
          time: timeSlots[index],
          class: className,
          subjects: [{ subject, teacherId }],
        });
      }
    });
  });
});
