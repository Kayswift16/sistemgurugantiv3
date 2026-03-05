import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { Teacher, ScheduleEntry, Substitution } from '../src/types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable is not set");
}

// Menggunakan SDK rasmi yang baru
const genAI = new GoogleGenerativeAI(process.env.API_KEY);

const generatePrompt = (
  absentTeachersInfo: { teacher: Teacher; reason: string }[],
  allTeachers: Teacher[],
  timetable: ScheduleEntry[],
  absenceDay: string,
): string => {
  const upperCaseAbsenceDay = absenceDay.toUpperCase();
  const relevantTimetableForDay = timetable.filter(
    entry => entry.day.toUpperCase() === upperCaseAbsenceDay
  );

  const absentTeacherDetails = absentTeachersInfo.map(info =>
    `- ${info.teacher.name} (${info.teacher.id}), Sebab: ${info.reason || 'Tidak dinyatakan'}`
  ).join('\n');

  const absentTeacherIds = absentTeachersInfo.map(info => info.teacher.id);

  const absentTeachersSchedules = relevantTimetableForDay.filter(entry =>
    entry.subjects.some(s => absentTeacherIds.includes(s.teacherId))
  );

  const teacherList = allTeachers.map(t => `${t.id}:${t.name}`).join(", ");

  const timetableSummary = relevantTimetableForDay.map(e =>
    `${e.time} ${e.class} ${e.subjects.map(s => `${s.subject}/${s.teacherId}`).join(" ")}`
  ).join("; ");

  const absentSummary = absentTeachersSchedules.map(e =>
    `${e.time} ${e.class} ${e.subjects.map(s => `${s.subject}/${s.teacherId}`).join(" ")}`
  ).join("; ");

  return `
Anda adalah Penolong Kanan Pentadbiran yang bijak di sebuah sekolah. 
Tugas anda adalah untuk mencari guru ganti terbaik untuk SEMUA guru yang tidak hadir pada hari tertentu.

MAKLUMAT KES:
- Hari Tidak Hadir: ${absenceDay}
- Senarai Guru Tidak Hadir:
${absentTeacherDetails}
- Senarai Guru (kod → nama): ${teacherList}
- Jadual ${absenceDay}: ${timetableSummary}

TUGASAN:
1. Untuk SETIAP guru yang tidak hadir, kenal pasti semua slot waktu mengajar mereka.
2. Guru yang berada dalam "Senarai Guru Tidak Hadir" TIDAK BOLEH dicadangkan sebagai guru ganti.
3. Untuk setiap slot yang kosong, cari guru yang berkelapangan.
4. Jika satu slot mempunyai lebih daripada seorang guru, cadangkan hanya seorang guru ganti.
5. Keutamaan: Subjek sama > Tahun sama > Beban waktu sedikit.
6. Kembalikan jawapan dalam format JSON SAHAJA ikut skema yang ditetapkan.

Slot pengajaran guru tidak hadir (${absenceDay}):
${absentSummary}
`;
};

// Skema JSON mengikut format SDK @google/generative-ai
const responseSchema = {
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      day: { type: SchemaType.STRING },
      time: { type: SchemaType.STRING },
      class: { type: SchemaType.STRING },
      subject: { type: SchemaType.STRING },
      absentTeachers: {
        type: SchemaType.ARRAY,
        items: { type: SchemaType.STRING }
      },
      substituteTeacherId: { type: SchemaType.STRING },
      substituteTeacherName: { type: SchemaType.STRING },
      justification: { type: SchemaType.STRING },
    },
    required: [
      "day", "time", "class", "subject", "absentTeachers", 
      "substituteTeacherId", "substituteTeacherName", "justification"
    ]
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
      return res.status(400).json({ error: "Missing required fields." });
    }

    const prompt = generatePrompt(absentTeachersInfo, allTeachers, timetable, absenceDay);

    // Menggunakan model 1.5-flash untuk kestabilan tinggi
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      }
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const jsonText = response.text();
    
    const rawResult = JSON.parse(jsonText) as any[];

    const finalResult: Substitution[] = rawResult.map(item => ({
      ...item,
      absentTeachers: item.absentTeachers.map((name: string) => {
        const teacher = allTeachers.find(t => t.name === name);
        return { id: teacher?.id || "", name };
      }),
    }));

    return res.status(200).json(finalResult);

  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Ralat tidak diketahui.";
    return res.status(500).json({ error: `Gagal menjana pelan: ${errorMessage}` });
  }
}
