import { useState } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface JadualItem {
  hari: string;
  masa: string;
  kelas: string;
  guruAsal: string;
  subjek: string;
  guruGanti: string;
}

export default function App() {
  const [jadual] = useState<JadualItem[]>([
    {
      hari: "RABU",
      masa: "0720-0750",
      kelas: "TAHUN 1",
      guruAsal: "Florida Engillia Sim",
      subjek: "BI",
      guruGanti: "Baby Trucy Sedrek",
    },
    {
      hari: "RABU",
      masa: "0720-0750",
      kelas: "TAHUN 4",
      guruAsal: "Mohd Nazrin bin Ibrahim",
      subjek: "PJ",
      guruGanti: "Idrus bin Matjisin",
    },
    {
      hari: "RABU",
      masa: "0750-0820",
      kelas: "TAHUN 1",
      guruAsal: "Florida Engillia Sim",
      subjek: "BI",
      guruGanti: "Mohd Nazrin bin Ibrahim",
    },
    {
      hari: "RABU",
      masa: "0750-0820",
      kelas: "TAHUN 4",
      guruAsal: "Mohd Nazrin bin Ibrahim",
      subjek: "PJ",
      guruGanti: "Baby Trucy Sedrek",
    },
  ]);

  const exportPDF = async () => {
    const input = document.getElementById("jadual-table");
    if (!input) return;

    const canvas = await html2canvas(input);
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgProps = (pdf as any).getImageProperties(imgData);
    const pdfWidth = pageWidth;
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

    let position = 0;
    pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);

    // kalau tinggi lebih dari 1 page
    if (pdfHeight > pageHeight) {
      let heightLeft = pdfHeight;
      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }
    }

    pdf.save("jadual-guru-ganti.pdf");
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Jadual Guru Ganti</h1>
        <button
          onClick={exportPDF}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Eksport PDF
        </button>
      </div>

      <table
        id="jadual-table"
        className="w-full border border-gray-300 text-left bg-white"
      >
        <thead className="bg-gray-100">
          <tr>
            <th className="border border-gray-300 p-2">Hari</th>
            <th className="border border-gray-300 p-2">Masa</th>
            <th className="border border-gray-300 p-2">Kelas</th>
            <th className="border border-gray-300 p-2">Guru Asal</th>
            <th className="border border-gray-300 p-2">Subjek</th>
            <th className="border border-gray-300 p-2">Guru Ganti</th>
          </tr>
        </thead>
        <tbody>
          {jadual.map((item, index) => (
            <tr key={index} className="hover:bg-gray-50">
              <td className="border border-gray-300 p-2">{item.hari}</td>
              <td className="border border-gray-300 p-2">{item.masa}</td>
              <td className="border border-gray-300 p-2">{item.kelas}</td>
              <td className="border border-gray-300 p-2">{item.guruAsal}</td>
              <td className="border border-gray-300 p-2">{item.subjek}</td>
              <td className="border border-gray-300 p-2">{item.guruGanti}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
