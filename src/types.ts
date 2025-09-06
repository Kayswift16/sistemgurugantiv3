// A teacher with unique ID + full name
export interface Teacher {
  id: string;
  name: string;
}

// A subject taught by a specific teacher in a slot
export interface SubjectTeacher {
  subject: string;
  teacherId: string;
}

// A single timetable entry (1 class, 1 slot, can have multiple teachers)
export interface ScheduleEntry {
  day: string;                   // ISNIN, SELASA, ...
  time: string;                  // e.g. "0720-0750"
  class: string;                 // e.g. "TAHUN 4"
  subjects: SubjectTeacher[];    // supports multiple teachers in one slot
  isJoint?: boolean;             // true if >1 teacher in that slot
}

// User input when marking absences
export interface AbsentTeacherInfo {
  key: string;   // for React lists
  id: string;    // teacher.id
  reason: string;
}

// AI-generated substitution (one row in the final plan)
export interface Substitution {
  day: string;
  time: string;
  class: string;
  subject: string;
  absentTeachers: { id: string; name: string }[]; // ✅ multiple absent teachers
  substituteTeacherId: string;
  substituteTeacherName: string;
  justification: string;
}
