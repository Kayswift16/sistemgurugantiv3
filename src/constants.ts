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

const timeSlots = [
  "0720-0750", "0750-0820", "0820-0850", "0850-0920", "0920-0950",
  "0950-1010", // Rehat
  "1010-1040", "1040-1110", "1110-1140", "1140-1210", "1210-1240"
];

// ⚡ Paste your rawData from PDF here. Example (partial, you must complete with real subjects):
const rawData: Record<string, Record<string, string[]>> = {
  ISNIN: {
    "TAHUN 1": ["BM/NS", "BM/NS", "PK/NZ", "BI/FS", "BI/FS", "R", "PM/AY PI/IM", "PM/AY PI/IM", "MT/SD", "MT/SD", ""],
    "TAHUN 2": ["BM/JL", "BM/JL", "BM/JL", "MT/KV", "MT/KV", "PM/MN", "PM/MN", "BI/FS", "BI/FS", "", ""],
    // ... complete for Tahun 3–6
  },
  SELASA: {
    "TAHUN 1": ["", "BM/NS", "BM/NS", "BI/FS", "BI/FS", "R", "MT/SD", "MT/SD", "PS/NS", "PS/NS", ""],
    // ... complete Tahun 2–6
  },
  // Add RABU, KHAMIS, JUMAAT fully from PDF
};

export const TIMETABLE: ScheduleEntry[] = [];

Object.entries(rawData).forEach(([day, classes]) => {
  Object.entries(classes).forEach(([className, subjects]) => {
    subjects.forEach((subjectTeacher, index) => {
      if (!subjectTeacher || ["PH", "H", "R", "E", "A", "T"].includes(subjectTeacher)) return;

      // Joint teaching (two teachers same slot, e.g. "PM/AY PI/IM")
      if (subjectTeacher.includes(' ')) {
        const parsedSubjects = subjectTeacher.split(' ').map(p => {
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
      // Fix OCR typo (PM.SD)
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
