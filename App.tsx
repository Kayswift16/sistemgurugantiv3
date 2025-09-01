import React, { useState, useCallback, useRef } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { TEACHERS, TIMETABLE } from '@/constants';
import { Teacher, Substitution, AbsentTeacherInfo } from '@/types';
import { generateSubstitutionPlan } from '@/services/geminiService';
import LoadingSpinner from '@/components/LoadingSpinner';

const GraduationCapIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c0 1.7.7 3.2 1.9 4.2a2 2 0 0 0 2.2 0c1.2-1 1.9-2.5 1.9-4.2v-5"></path></svg>
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
      TIMETABLE.filter(entry => entry.day.toUpperCase() === upperCaseDay && entry.time === time).map(entry => entry.teacherId)
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
            substituteTeacherName: '', // Clear name to allow manual input
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

      // Resolve substitution conflicts
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
          // Conflict: Find a new substitute
          const busyNow = new Set([
            ...TIMETABLE.filter(e => e.day.toUpperCase() === day.toUpperCase() && e.time === time).map(e => e.teacherId),
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
          // No conflict
          resolvedPlan.push(sub);
          if (sub.substituteTeacherId !== 'LAIN_LAIN') {
              assignmentsByTime[time].add(sub.substituteTeacherId);
          }
        }
      }

      const absentTeachersForReport = absentTeachersWithData.map(t => ({
        name: t.teacher.name,
        reason: t.reason,
      }));

      setSubstitutionPlan(resolvedPlan);
      setReportInfo({ date: dateObj, day: dayName, absentTeachers: absentTeachersForReport });
    } catch (err: any) {
      setError(err.message || 'Ralat tidak dijangka berlaku.');
    } finally {
      setIsLoading(false);
    }
  }, [absentTeachers, absenceDate]);

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
        const pageCount = doc.internal.pages.length;
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            const pdfWidth = doc.internal.pageSize.getWidth();
            const pdfHeight = doc.internal.pageSize.getHeight();
            const footerText = "Dijana menggunakan Sistem Guru Ganti SK Long Sebangang";
            doc.setFontSize(8);
            doc.setTextColor(128, 128, 128);
            const textWidth = doc.getStringUnitWidth(footerText) * doc.getFontSize() / doc.internal.scaleFactor;
            const textX = (pdfWidth - textWidth) / 2;
            const textY = pdfHeight - 15;
            doc.text(footerText, textX, textY);
        }
      };
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgProps = pdf.getImageProperties(imgData);
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
            <GraduationCapIcon className="w-10 h-10 text-sky-600"/>
            <h1 className="text-4xl font-bold text-slate-800">Sistem Guru Ganti SK Long Sebangang</h1>
          </div>
          <p className="text-lg text-slate-500">
            Dikuasakan oleh AI untuk mencari pengganti yang paling sesuai.
          </p>
        </header>

        <main>
          <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-200">
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="absence-date" className="block text-sm font-medium text-slate-700 mb-2">
                    Tarikh Tidak Hadir
                  </label>
                  <input type="date" id="absence-date" value={absenceDate} onChange={(e) => setAbsenceDate(e.target.value)} className="block w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition text-slate-900 placeholder:text-slate-400" required/>
                </div>
                <div>
                  <label htmlFor="preparer" className="block text-sm font-medium text-slate-700 mb-2">
                    Disediakan Oleh
                  </label>
                  <input type="text" id="preparer" value={preparerName} onChange={(e) => setPreparerName(e.target.value)} placeholder="cth., Penolong Kanan Pentadbiran" className="block w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition text-slate-900 placeholder:text-slate-400"/>
                </div>
              </div>

              <div className="mt-6 border-t border-slate-200 pt-6">
                <h3 className="text-lg font-semibold text-slate-700 mb-4">Senarai Guru Tidak Hadir</h3>
                <div className="space-y-4">
                  {absentTeachers.map((teacher, index) => (
                    <div key={teacher.key} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center p-4 bg-slate-50 rounded-lg border">
                      <div className="md:col-span-5">
                        <label htmlFor={`teacher-id-${index}`} className="sr-only">Guru</label>
                        <select id={`teacher-id-${index}`} value={teacher.id} onChange={(e) => handleTeacherChange(index, 'id', e.target.value)} className="block w-full px-4 py-3 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition text-slate-900" required>
                          <option value="" disabled>Pilih nama guru</option>
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
                      </div>
                      <div className="md:col-span-6">
                        <label htmlFor={`reason-${index}`} className="sr-only">Sebab</label>
                        <input type="text" id={`reason-${index}`} value={teacher.reason} onChange={(e) => handleTeacherChange(index, 'reason', e.target.value)} placeholder="Sebab (cth., Cuti Sakit)" className="block w-full px-4 py-3 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition text-slate-900 placeholder:text-slate-400"/>
                      </div>
                      <div className="md:col-span-1">
                        <button type="button" onClick={() => removeTeacher(index)} disabled={absentTeachers.length <= 1} className="w-full h-full flex items-center justify-center text-red-500 hover:text-red-700 disabled:text-slate-300 disabled:cursor-not-allowed transition" aria-label="Padam Guru">
                          <svg xmlns="http://www.w3.org/200
