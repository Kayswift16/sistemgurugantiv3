import React from "react";
import type { Substitution } from "@/types";

interface SubstitutionCardProps {
  substitution: Substitution;
}

const SubstitutionCard: React.FC<SubstitutionCardProps> = ({ substitution }) => {
  return (
    <div className="p-4 bg-white border rounded-lg shadow-sm hover:shadow-md transition">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-mono text-slate-500">
          {substitution.day} {substitution.time}
        </span>
        <span className="text-xs px-2 py-1 bg-sky-100 text-sky-700 rounded-md">
          {substitution.class}
        </span>
      </div>

      <div className="text-slate-800 font-semibold">{substitution.subject}</div>

      <div className="mt-2 text-sm text-slate-600">
        <span className="font-medium">Guru Tidak Hadir:</span>{" "}
        {substitution.absentTeachers && substitution.absentTeachers.length > 0
          ? substitution.absentTeachers.map((t) => t.name).join(", ")
          : "Tiada"}
      </div>

      <div className="mt-1 text-sm text-slate-600">
        <span className="font-medium">Guru Ganti:</span>{" "}
        <span className="text-emerald-700 font-semibold">
          {substitution.substituteTeacherName || "(Belum ditentukan)"}
        </span>
      </div>

      {substitution.justification && (
        <div className="mt-2 text-xs text-slate-500 italic">
          {substitution.justification}
        </div>
      )}
    </div>
  );
};

export default SubstitutionCard;
