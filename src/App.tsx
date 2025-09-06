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

  // ✅ updated to handle subjects[]
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

      // ✅ conflict resolution updated for subjects[]
      const resolvedPlan: Substitution[] = [];
      const assignmentsByTime: Record<string, Set<string>> = {};
      const seenSlot = new Set<string>();

      plan.sort((a, b) => a.time.localeCompare(b.time));

      for (const sub of plan) {
        const slotKey = `${sub.day}|${sub.time}|${sub.class}`;
        if (seenSlot.has(slotKey)) continue;

        const { time, day } = sub;
        if (!assignmentsByTime[time]) assignmentsByTime[time] = new Set<string>();
        const assignedSubstitutesForSlot = assignmentsByTime[time];

        if (sub.substituteTeacherId !== 'LAIN_LAIN' && assignedSubstitutesForSlot.has(sub.substituteTeacherId)) {
          const busyNow = new Set([
            ...TIMETABLE
              .filter(e => e.day.toUpperCase() === day.toUpperCase() && e.time === time)
              .flatMap(e => e.subjects.map(s => s.teacherId)),
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

  // PDF function unchanged
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

        {/* rest of your UI unchanged */}
        {/* ... your form and substitution table ... */}
      </div>

      <ScheduleModal isOpen={isScheduleOpen} onClose={() => setIsScheduleOpen(false)} />
    </div>
  );
};

export default App;
