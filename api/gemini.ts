import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from "@google/genai";
import type { Teacher, ScheduleEntry, Substitution } from '../src/types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const generatePrompt = (
  absentTeachersInfo: { teacher: Teacher; reason: string }[],
  allTeachers: Teacher[],
  timetable: ScheduleEntry[],
  absenceDay: string,
): string => {
  const upperCaseAbsenceDay = absenceDay.toUpperCase();
  const relevantTimetableForDay = timetable.filter(entry => entry.day.toUpperCase() === upperCaseAbsenceDay);

  const absentTeacherDetails = absentTeachersInfo.map(info =>
    `- ${info.teacher.name} (ID: ${info.teacher.id}), Sebab: ${info.reason || 'Tidak dinyatakan'}`
  ).join('\n');

  const absentTeacherIds = absentTeachersInfo.map(info => info.teacher.id);

  // ✅ handle multiple teachers per slot
  const absentTeachersSchedules = timetable.filter(entry =>
    entry.day.toUpperCase() === upperCaseAbsenceDay &&
    entry.subjects.some(s => absentTeacherIds.includes(s.teacherId))
  );

  return `
    Anda adalah Penolong Kanan Pentadbiran yang bijak di sebuah sekolah. 
    Tugas anda adalah untuk mencari guru ganti terbaik untuk SEMUA guru yang tidak hadir pada hari tertentu.

    MAKLUMAT KES:
    - Hari Tidak Hadir: ${absenceDay}
    - Senarai Guru Tidak Hadir:
${absentTeacherDetails}
    - Jadual Waktu Penuh Sekolah untuk Hari ${absenceDay}: ${JSON.stringify(relevantTimetableForDay)}
    - Senarai Semua Guru: ${JSON.stringify(allTeachers)}

    TUGASAN:
    Berdasarkan data yang diberikan, sila laksanakan langkah-langkah berikut untuk hari ${absenceDay} SAHAJA:
    1. Untuk SETIAP guru yang tidak hadir, kenal pasti semua slot waktu mengajar mereka.
    2. PENTING: Guru yang berada dalam "Senarai Guru Tidak Hadir" TIDAK BOLEH dicadangkan sebagai guru ganti.
    3. Untuk setiap slot yang kosong, cari semua guru yang berkelapangan (tidak mempunyai kelas dan tidak termasuk dalam senarai guru tidak hadir).
    4. Daripada senarai guru yang berkelapangan itu, cadangkan SATU guru ganti yang paling sesuai untuk setiap slot. 
       Elakkan seorang guru ganti ditugaskan pada dua kelas yang berbeza pada masa yang sama.
    5. Jika satu slot mempunyai lebih daripada seorang guru (contoh: "PM/AY PI/IM"), ia dikira sebagai satu unit pengajaran sahaja:
       - Jika seorang sahaja yang tidak hadir → tetap perlu seorang guru ganti.
       - Jika kedua-duanya tidak hadir → hanya seorang guru ganti diperlukan, bukan dua.
       - Dalam laporan, senaraikan semua guru asal yang tidak hadir, tetapi cadangkan hanya seorang guru ganti.
    6. Gunakan kriteria berikut untuk membuat cadangan:
        a. Keutamaan Tertinggi: Guru yang mengajar subjek yang sama.
        b. Keutamaan Kedua: Guru yang mengajar di tahun (kelas) yang sama.
        c. Keutamaan Ketiga: Guru yang mempunyai beban waktu mengajar paling sedikit pada hari tersebut untuk mengimbangi beban kerja.
    7. Sediakan justifikasi ringkas untuk setiap cadangan. Anda mesti memasukkan nama guru yang digantikan dalam justifikasi.
    8. Kembalikan jawapan anda dalam format JSON SAHAJA, ikut skema yang ditetapkan.

    Berikut adalah jadual gabungan untuk SEMUA guru yang tidak hadir pada hari ${absenceDay}:
    ${JSON.stringify(absentTeachersSchedules)}
  `;
};

// ✅ Schema updated: absentTeachers is an array of names
const responseSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      day: { type: Type.STRING },
      time: { type: Type.STRING },
      class: { type: Type.STRING },
      subject: { type: Type.STRING },
      absentTeachers: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      },
      substituteTeacherId: { type: Type.STRING },
      substituteTeacherName: { type: Type.STRING },
      justification: { type: Type.STRING },
    },
    required: ["day", "time", "class", "subject", "absentTeachers", "substituteTeacherId", "substituteTeacherName", "justification"]
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const { absentTeachersInfo, allTeachers, timetable, absenceDay } = req.body;

    if (!absentTeachersInfo || !allTeachers || !timetable || !absenceDay) {
      return res.status(400).json({ error: "Missing required fields in the request body." });
    }

    const prompt = generatePrompt(absentTeachersInfo, allTeachers, timetable, absenceDay);

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.2,
      },
    });

    const jsonText = response.text.trim();
    const rawResult = JSON.parse(jsonText) as any[];

    // ✅ Normalize absentTeachers to {id, name}[]
    const result: Substitution[] = rawResult.map(item => ({
      ...item,
      absentTeachers: item.absentTeachers.map((name: string) => {
        const teacher = allTeachers.find(t => t.name === name);
        return { id: teacher?.id || "", name };
      }),
    }));

    return res.status(200).json(result);

  } catch (error) {
    console.error("Error in Vercel function:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return res.status(500).json({ error: `Gagal menjana pelan guru ganti: ${errorMessage}` });
  }
}
