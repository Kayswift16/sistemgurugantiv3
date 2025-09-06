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
  { id: 'MZ', name: 'Mohd Zamri' }, // added from timetable
];

const timeSlots = [
  "0720-0750", "0750-0820", "0820-0850", "0850-0920", "0920-0950",
  "0950-1010", "1010-1040", "1040-1110", "1110-1140", "1140-1210", "1210-1240"
];

// ✅ Raw data from Jadual Waktu Induk 2025 (supports multiple teachers)
const rawData: Record<string, Record<string, string[]>> = {
  ISNIN: {
    "TAHUN 1": ["BM/NS", "BM/NS", "PK/NZ", "BI/FS", "BI/FS", "R", "PM/AY PI/IM", "PM/AY PI/IM", "MT/SD", "MT/SD"],
    "TAHUN 2": ["BM/JL", "BM/JL", "BM/JL", "MT/KV", "MT/KV", "PM/MN", "PM/MN", "BI/FS", "BI/FS", ""],
    "TAHUN 3": ["SN/KV", "SN/KV", "BI/BB", "BI/BB", "MT/NS", "PM/SD PI/IM", "PM/SD PI/IM", "BM/JL", "BM/JL", ""],
    "TAHUN 4": ["BI/MN", "BI/MN", "MT/IM", "SN/AY", "SN/AY", "BM/NS", "BM/NS", "PK/NZ", "PS/BB", "PS/BB"],
    "TAHUN 5": ["BI/FS", "BI/FS", "MT/SD", "BM/NZ", "BM/NZ", "SN/JL", "PM/BB", "PM/BB", "RBT/AY", "RBT/AY"],
    "TAHUN 6": ["BI/BB", "SEJ/AY", "SEJ/AY", "MT/IM", "MT/IM", "BM/NZ", "BM/NZ", "MZ/IM", "SN/MA", "SN/MA"],
  },
  RABU: {
    "TAHUN 1": ["BI/FS", "BI/FS", "PM/AY PI/IM", "BM/NS", "BM/NS", "H", "BM/NS", "MZ/KV", "PM/AY PI/IM", "PM/AY PI/IM"],
    "TAHUN 3": ["MT/NS", "MT/NS", "PM/SD PI/IM", "BI/BB", "BI/BB", "BM/JL", "BM/JL", "PM/SD PI/IM", "PM/SD PI/IM", ""],
    "TAHUN 4": ["PJ/NZ", "PJ/NZ", "BI/MN", "SEJ/AY", "SEJ/AY", "PM/SD PI/IM", "PM/SD PI/IM", "BM/NS", "BM/NS", "PK/NZ"],
    "TAHUN 6": ["PS/SD", "PS/SD", "BM/NZ", "MT/IM", "MT/IM", "PM/MJ PI/IM", "PM/MJ PI/IM", "BI/BB", "BI/BB", "PK/MA"],
  },
  KHAMIS: {
    "TAHUN 4": ["BI/MN", "BI/MN", "SN/AY", "SN/AY", "BM/NS", "PM/SD PI/IM", "PM/SD PI/IM", "MT/IM", "MT/IM", ""],
    "TAHUN 6": ["BI/BB", "BI/BB", "SN/MA", "RBT/BB", "RBT/BB", "PM/MJ PI/IM", "PM/MJ PI/IM", "BM/NZ", "BM/NZ", ""],
  },
  JUMAAT: {
    "TAHUN 4": ["BM/NS", "BM/NS", "PM/SD PI/IM", "BI/MN", "BI/MN", "MT/IM", "MT/IM", "", "", ""],
    "TAHUN 6": ["PJ/MA", "PJ/MA", "PM/MJ PI/IM", "BI/BB", "BI/BB", "BM/NZ", "BM/NZ", "", "", ""],
  },
};

export const TIMETABLE: ScheduleEntry[] = [];

Object.entries(rawData).forEach(([day, classes]) => {
  Object.entries(classes).forEach(([className, subjects]) => {
    subjects.forEach((subjectTeacher, index) => {
      if (!subjectTeacher || subjectTeacher === "PH" || subjectTeacher === "H" || subjectTeacher === "R") return;

      // Multiple teachers in same slot
      if (subjectTeacher.includes(' ')) {
        const parts = subjectTeacher.split(' ');
        const parsedSubjects = parts.map(p => {
          const [subject, teacherId] = p.split('/');
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
      // Normal single teacher slot
      else if (subjectTeacher.includes('/')) {
        const [subject, teacherId] = subjectTeacher.split('/');
        TIMETABLE.push({
          day,
          time: timeSlots[index],
          class: className,
          subjects: [{ subject, teacherId }],
        });
      }
      // Special fix
      else if (subjectTeacher === "PM.SD") {
        TIMETABLE.push({
          day,
          time: timeSlots[index],
          class: className,
          subjects: [{ subject: "PM", teacherId: "SD" }],
        });
      }
    });
  });
});
