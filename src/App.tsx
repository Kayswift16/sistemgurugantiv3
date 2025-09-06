import React, { useState, useCallback, useRef, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { TEACHERS, TIMETABLE } from '@/constants';
import { Teacher, Substitution, AbsentTeacherInfo } from '@/types';
import { generateSubstitutionPlan } from '@/services/geminiService';
import LoadingSpinner from '@/components/LoadingSpinner';

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
  const pdfContentRef = useRef<HTMLDivElement>(null);

  // ✅ Load from localStorage on mount
  useEffect(() => {
    const savedPlan = localStorage.getItem("substitutionPlan");
    const savedReport = localStorage.getItem("reportInfo");
    const savedPreparer = localStorage.getItem("preparerName");

    if (savedPlan && savedReport) {
      setSubstitutionPlan(JSON.parse(savedPlan));
      setReportInfo(JSON.parse(savedReport));
    }
    if (savedPreparer) {
      setPreparerName(savedPreparer);
    }
  }, []);

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

    // ✅ Merge joint absent teachers
    const mergedAbsentTeachers: { teacher: Teacher; reason: string }[] = [];
    const seen = new Set<string>();

    for (const absent of absentTeachersWithData) {
      if (seen.has(absent.teacher.id)) continue;
      seen.add(absent.teacher.id);

      const jointEntries = TIMETABLE.filter(
        entry =>
          entry.day.toUpperCase() === dayName.toUpperCase() &&
          entry.subjects.some(s => s.teacherId === absent.teacher.id)
      );

      let jointAbsent: { teacher: Teacher; reason: string }[] = [absent];

      for (const entry of jointEntries) {
        for (const subj of entry.subjects) {
          if (
            subj.teacherId !== absent.teacher.id &&
            absentTeachersWithData.some(a => a.teacher.id === subj.teacherId)
          ) {
            const other = absentTeachersWithData.find(a => a.teacher.id === subj.teacherId)!;
            if (!seen.has(other.teacher.id)) {
              seen.add(other.teacher.id);
              jointAbsent.push(other);
            }
          }
        }
      }

      mergedAbsentTeachers.push(...jointAbsent);
    }

    try {
      const plan = await generateSubstitutionPlan(mergedAbsentTeachers, TEACHERS, TIMETABLE, dayName);

      const resolvedPlan: Substitution[] = [];
      const assignmentsByTime: Record<string, Set<string>> = {};

      plan.sort((a, b) => a.time.localeCompare(b.time));

      for (const sub of plan) {
        const { time, day } = sub;

        if (!assignmentsByTime[time]) {
          assignmentsByTime[time] = new Set<string>();
        }

        const assignedSubstitutesForSlot = assignmentsByTime[time];

        if (assignedSubstitutesForSlot.has(sub.substituteTeacherId)) {
          const busyNow = new Set([
            ...TIMETABLE.filter(e => e.day.toUpperCase() === day.toUpperCase() && e.time === time).flatMap(e => e.subjects.map(s => s.teacherId)),
            ...mergedAbsentTeachers.map(t => t.teacher.id),
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
      }

      const absentTeachersForReport = mergedAbsentTeachers.map(t => ({
        name: t.teacher.name,
        reason: t.reason,
      }));

      setSubstitutionPlan(resolvedPlan);
      setReportInfo({ date: dateObj, day: dayName, absentTeachers: absentTeachersForReport });

      // ✅ Save to localStorage
      localStorage.setItem("substitutionPlan", JSON.stringify(resolvedPlan));
      localStorage.setItem("reportInfo", JSON.stringify({ date: dateObj, day: dayName, absentTeachers: absentTeachersForReport }));
      localStorage.setItem("preparerName", preparerName);

    } catch (err: any) {
      setError(err.message || 'Ralat tidak dijangka berlaku.');
    } finally {
      setIsLoading(false);
    }
  }, [absentTeachers, absenceDate, preparerName]);

  const handleDownloadPdf = async () => {
    const content = pdfContentRef.current;
    if (!content) return;

    const wasEditing = isEditing;
    if (wasEditing) {
      setIsEditing(false);
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    try {
      const canvas = await html2canvas(content, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: 'a4',
        hotfixes: ['px_scaling'],
      });

      const addFooter = (doc: jsPDF) => {
        const pageCount = (doc as any).internal.pages.length;
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          const pdfWidth = doc.internal.pageSize.getWidth();
          const pdfHeight = doc.internal.pageSize.getHeight();
          const footerText = "Dijana menggunakan Sistem Guru Ganti SK Long Sebangang";
          doc.setFontSize(8);
          doc.setTextColor(128, 128, 128);
          const textWidth = doc.getStringUnitWidth(footerText) * (doc.getFontSize() / (doc as any).internal.scaleFactor);
          const textX = (pdfWidth - textWidth) / 2;
          const textY = pdfHeight - 15;
          doc.text(footerText, textX, textY);
        }
      };

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgProps = (pdf as any).getImageProperties(imgData);
      const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = -heightLeft;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      addFooter(pdf);

      pdf.save('pelan-guru-ganti.pdf');
    } catch (error) {
      console.error("Gagal menjana PDF:", error);
      setError("Tidak dapat menjana PDF. Sila cuba lagi.");
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
        </header>

        {/* ✅ Load last plan button */}
        <div className="flex justify-end mb-4">
          <button
            type="button"
            onClick={() => {
              const savedPlan = localStorage.getItem("substitutionPlan");
              const savedReport = localStorage.getItem("reportInfo");
              if (savedPlan && savedReport) {
                setSubstitutionPlan(JSON.parse(savedPlan));
                setReportInfo(JSON.parse(savedReport));
                setError(null);
              } else {
                setError("Tiada pelan guru ganti tersimpan.");
              }
            }}
            className="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-700 transition"
          >
            Muat Naik Pelan Tersimpan
          </button>
        </div>

        {/* The rest of your form + table UI goes here (unchanged from your version).
            Keep everything you already had below this point. */}
      </div>
    </div>
  );
};

export default App;
