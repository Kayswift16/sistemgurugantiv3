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

  // Load saved data
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
      // ignore corrupted LS
    }
  }, []);

  // Persist plan/report
  useEffect(() => {
    if (substitutionPlan && reportInfo) {
      localStorage.setItem('substitutionPlan', JSON.stringify(substitutionPlan));
      localStorage.setItem('reportInfo', JSON.stringify({
        ...reportInfo,
        date: reportInfo.date.toISOString(),
      }));
    }
  }, [substitutionPlan, reportInfo]);

  // Persist preparer
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

  // ✅ Updated to work with subjects[] and ignore PH/R/E/H/A/T
  const getAvailableTeachers = useCallback((day: string, time: string, subIndex: number): Teacher[] => {
    const upperDay = day.toUpperCase();

    const busyTeacherIds = new Set(
      TIMETABLE
        .filter(e => e.day.toUpperCase() === upperDay && e.time === time)
        .flatMap(e => e.subjects)
        .map(s => s.teacherId)
        .filter(Boolean)
    );

    const absentTeacherIds = new Set(absentTeachers.map(t => t.id).filter(Boolean));

    const alreadySubbingIds = new Set(
      substitutionPlan
        ?.filter((s, i) => s.time === time && i !== subIndex && s.substituteTeacherId !== 'LAIN_LAIN')
        .map(s => s.substituteTeacherId)
    );

    return TEACHERS.filter(t =>
      !busyTeacherIds.has(t.id) &&
      !absentTeacherIds.has(t.id) &&
      !alreadySubbingIds.has(t.id)
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

      // resolve conflicts
      const resolvedPlan: Substitution[] = [];
      const assignmentsByTime: Record<string, Set<string>> = {};
      const seenSlot = new Set<string>();

      plan.sort((a, b) => a.time.localeCompare(b.time));

      for (const sub of plan) {
        const slotKey = `${sub.day}|${sub.time}|${sub.class}`;
        if (seenSlot.has(slotKey)) continue;

        const { time, day } = sub;
        if (!assignmentsByTime[time]) assignmentsByTime[time] = new Set<string>();
        const assigned = assignmentsByTime[time];

        if (sub.substituteTeacherId !== 'LAIN_LAIN' && assigned.has(sub.substituteTeacherId)) {
          const busyNow = new Set([
            ...TIMETABLE.filter(e => e.day.toUpperCase() === day.toUpperCase() && e.time === time).flatMap(e => e.subjects.map(s => s.teacherId)),
            ...absentTeachersWithData.map(t => t.teacher.id),
            ...assigned
          ]);
          const alternative = TEACHERS.find(t => !busyNow.has(t.id));

          if (alternative) {
            resolvedPlan.push({
              ...sub,
              substituteTeacherId: alternative.id,
              substituteTeacherName: alternative.name,
              justification: "Diubah oleh sistem untuk elak pertindihan.",
            });
            assigned.add(alternative.id);
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
            assigned.add(sub.substituteTeacherId);
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
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4', hotfixes: ['px_scaling'] });

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

      const footer = "Dijana menggunakan Sistem Guru Ganti SK Long Sebangang";
      for (let i = 1; i <= pdf.getNumberOfPages(); i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(128, 128, 128);
        const pageWidth = pdf.internal.pageSize.getWidth();
        const textWidth = pdf.getStringUnitWidth(footer) * (pdf.getFontSize() / (pdf as any).internal.scaleFactor);
        pdf.text(footer, (pageWidth - textWidth) / 2, pdf.internal.pageSize.getHeight() - 15);
      }

      pdf.save('pelan-guru-ganti.pdf');
    } catch (error) {
      console.error('Gagal menjana PDF:', error);
      setError('Tidak dapat menjana PDF. Sila cuba lagi.');
    } finally {
      if (wasEditing) setIsEditing(true);
    }
  };

  const selectedTeacherIds = new Set(absentTeachers.map(t => t.id).filter(id => id));

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-4xl">
        <header className="text-center mb-10">
          <div className="flex justify-center items-center gap-3 mb-2">
            <GraduationCapIcon className="w-10 h-10 text-sky-600" />
            <h1 className="text-4xl font-bold text-slate-800">Sistem Guru Ganti SK Long Sebangang</h1>
          </div>
          <p className="text-lg text-slate-500">Dikuasakan oleh AI untuk mencari pengganti yang paling sesuai.</p>

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
          <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow mb-6">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Maklumat Ketidakhadiran</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tarikh</label>
                <input
                  type="date"
                  value={absenceDate}
                  onChange={(e) => setAbsenceDate(e.target.value)}
                  className="w-full border rounded-lg p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Disediakan oleh</label>
                <input
                  type="text"
                  value={preparerName}
                  onChange={(e) => setPreparerName(e.target.value)}
                  className="w-full border rounded-lg p-2"
                  placeholder="Nama penyedia"
                />
              </div>
            </div>

            <div className="space-y-4">
              {absentTeachers.map((teacher, index) => (
                <div key={teacher.key} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                  <select
                    value={teacher.id}
                    onChange={(e) => handleTeacherChange(index, 'id', e.target.value)}
                    className="border rounded-lg p-2"
                  >
                    <option value="">-- Pilih Guru --</option>
                    {TEACHERS.map((t) => (
                      <option key={t.id} value={t.id} disabled={selectedTeacherIds.has(t.id)}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={teacher.reason}
                    onChange={(e) => handleTeacherChange(index, 'reason', e.target.value)}
                    className="border rounded-lg p-2"
                    placeholder="Sebab tidak hadir"
                  />
                  <div className="flex gap-2">
                    {index === absentTeachers.length - 1 && (
                      <button type="button" onClick={addTeacher} className="px-3 py-2 bg-green-500 text-white rounded-lg">+</button>
                    )}
                    {absentTeachers.length > 1 && (
                      <button type="button" onClick={() => removeTeacher(index)} className="px-3 py-2 bg-red-500 text-white rounded-lg">-</button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 text-right">
              <button
                type="submit"
                className="px-6 py-2 bg-sky-600 text-white rounded-lg shadow hover:bg-sky-700 transition"
                disabled={isLoading}
              >
                {isLoading ? <LoadingSpinner /> : "Jana Pelan Ganti"}
              </button>
            </div>
          </form>

          {error && (
            <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg">{error}</div>
          )}

          {substitutionPlan && reportInfo && (
            <div ref={pdfContentRef} className="bg-white p-6 rounded-xl shadow">
              <h2 className="text-xl font-bold text-slate-800 mb-4">Pelan Guru Ganti</h2>
              <p className="mb-2 text-sm text-slate-600">Tarikh: {reportInfo.date.toLocaleDateString('ms-MY')} ({reportInfo.day})</p>
              <p className="mb-4 text-sm text-slate-600">Guru tidak hadir: {reportInfo.absentTeachers.map(t => `${t.name} (${t.reason})`).join(', ')}</p>

              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-slate-200">
                  <thead className="bg-slate-100 text-slate-600">
                    <tr>
                      <th className="px-3 py-2 border">Masa</th>
                      <th className="px-3 py-2 border">Kelas</th>
                      <th className="px-3 py-2 border">Subjek</th>
                      <th className="px-3 py-2 border">Guru Tidak Hadir</th>
                      <th className="px-3 py-2 border">Guru Ganti</th>
                    </tr>
                  </thead>
                  <tbody>
                    {substitutionPlan.map((sub, i) => (
                      <tr key={i} className="border-b">
                        <td className="px-3 py-2 border font-mono">{sub.time}</td>
                        <td className="px-3 py-2 border">{sub.class}</td>
                        <td className="px-3 py-2 border">{sub.subject}</td>
                        <td className="px-3 py-2 border">
                          {sub.absentTeachers?.map(t => t.name).join(', ') || sub.absentTeacherName}
                        </td>
                        <td className="px-3 py-2 border">
                          {isEditing ? (
                            <>
                              <select
                                value={sub.substituteTeacherId}
                                onChange={(e) => handleSubstituteChange(i, e.target.value)}
                                className="border rounded-lg p-1"
                              >
                                <option value="">-- Pilih --</option>
                                {getAvailableTeachers(sub.day, sub.time, i).map(t => (
                                  <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                                <option value="LAIN_LAIN">Lain-lain</option>
                              </select>
                              {sub.substituteTeacherId === 'LAIN_LAIN' && (
                                <input
                                  type="text"
                                  value={sub.substituteTeacherName}
                                  onChange={(e) => handleCustomSubstituteNameChange(i, e.target.value)}
                                  placeholder="Nama guru lain"
                                  className="border rounded-lg p-1 mt-1"
                                />
                              )}
                            </>
                          ) : (
                            <span className="font-medium">{sub.substituteTeacherName || "-"}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex justify-between items-center">
                <div className="text-sm text-slate-500">Disediakan oleh: {preparerName || "(tidak dinyatakan)"}</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="px-4 py-2 bg-yellow-500 text-white rounded-lg shadow hover:bg-yellow-600 transition"
                  >
                    {isEditing ? "Selesai Edit" : "Edit"}
                  </button>
                  <button
                    onClick={handleDownloadPdf}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg shadow hover:bg-emerald-700 transition"
                  >
                    Muat Turun PDF
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>

        <ScheduleModal isOpen={isScheduleOpen} onClose={() => setIsScheduleOpen(false)} />
      </div>
    </div>
  );
};

export default App;
