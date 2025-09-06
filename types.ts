// src/types.ts
export interface Teacher {
  id: string;
  name: string;
}

export interface SubjectTeacher {
  subject: string;
  teacherId: string;
}

export interface ScheduleEntry {
  day: string;
  time: string;
  class: string;
  subjects: SubjectTeacher[]; // ✅ instead of subject
  isJoint?: boolean;          // optional flag for multiple teachers
}

export interface AbsentTeacherInfo {
  key: string;
  id: string;
  reason: string;
}

export interface Substitution {
  day: string;
  time: string;
  class: string;
  subject: string;
  absentTeacherName: string;
  substituteTeacherId: string;
  substituteTeacherName: string;
  justification: string;
}
