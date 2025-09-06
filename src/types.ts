// src/types.ts

// ✅ A teacher in the system
export interface Teacher {
  id: string;
  name: string;
}

// ✅ A subject taught by a specific teacher in a timetable slot
export interface SubjectTeacher {
  subject: string;
  teacherId: string;
}

// ✅ A timetable entry (can have one or more teachers)
export interface ScheduleEntry {
  day: string;
  time: string;
  class: string;
  subjects: SubjectTeacher[]; // multiple teachers supported
  isJoint?: boolean;          // true if more than one teacher is assigned
}

// ✅ For input form when user marks a teacher as absent
export interface AbsentTeacherInfo {
  key: string;   // unique key for React lists
  id: string;    // teacherId
  reason: string;
}

// ✅ A teacher who is absent (used inside Substitution)
export interface AbsentTeacher {
  id: string;
  name: string;
}

// ✅ A substitution plan entry
export interface Substitution {
  day: string;
  time: string;
  class: string;
  subject: string;
  absentTeachers: AbsentTeacher[];   // ✅ now supports multiple absent teachers
  substituteTeacherId: string;
  substituteTeacherName: string;
  justification: string;
}
