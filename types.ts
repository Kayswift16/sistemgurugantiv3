export interface Teacher {
  id: string;
  name: string;
}

export interface ScheduleEntry {
  day: string;
  time: string;
  class: string;
  subjects: { subject: string; teacherId: string }[]; // can be 1 or more
  isJoint?: boolean; // true if multiple teachers teach together
}

export interface Substitution {
  day: string;
  time: string;
  class: string;
  absentTeachers: { name: string; id: string }[]; // can be multiple if joint
  subject: string;
  substituteTeacherId: string;
  substituteTeacherName: string;
  justification: string;
}

export interface AbsentTeacherInfo {
  key: string;
  id: string;
  reason: string;
}
