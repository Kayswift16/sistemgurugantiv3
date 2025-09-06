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

  // ✅ Load saved plan from localStorage on mount
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

  // … your handleTeacherChange, addTeacher, removeTeacher, getAvailableTeachers, handleSubstituteChange, 
  // handleCustomSubstituteNameChange, handleSubmit remain the same …

  // ✅ Improved PDF download (always desktop layout + fit A4 + mobile fallback)
  const handleDownloadPdf = async () => {
    const content = pdfContentRef.current;
    if (!content) return;

    const wasEditing = isEditing;
    if (wasEditing) {
      setIsEditing(false);
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    try {
      // Force desktop width rendering for PDF capture
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

      // ✅ Scale image to fit page width
      const imgWidth = pdfWidth - 40; // leave margin
      const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

      let heightLeft = imgHeight;
      let position = 20; // top margin

      // First page
      pdf.addImage(imgData, 'PNG', 20, position, imgWidth, imgHeight);
      heightLeft -= (pdfHeight - 40); // account for margins

      // Extra pages if content is long
      while (heightLeft > 0) {
        position = position - pdfHeight + 40; 
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 20, position, imgWidth, imgHeight);
        heightLeft -= (pdfHeight - 40);
      }

      // ✅ Add footer
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
          const y = pdfHeight - 15;
          doc.text(footerText, x, y);
        }
      };
      addFooter(pdf);

      // ✅ Try download, fallback for mobile
      try {
        pdf.save('pelan-guru-ganti.pdf');
      } catch {
        const pdfBlob = pdf.output('bloburl');
        window.open(pdfBlob, '_blank');
      }

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
        {/* … your header, form, load last plan button, and substitution plan UI remain unchanged … */}
      </div>
    </div>
  );
};

export default App;
