import React, { useState, useCallback, useRef, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { TEACHERS, TIMETABLE } from '@/constants';
import { Teacher, Substitution, AbsentTeacherInfo } from '@/types';
import { generateSubstitutionPlan } from '@/services/geminiService';
import LoadingSpinner from '@/components/LoadingSpinner';
import ScheduleModal from '@/components/ScheduleModal';

const GraduationCapIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24" height="24" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" {...props}
  >
    <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
    <path d="M6 12v5c0 1.7.7 3.2 1.9 4.2a2 2 0 0 0 2.2 0c1.2-1 1.9-2.5 1.9-4.2v-5"></path>
  </svg>
);

const App: React.FC = () => {
  const [absentTeachers, setAbsentTeachers] = useState<AbsentTeacherInfo[]>([
    { key: `teacher-${Date.now()}`, id: '', reason: '' }
  ]);
  const [absenceDate, setAbsenceDate] = useState<string>('');
  const [preparerName, setPreparerName] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [substitutionPlan, setSubstitutionPlan] = useState<Substitution[] | null>(null);
  const [reportInfo, setReportInfo] = useState<{ date: Date; day: string; absentTeachers: { name: string; reason: string }[] } | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState<boolean>(false);
  const pdfContentRef = useRef<HTMLDivElement>(null);

  // Load saved data on mount
  useEffect(() => {
    try {
      const savedPlan = localStorage.getItem('substitutionPlan');
      const savedReport = localStorage.getItem('reportInfo');
      const savedPreparer = localStorage.getItem('preparerName');

      if (savedPlan && savedReport) {
        const plan: Substitution[] = JSON.parse(savedPlan);
        const rawReport = JSON.parse(savedReport) as { date: string; day: string; absentTeachers: { name: string; reason: string }[] };
        setSubstitutionPlan(plan);
        setReportInfo({
          ...rawReport,
          date: new Date(rawReport.date),
        });
      }
      if (savedPreparer) setPreparerName(savedPreparer);
    } catch {
      // ignore corrupt LS
    }
  }, []);

  // Persist plan + report when changed
  useEffect(() => {
    if (substitutionPlan && reportInfo) {
      localStorage.setItem('substitutionPlan', JSON.stringify(substitutionPlan));
      localStorage.setItem('reportInfo', JSON.stringify({
        ...reportInfo,
        date: reportInfo.date.toISOString(),
      }));
    }
  }, [substitutionPlan, reportInfo]);

  // Persist preparer name
  useEffect(() => {
    if (preparerName !== undefined) {
      localStorage.setItem('preparerName', preparerName);
    }
  }, [preparerName]);

  const handleTeacherChange = (index: number, field: 'id' | 'reason', value: string) => {
    const newAbsentTeachers = [...absentTeachers];
    newAbsentTeachers[index] = { ...newAbsentTeachers[index], [field]: value };
    setAbsentTeachers(newAbsentTeachers);
  };

  const addTeacher = () => {
    setAbsentTeachers([...absentTeachers, { key: `teacher-${Date.now()}`, id: '', reason: '' }]);
  };

  const removeTeacher = (index: number) => {
    if (absentTeachers.length > 1) {
      const newAbsentTeachers = absentTeachers.filter((_, i) => i !== index);
      setAbsentTeachers(newAbsentTeachers);
    }
  };

  const getAvailableTeachers = useCallback((day: string, time: string, subIndex: number): Teacher[] => {
    const upperCaseDay = day.toUpperCase();

    const busyTeacherIds = new Set(
      TIMETABLE
        .filter(entry => entry.day.toUpperCase() === upperCaseDay && entry.time === time)
        .flatMap(entry => entry.subjects.map(s => s.teacherId))
    );

    const absentTeacherIds = new Set(absentTeachers.map(t => t.id).filter(id => id));

    const alreadySubstitutingIds = new Set(
      substitutionPlan
        ?.filter((s, i) => s.time === time && i !== subIndex && s.substituteTeacherId !== 'LAIN_LAIN')
        .map(s => s.substituteTeacherId)
    );

    return TEACHERS.filter(teacher =>
      !busyTeacherIds.has(teacher.id) &&
      !absentTeacherIds.has(teacher.id) &&
      !alreadySubstitutingIds.has(teacher.id)
    );
  }, [absentTeachers, substitutionPlan]);

  const handleSubstituteChange = (subIndex: number, newTeacherId: string) => {
    if (!substitutionPlan) return;
    const newPlan = [...substitutionPlan];

    if (newTeacherId === 'LAIN_LAIN') {
      newPlan[subIndex] = {
        ...newPlan[subIndex],
        substituteTeacherId: 'LAIN_LAIN',
        substituteTeacherName: '',
        justification: 'Ditentukan secara manual.',
      };
    } else {
      const newTeacher = TEACHERS.find(t => t.id === newTeacherId);
      if (newTeacher) {
        newPlan[subIndex] = {
          ...newPlan[subIndex],
          substituteTeacherId: newTeacher.id,
          substituteTeacherName: newTeacher.name,
          justification: 'Diubah secara manual oleh pengguna.',
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

  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    const hasEmptyTeacher = absentTeachers.some(t => !t.id);
    if (hasEmptyTeacher) {
      setError('Sila pilih seorang guru untuk setiap baris.');
      return;
    }
    if (!absenceDate) {
      setError('Sila pilih tarikh tidak hadir.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSubstitutionPlan(null);
    setReportInfo(null);
    setIsEditing(false);

    const dateObj = new Date(absenceDate + 'T00:00:00');
    const dayMap = ["AHAD", "ISNIN", "SELASA", "RABU", "KHAMIS", "JUMAAT", "SABTU"];
    const dayName = dayMap[dateObj.getDay()];

    if (dayName === "SABTU" || dayName === "AHAD") {
      setError("Hari yang dipilih ialah hujung minggu. Sila pilih hari persekolahan.");
      setIsLoading(false);
      return;
    }

    const absentTeachersWithData = absentTeachers
      .map(({ id, reason }) => ({
        teacher: TEACHERS.find(t => t.id === id)!,
        reason: reason || 'Tidak dinyatakan',
      }))
      .filter(item => item.teacher);

    if (absentTeachersWithData.length === 0) {
      setError('Guru yang dipilih tidak ditemui.');
      setIsLoading(false);
      return;
    }

    try {
      const plan = await generateSubstitutionPlan(absentTeachersWithData, TEACHERS, TIMETABLE, dayName);

      // Resolve double-booking conflicts + ensure one class/time gets one sub only
      const resolvedPlan: Substitution[] = [];
      const assignmentsByTime: Record<string, Set<string>> = {};
      const seenSlot = new Set<string>(); // day|time|class to ensure single replacement

      plan.sort((a, b) => a.time.localeCompare(b.time));

      for (const sub of plan) {
        const slotKey = `${sub.day}|${sub.time}|${sub.class}`;
        if (seenSlot.has(slotKey)) {
          continue; // only one substitute per slot even if multiple teachers absent
        }

        const { time, day } = sub;
        if (!assignmentsByTime[time]) assignmentsByTime[time] = new Set<string>();
        const assignedSubstitutesForSlot = assignmentsByTime[time];

        if (sub.substituteTeacherId !== 'LAIN_LAIN' && assignedSubstitutesForSlot.has(sub.substituteTeacherId)) {
          // Conflict: pick alternative
          const busyNow = new Set([
            ...TIMETABLE.filter(e => e.day.toUpperCase() === day.toUpperCase() && e.time === time).flatMap(e => e.subjects.map(s => s.teacherId)),
            ...absentTeachersWithData.map(t => t.teacher.id),
            ...assignedSubstitutesForSlot
          ]);
          const alternative = TEACHERS.find(t => !busyNow.has(t.id));

          if (alternative) {
            resolvedPlan.push({
              ...sub,
              substituteTeacherId: alternative.id,
              substituteTeacherName: alternative.name,
              justification: "Diubah oleh sistem untuk elak pertindihan.",
            });
            assignmentsByTime[time].add(alternative.id);
          } else {
            resolvedPlan.push({
              ...sub,
              substituteTeacherId: 'LAIN_LAIN',
              substituteTeacherName: 'Lain-lain',
              justification: 'Tiada guru kelapangan ditemui sistem.',
            });
          }
        } else {
          resolvedPlan.push(sub);
          if (sub.substituteTeacherId !== 'LAIN_LAIN') {
            assignmentsByTime[time].add(sub.substituteTeacherId);
          }
        }

        seenSlot.add(slotKey);
      }

      const absentTeachersForReport = absentTeachersWithData.map(t => ({
        name: t.teacher.name,
        reason: t.reason,
      }));

      setSubstitutionPlan(resolvedPlan);
      setReportInfo({ date: dateObj, day: dayName, absentTeachers: absentTeachersForReport });

      // Save immediately
      localStorage.setItem('substitutionPlan', JSON.stringify(resolvedPlan));
      localStorage.setItem('reportInfo', JSON.stringify({
        date: dateObj.toISOString(),
        day: dayName,
        absentTeachers: absentTeachersForReport
      }));

    } catch (err: any) {
      setError(err.message || 'Ralat tidak dijangka berlaku.');
    } finally {
      setIsLoading(false);
    }
  }, [absentTeachers, absenceDate]);

  // PDF download
  const handleDownloadPdf = async () => {
    const content = pdfContentRef.current;
    if (!content) return;

    const wasEditing = isEditing;
    if (wasEditing) {
      setIsEditing(false);
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    try {
      const canvas = await html2canvas(content, {
        scale: 2,
        useCORS: true,
        width: 1024,
        windowWidth: 1024
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: 'a4',
        hotfixes: ['px_scaling'],
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgProps = (pdf as any).getImageProperties(imgData);

      const margin = 20;
      const imgWidth = pdfWidth - margin * 2;
      const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

      let heightLeft = imgHeight;
      let position = margin;

      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
      heightLeft -= (pdfHeight - margin * 2);

      while (heightLeft > 0) {
        position = position - pdfHeight + margin * 2;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
        heightLeft -= (pdfHeight - margin * 2);
      }

      const addFooter = (doc: jsPDF) => {
        const pageCount = (doc as any).internal.pages.length;
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          const footerText = "Dijana menggunakan Sistem Guru Ganti SK Long Sebangang";
          doc.setFontSize(8);
          doc.setTextColor(128, 128, 128);
          const pageWidth = doc.internal.pageSize.getWidth();
          const textWidth = doc.getStringUnitWidth(footerText) * (doc.getFontSize() / (doc as any).internal.scaleFactor);
          const x = (pageWidth - textWidth) / 2;
          const y = pdf.internal.pageSize.getHeight() - 15;
          doc.text(footerText, x, y);
        }
      };
      addFooter(pdf);

      try {
        pdf.save('pelan-guru-ganti.pdf');
      } catch {
        const pdfBlob = pdf.output('bloburl');
        window.open(pdfBlob, '_blank');
      }
    } catch (error) {
      console.error('Gagal menjana PDF:', error);
      setError('Tidak dapat menjana PDF. Sila cuba lagi.');
    } finally {
      if (wasEditing) setIsEditing(true);
    }
  };

  const selectedTeacherIds = new Set(
    absentTeachers
      .map(t => t.id)
      .filter(id => id)
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-4xl">
        <header className="text-center mb-10">
          <div className="flex justify-center items-center gap-3 mb-2">
            <GraduationCapIcon className="w-10 h-10 text-sky-600" />
            <h1 className="text-4xl font-bold text-slate-800">Sistem Guru Ganti SK Long Sebangang</h1>
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
          <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-200">
            <form onSubmit={handleSubmit}>
              {/* Inputs for date, preparer, absent teachers */}
              {/* ... same as before */}
            </form>
          </div>

          <div className="mt-10">
            {isLoading && <LoadingSpinner />}
            {error && (
              <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
                <p className="font-bold">Ralat</p>
                <p>{error}</p>
              </div>
            )}

            {substitutionPlan && (
              <div>
                {/* Table of substitution plan */}
                <div ref={pdfContentRef} className="p-4 bg-white rounded-xl shadow-lg border border-slate-200">
                  {substitutionPlan.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-slate-100 text-slate-600 uppercase">
                          <tr>
                            <th className="px-4 py-3 font-semibold">Masa</th>
                            <th className="px-4 py-3 font-semibold">Kelas</th>
                            <th className="px-4 py-3 font-semibold">Subjek</th>
                            <th className="px-4 py-3 font-semibold">Guru Tidak Hadir</th>
                            <th className="px-4 py-3 font-semibold">Guru Ganti</th>
                          </tr>
                        </thead>
                        <tbody className="text-slate-700">
                          {substitutionPlan.map((sub, index) => (
                            <tr key={`${sub.day}-${sub.time}-${sub.class}-${index}`} className="border-b border-slate-200 hover:bg-slate-50">
                              <td className="px-4 py-3 font-mono">{sub.time}</td>
                              <td className="px-4 py-3 font-medium">{sub.class}</td>
                              <td className="px-4 py-3">{sub.subject}</td>
                              <td className="px-4 py-3 text-slate-500">
                                {sub.absentTeachers && sub.absentTeachers.length > 0
                                  ? sub.absentTeachers.map((t) => t.name).join(", ")
                                  : "Tiada"}
                              </td>
                              <td className="px-4 py-3">
                                {isEditing ? (
                                  <div>
                                    <select
                                      value={sub.substituteTeacherId}
                                      onChange={(e) => handleSubstituteChange(index, e.target.value)}
                                      className="block w-full px-2 py-1 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 transition text-emerald-700 font-semibold"
                                    >
                                      {!getAvailableTeachers(sub.day, sub.time, index).some(
                                        (t) => t.id === sub.substituteTeacherId
                                      ) &&
                                        sub.substituteTeacherId !== "LAIN_LAIN" && (
                                          <option
                                            key={sub.substituteTeacherId}
                                            value={sub.substituteTeacherId}
                                          >
                                            {sub.substituteTeacherName}
                                          </option>
                                        )}
                                      {getAvailableTeachers(sub.day, sub.time, index).map((teacher) => (
                                        <option key={teacher.id} value={teacher.id}>
                                          {teacher.name}
                                        </option>
                                      ))}
                                      <option value="LAIN_LAIN">Lain-lain</option>
                                    </select>
                                    {sub.substituteTeacherId === "LAIN_LAIN" && (
                                      <input
                                        type="text"
                                        value={sub.substituteTeacherName}
                                        onChange={(e) =>
                                          handleCustomSubstituteNameChange(index, e.target.value)
                                        }
                                        placeholder="Masukkan nama pengganti"
                                        className="mt-2 block w-full px-2 py-1 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-sky-500 text-emerald-700 font-semibold"
                                        aria-label="Nama Guru Ganti Lain-lain"
                                      />
                                    )}
                                  </div>
                                ) : (
                                  <span className="font-semibold text-emerald-700">
                                    {sub.substituteTeacherName ||
                                      (sub.substituteTeacherId === "LAIN_LAIN"
                                        ? "(Nama belum diisi)"
                                        : "")}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center p-8">
                      <p className="text-slate-600">Tiada kelas yang perlu diganti untuk guru ini pada hari tersebut.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Schedule Modal */}
      <ScheduleModal isOpen={isScheduleOpen} onClose={() => setIsScheduleOpen(false)} />
    </div>
  );
};

export default App;
