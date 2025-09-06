// src/components/ScheduleModal.tsx
import React from "react";
import { TIMETABLE, TEACHERS } from "@/constants";

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const daysOrder = ["ISNIN", "SELASA", "RABU", "KHAMIS", "JUMAAT"];

const ScheduleModal: React.FC<ScheduleModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null; // modal hidden

  // group timetable by day
  const groupedByDay: Record<string, typeof TIMETABLE> = {};
  TIMETABLE.forEach((entry) => {
    if (!groupedByDay[entry.day]) groupedByDay[entry.day] = [];
    groupedByDay[entry.day].push(entry);
  });

  const getTeacherName = (id: string) => {
    const t = TEACHERS.find((x) => x.id === id);
    return t ? t.name : id;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-5xl rounded-2xl bg-white p-6 shadow-xl overflow-y-auto max-h-[90vh]">
        <h2 className="text-xl font-bold text-slate-800 mb-4">
          📅 Jadual Waktu Semasa
        </h2>

        <p className="text-sm text-slate-600 mb-6">
          Ini ialah jadual waktu yang sedang digunakan oleh sistem. <br />
          Jika jadual tidak terkini, sila kemaskini fail{" "}
          <code>constants.ts</code>.
        </p>

        {daysOrder.map((day) => (
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
                  {groupedByDay[day]?.map((entry, i) => (
                    <tr key={i} className="border-b border-slate-200">
                      <td className="px-3 py-2 font-mono">{entry.time}</td>
                      <td className="px-3 py-2">{entry.class}</td>
                      <td className="px-3 py-2">
                        {entry.subjects.map((s) => s.subject).join(", ")}
                      </td>
                      <td className="px-3 py-2">
                        {entry.subjects
                          .map((s) => getTeacherName(s.teacherId))
                          .join(", ")}
                      </td>
                    </tr>
                  )) || (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-3 py-2 text-center text-slate-500"
                      >
                        Tiada data untuk hari ini
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        <div className="mt-6 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-sky-600 text-white hover:bg-sky-700 transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleModal;
