import React from "react";
import { TIMETABLE, TEACHERS } from "@/constants";

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const daysOrder = ["ISNIN", "SELASA", "RABU", "KHAMIS", "JUMAAT"];

const ScheduleModal: React.FC<ScheduleModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const grouped: Record<string, typeof TIMETABLE> = {};
  TIMETABLE.forEach((e) => {
    (grouped[e.day] ||= []).push(e);
  });

  const teacherName = (id: string) => TEACHERS.find(t => t.id === id)?.name || "";

  const renderSubject = (entry: (typeof TIMETABLE)[number]) => {
    if (entry.subjects.length === 1 && !entry.subjects[0].teacherId) {
      return entry.subjects[0].subject; // e.g. R, PH
    }
    return entry.subjects.map(s => s.subject).join(", ");
  };

  const renderTeacher = (entry: (typeof TIMETABLE)[number]) => {
    if (entry.subjects.length === 1 && !entry.subjects[0].teacherId) return "—";
    return entry.subjects.map(s => teacherName(s.teacherId)).join(", ");
  };

  Object.values(grouped).forEach(list => list.sort((a, b) => a.time.localeCompare(b.time)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-5xl rounded-2xl bg-white p-6 shadow-xl overflow-y-auto max-h-[90vh]">
        <h2 className="text-xl font-bold text-slate-800 mb-4">📅 Jadual Waktu Semasa</h2>
        <p className="text-sm text-slate-600 mb-6">
          Jadual ini termasuk slot khas (PH/R/E/H/A/T) supaya masa kekal sejajar.
        </p>

        {daysOrder.map(day => (
          <div key={day} className="mb-8">
            <h3 className="text-lg font-semibold text-sky-700 mb-3">{day}</h3>
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-100 text-slate-600 uppercase">
                  <tr>
                    <th className="px-3 py-2">Masa</th>
                    <th className="px-3 py-2">Kelas</th>
                    <th className="px-3 py-2">Subjek</th>
                    <th className="px-3 py-2">Guru</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped[day]?.map((entry, i) => (
                    <tr key={`${day}-${i}-${entry.time}-${entry.class}`} className="border-b border-slate-200">
                      <td className="px-3 py-2 font-mono">{entry.time}</td>
                      <td className="px-3 py-2">{entry.class}</td>
                      <td className="px-3 py-2">{renderSubject(entry)}</td>
                      <td className="px-3 py-2">{renderTeacher(entry)}</td>
                    </tr>
                  )) ?? (
                    <tr>
                      <td colSpan={4} className="px-3 py-2 text-center text-slate-500">
                        Tiada data
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        <div className="mt-6 text-right">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-sky-600 text-white hover:bg-sky-700 transition">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleModal;
