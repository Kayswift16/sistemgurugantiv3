import React, { useState, useCallback, useRef, useEffect } from "react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { TEACHERS, TIMETABLE } from "@/constants";
import { Teacher, Substitution, AbsentTeacherInfo } from "@/types";
import { generateSubstitutionPlan } from "@/services/geminiService";
import LoadingSpinner from "@/components/LoadingSpinner";
import ScheduleModal from "@/components/ScheduleModal";

const GraduationCapIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
    <path d="M6 12v5c0 1.7.7 3.2 1.9 4.2a2 2 0 0 0 2.2 0c1.2-1 1.9-2.5 1.9-4.2v-5"></path>
  </svg>
);

const App: React.FC = () => {
  const [absentTeachers, setAbsentTeachers] = useState<AbsentTeacherInfo[]>([
    { key: `teacher-${Date.now()}`, id: "", reason: "" },
  ]);
  const [absenceDate, setAbsenceDate] = useState<string>("");
  const [preparerName, setPreparerName] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [substitutionPlan, setSubstitutionPlan] = useState<Substitution[] | null>(null);
  const [reportInfo, setReportInfo] = useState<{
    date: Date;
    day: string;
    absentTeachers: { name: string; reason: string }[];
  } | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState<boolean>(false);
  const pdfContentRef = useRef<HTMLDivElement>(null);

  // Load saved data
  useEffect(() => {
    try {
      const savedPlan = localStorage.getItem("substitutionPlan");
      const savedReport = localStorage.getItem("reportInfo");
      const savedPreparer = localStorage.getItem("preparerName");

      if (savedPlan && savedReport) {
        const plan: Substitution[] = JSON.parse(savedPlan);
        const rawReport = JSON.parse(savedReport) as {
          date: string;
          day: string;
          absentTeachers: { name: string; reason: string }[];
        };
        setSubstitutionPlan(plan);
        setReportInfo({
          ...rawReport,
          date: new Date(rawReport.date),
        });
      }
      if (savedPreparer) setPreparerName(savedPreparer);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (substitutionPlan && reportInfo) {
      localStorage.setItem("substitutionPlan", JSON.stringify(substitutionPlan));
      localStorage.setItem(
        "reportInfo",
        JSON.stringify({
          ...reportInfo,
          date: reportInfo.date.toISOString(),
        })
      );
    }
  }, [substitutionPlan, reportInfo]);

  useEffect(() => {
    if (preparerName !== undefined) {
      localStorage.setItem("preparerName", preparerName);
    }
  }, [preparerName]);

  const handleTeacherChange = (index: number, field: "id" | "reason", value: string) => {
    const newAbsentTeachers = [...absentTeachers];
    newAbsentTeachers[index] = { ...newAbsentTeachers[index], [field]: value };
    setAbsentTeachers(newAbsentTeachers);
  };

  const addTeacher = () => {
    setAbsentTeachers([
      ...absentTeachers,
      { key: `teacher-${Date.now()}`, id: "", reason: "" },
    ]);
  };

  const removeTeacher = (index: number) => {
    if (absentTeachers.length > 1) {
      const newAbsentTeachers = absentTeachers.filter((_, i) => i !== index);
      setAbsentTeachers(newAbsentTeachers);
    }
  };

  const getAvailableTeachers = useCallback(
    (day: string, time: string, subIndex: number): Teacher[] => {
      const upperCaseDay = day.toUpperCase();

      const busyTeacherIds = new Set(
        TIMETABLE.filter(
          (entry) => entry.day.toUpperCase() === upperCaseDay && entry.time === time
        ).flatMap((entry) => entry.subjects.map((s) => s.teacherId))
      );

      const absentTeacherIds = new Set(absentTeachers.map((t) => t.id).filter((id) => id));

      const alreadySubstitutingIds = new Set(
        substitutionPlan
          ?.filter(
            (s, i) =>
              s.time === time &&
              i !== subIndex &&
              s.substituteTeacherId !== "LAIN_LAIN"
          )
          .map((s) => s.substituteTeacherId)
      );

      return TEACHERS.filter(
        (teacher) =>
          !busyTeacherIds.has(teacher.id) &&
          !absentTeacherIds.has(teacher.id) &&
          !alreadySubstitutingIds.has(teacher.id)
      );
    },
    [absentTeachers, substitutionPlan]
  );

  const handleSubstituteChange = (subIndex: number, newTeacherId: string) => {
    if (!substitutionPlan) return;
    const newPlan = [...substitutionPlan];

    if (newTeacherId === "LAIN_LAIN") {
      newPlan[subIndex] = {
        ...newPlan[subIndex],
        substituteTeacherId: "LAIN_LAIN",
        substituteTeacherName: "",
        justification: "Ditentukan secara manual.",
      };
    } else {
      const newTeacher = TEACHERS.find((t) => t.id === newTeacherId);
      if (newTeacher) {
        newPlan[subIndex] = {
          ...newPlan[subIndex],
          substituteTeacherId: newTeacher.id,
          substituteTeacherName: newTeacher.name,
          justification: "Diubah secara manual oleh pengguna.",
        };
      }
    }
    setSubstitutionPlan(newPlan);
  };

  const handleCustomSubstituteNameChange = (subIndex: number, newName: string) => {
    if (!substitutionPlan) return;
    const newPlan = [...substitutionPlan];
    newPlan[subIndex] = {
      ...newPlan[subIndex],
      substituteTeacherName: newName,
    };
    setSubstitutionPlan(newPlan);
  };

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (absentTeachers.some((t) => !t.id)) {
        setError("Sila pilih seorang guru untuk setiap baris.");
        return;
      }
      if (!absenceDate) {
        setError("Sila pilih tarikh tidak hadir.");
        return;
      }

      setIsLoading(true);
      setError(null);
      setSubstitutionPlan(null);
      setReportInfo(null);
      setIsEditing(false);

      const dateObj = new Date(absenceDate + "T00:00:00");
      const dayMap = ["AHAD", "ISNIN", "SELASA", "RABU", "KHAMIS", "JUMAAT", "SABTU"];
      const dayName = dayMap[dateObj.getDay()];

      if (dayName === "SABTU" || dayName === "AHAD") {
        setError("Hari yang dipilih ialah hujung minggu. Sila pilih hari persekolahan.");
        setIsLoading(false);
        return;
      }

      const absentTeachersWithData = absentTeachers
        .map(({ id, reason }) => ({
          teacher: TEACHERS.find((t) => t.id === id)!,
          reason: reason || "Tidak dinyatakan",
        }))
        .filter((item) => item.teacher);

      if (absentTeachersWithData.length === 0) {
        setError("Guru yang dipilih tidak ditemui.");
        setIsLoading(false);
        return;
      }

      try {
        const plan = await generateSubstitutionPlan(
          absentTeachersWithData,
          TEACHERS,
          TIMETABLE,
          dayName
        );

        setSubstitutionPlan(plan);
        const absentTeachersForReport = absentTeachersWithData.map((t) => ({
          name: t.teacher.name,
          reason: t.reason,
        }));
        setReportInfo({ date: dateObj, day: dayName, absentTeachers: absentTeachersForReport });
      } catch (err: any) {
        setError(err.message || "Ralat tidak dijangka berlaku.");
      } finally {
        setIsLoading(false);
      }
    },
    [absentTeachers, absenceDate]
  );

// PDF generation (multi-page, header stays only on first page)
const handleDownloadPdf = async () => {
  const content = pdfContentRef.current;
  if (!content) return;

  try {
    const pdf = new jsPDF("p", "pt", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    // Render the whole block (header + table)
    const canvas = await html2canvas(content, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");

    const imgProps = (pdf as any).getImageProperties(imgData);
    const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

    let heightLeft = imgHeight;
    let position = 0;

    // Add first page
    pdf.addImage(imgData, "PNG", 0, position, pdfWidth, imgHeight);
    heightLeft -= pdfHeight;

    // Continue only the overflowing table part to extra pages
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, pdfWidth, imgHeight);
      heightLeft -= pdfHeight;
    }

    // Footer on every page
    const pageCount = pdf.getNumberOfPages();
    pdf.setFontSize(10);
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.text(
        "Dijana menggunakan Sistem Guru Ganti SK Long Sebangang",
        pdfWidth / 2,
        pdfHeight - 20,
        { align: "center" }
      );
    }

    pdf.save("pelan-guru-ganti.pdf");
  } catch (e) {
    console.error("PDF error:", e);
  }
};


  const selectedTeacherIds = new Set(absentTeachers.map((t) => t.id).filter((id) => id));

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-4xl">
        <header className="text-center mb-10">
          <div className="flex justify-center items-center gap-3 mb-2">
            <GraduationCapIcon className="w-10 h-10 text-sky-600" />
            <h1 className="text-4xl font-bold text-slate-800">
              Sistem Guru Ganti SK Long Sebangang
            </h1>
          </div>
          <p className="text-lg text-slate-500">
            Dikuasakan oleh AI untuk mencari pengganti yang paling sesuai.
          </p>
          <div className="flex justify-center mt-4">
            <button
              onClick={() => setIsScheduleOpen(true)}
              className="px-4 py-2 bg-sky-500 text-white rounded-lg shadow hover:bg-sky-600 transition"
            >
              📅 Lihat Jadual Waktu Semasa
            </button>
          </div>
        </header>

        <main>
          {/* Form */}
          <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-200">
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm mb-2">Tarikh Tidak Hadir</label>
                  <input
                    type="date"
                    value={absenceDate}
                    onChange={(e) => setAbsenceDate(e.target.value)}
                    className="w-full border rounded px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm mb-2">Disediakan Oleh</label>
                  <input
                    type="text"
                    value={preparerName}
                    onChange={(e) => setPreparerName(e.target.value)}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
              </div>

              {/* Absent Teachers */}
              <div className="mt-6">
                <h3 className="text-lg font-semibold">Senarai Guru Tidak Hadir</h3>
                {absentTeachers.map((teacher, index) => (
                  <div key={teacher.key} className="flex gap-2 mt-2">
                    <select
                      value={teacher.id}
                      onChange={(e) => handleTeacherChange(index, "id", e.target.value)}
                      className="border rounded px-2 py-1"
                    >
                      <option value="">Pilih guru</option>
                      {TEACHERS.map((t) => (
                        <option
                          key={t.id}
                          value={t.id}
                          disabled={selectedTeacherIds.has(t.id) && t.id !== teacher.id}
                        >
                          {t.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Sebab"
                      value={teacher.reason}
                      onChange={(e) => handleTeacherChange(index, "reason", e.target.value)}
                      className="border rounded px-2 py-1 flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => removeTeacher(index)}
                      disabled={absentTeachers.length <= 1}
                      className="text-red-600"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addTeacher}
                  className="mt-2 px-3 py-1 border rounded"
                >
                  + Tambah Guru
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="mt-6 w-full bg-sky-600 text-white py-2 rounded"
              >
                {isLoading ? "Menjana..." : "Jana Pelan Guru Ganti"}
              </button>
            </form>
          </div>

          {/* Results */}
          <div className="mt-10">
            {isLoading && <LoadingSpinner />}
            {error && <div className="text-red-600">{error}</div>}
            {substitutionPlan && (
              <div ref={pdfContentRef} className="bg-white p-4 rounded shadow">
                {reportInfo && (
                  <div className="mb-4 text-sm text-slate-700">
                    <p>
                      <strong>Disediakan Oleh:</strong> {preparerName || "Tidak dinyatakan"}
                    </p>
                    <p>
                      <strong>Tarikh:</strong>{" "}
                      {reportInfo.date.toLocaleDateString("ms-MY", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                    <p>
                      <strong>Hari:</strong>{" "}
                      {reportInfo.date.toLocaleDateString("ms-MY", { weekday: "long" })}
                    </p>
                    <p className="mt-2">
                      <strong>Guru Tidak Hadir:</strong>{" "}
                      {reportInfo.absentTeachers.length > 0
                        ? reportInfo.absentTeachers
                            .map((t) => `${t.name} (${t.reason})`)
                            .join(", ")
                        : "Tiada"}
                    </p>
                  </div>
                )}

                <h2 className="text-xl font-bold mb-4">Pelan Guru Ganti</h2>
                <table className="w-full border">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="px-3 py-2 border">Masa</th>
                      <th className="px-3 py-2 border">Kelas</th>
                      <th className="px-3 py-2 border">Subjek</th>
                      <th className="px-3 py-2 border">Guru Tidak Hadir</th>
                      <th className="px-3 py-2 border">Guru Ganti</th>
                    </tr>
                  </thead>
                  <tbody>
                    {substitutionPlan.map((sub, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 border">{sub.time}</td>
                        <td className="px-3 py-2 border">{sub.class}</td>
                        <td className="px-3 py-2 border">{sub.subject}</td>
                        <td className="px-3 py-2 border">
                          {sub.absentTeachers?.length
                            ? sub.absentTeachers.map((t) => t.name).join(", ")
                            : "Tiada"}
                        </td>
                        <td className="px-3 py-2 border">
                          <select
                            value={sub.substituteTeacherId}
                            onChange={(e) => handleSubstituteChange(i, e.target.value)}
                            className="border rounded px-2 py-1 w-full"
                          >
                            <option value="">(Belum ditentukan)</option>
                            {getAvailableTeachers(sub.day, sub.time, i).map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                            <option value="LAIN_LAIN">LAIN-LAIN</option>
                          </select>

                          {sub.substituteTeacherId === "LAIN_LAIN" && (
                            <input
                              type="text"
                              placeholder="Nama guru lain"
                              value={sub.substituteTeacherName || ""}
                              onChange={(e) =>
                                handleCustomSubstituteNameChange(i, e.target.value)
                              }
                              className="mt-1 border rounded px-2 py-1 w-full"
                            />
                          )}

                          {sub.substituteTeacherId !== "" && (
                            <div className="mt-1 text-emerald-700 font-semibold">
                              {sub.substituteTeacherId === "LAIN_LAIN"
                                ? sub.substituteTeacherName || "(Belum diisi)"
                                : sub.substituteTeacherName}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button
                  onClick={handleDownloadPdf}
                  className="mt-4 bg-emerald-600 text-white px-3 py-2 rounded"
                >
                  Muat Turun PDF
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
      <ScheduleModal isOpen={isScheduleOpen} onClose={() => setIsScheduleOpen(false)} />
    </div>
  );
};

export default App;
