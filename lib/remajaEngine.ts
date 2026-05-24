// lib/remajaEngine.ts
// Offline remaja (6–18 tahun) triage engine for SahAIbat Kader PWA.
// Covers Kemenkes Group 4: Usia Sekolah & Remaja.
// Competencies: 4a (Isi Piringku + aktivitas fisik), 4b (TTD + Hb), 4c (merokok/NAPZA).
// Deterministic, zero AI, fully offline.

import { generateIsiPiringku } from './counselling/isiPiringku';
import { generateIsiPiringku } from './counselling/isiPiringku';
import { runIspaScreen } from './ispaScreen';

export interface RemajaInput {
  patientName: string;
  nik: string;
  age_years: number;
  gender: 'male' | 'female';
  weight_kg: number;
  height_cm: number;
  waist_cm: number | null;          // lingkar perut (optional)
  bp_sys: number | null;            // tekanan darah (optional)
  bp_dia: number | null;
  // TTD — remaja putri only
  ttd_adherence: '1' | '2' | '3' | null;  // 1=rutin, 2=kadang, 3=tidak/tidak dapat
  hb_screening: '1' | '2' | '3' | null;   // 1=bulan ini, 2=>3 bulan, 3=belum pernah
  // Lifestyle
  activity_level: '1' | '2' | '3';   // 1=ya 60min/hari, 2=kadang, 3=jarang
  eating_pattern: '1' | '2' | '3';   // 1=sesuai isi piringku, 2=kadang, 3=tidak
  smoking: '1' | '2' | '3';          // 1=ya, 2=pernah, 3=tidak
  // ISPA screening
  ispa_batuk: 'kering' | 'berdahak' | 'tidak';
  ispa_sesak: boolean;
  ispa_mata: boolean;
  ispa_paparan: boolean;
  ispa_durasi: number | null;
}

export interface RemajaResult {
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  bmi: number;
  bmiCategory: 'severely_thin' | 'thin' | 'normal' | 'overweight' | 'obese';
  bpCategory: 'hypertension' | 'elevated' | 'normal' | 'not_measured';
  waistFlag: 'obesitas_sentral' | 'normal' | 'not_measured';
  referNow: boolean;
  followUpDays: number;
  reportText: string;
  ispaRisk: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
}

// ── BMI-for-age simplified classification (WHO adolescent reference) ──
// Using simplified adult-like cutoffs adjusted for adolescents.
// A full implementation would use age+gender specific z-score tables.
function classifyBMI(bmi: number, ageYears: number): 'severely_thin' | 'thin' | 'normal' | 'overweight' | 'obese' {
  // Simplified thresholds (approximate WHO BMI-for-age percentiles)
  if (ageYears < 10) {
    // Younger children: slightly different cutoffs
    if (bmi < 13) return 'severely_thin';
    if (bmi < 14.5) return 'thin';
    if (bmi < 18.5) return 'normal';
    if (bmi < 21) return 'overweight';
    return 'obese';
  } else {
    // Adolescents 10-18
    if (bmi < 14.5) return 'severely_thin';
    if (bmi < 16) return 'thin';
    if (bmi < 23) return 'normal';
    if (bmi < 27) return 'overweight';
    return 'obese';
  }
}

function bmiLabel(cat: string): string {
  switch (cat) {
    case 'severely_thin': return '🔴 Sangat kurus (gizi buruk)';
    case 'thin': return '🟡 Kurus (gizi kurang)';
    case 'normal': return '🟢 Normal';
    case 'overweight': return '🟡 Gemuk (overweight)';
    case 'obese': return '🔴 Obesitas';
    default: return '—';
  }
}

function classifyBP(sys: number | null, dia: number | null): 'hypertension' | 'elevated' | 'normal' | 'not_measured' {
  if (sys == null || dia == null) return 'not_measured';
  if (sys >= 140 || dia >= 90) return 'hypertension';
  if (sys >= 120 || dia >= 80) return 'elevated';
  return 'normal';
}

function classifyWaist(waistCm: number | null, gender: 'male' | 'female'): 'obesitas_sentral' | 'normal' | 'not_measured' {
  if (waistCm == null) return 'not_measured';
  // Indonesian adult thresholds (applied from age 15+, approximate for adolescents)
  const threshold = gender === 'male' ? 90 : 80;
  return waistCm > threshold ? 'obesitas_sentral' : 'normal';
}

export function runRemajaTriage(input: RemajaInput, chwName?: string): RemajaResult {
  const bmi = input.weight_kg / ((input.height_cm / 100) ** 2);
  const bmiCat = classifyBMI(bmi, input.age_years);
  const bpCat = classifyBP(input.bp_sys, input.bp_dia);
  const waistFlag = classifyWaist(input.waist_cm, input.gender);

  // Risk classification
  const isHigh =
    bpCat === 'hypertension' ||
    bmiCat === 'obese' ||
    bmiCat === 'severely_thin' ||
    (input.smoking === '1' && (bpCat === 'elevated' || bmiCat === 'overweight'));

  const isMedium = !isHigh && (
    bmiCat === 'thin' ||
    bmiCat === 'overweight' ||
    bpCat === 'elevated' ||
    waistFlag === 'obesitas_sentral' ||
    input.ttd_adherence === '3' ||
    input.hb_screening === '3' ||
    (input.eating_pattern === '3' && input.activity_level === '3')
  );

 // ISPA screening
  const ispaResult = runIspaScreen(
    { batuk: input.ispa_batuk, sesakNapas: input.ispa_sesak, mataPerih: input.ispa_mata, paparanAsap: input.ispa_paparan, durasiHari: input.ispa_durasi },
    { isChild: input.age_years < 12, isPregnant: false, isElderly: false }
  );

  const riskLevel = (isHigh || ispaResult.referNow) ? 'HIGH' : (isMedium || ispaResult.ispaRisk === 'MEDIUM') ? 'MEDIUM' : 'LOW';
  const referNow = isHigh || ispaResult.referNow;
  const followUpDays = isHigh ? 0 : isMedium ? 14 : 90;

  // Build report
  const lines: string[] = [
    '📋 LAPORAN SKRINING — USIA SEKOLAH & REMAJA',
    '',
    '👤 DATA',
    `Nama: ${input.patientName}`,
    `Usia: ${input.age_years} tahun`,
    `Jenis kelamin: ${input.gender === 'male' ? 'Laki-laki' : 'Perempuan'}`,
    '',
    '📏 HASIL PENGUKURAN',
    `Berat badan: ${input.weight_kg} kg`,
    `Tinggi badan: ${input.height_cm} cm`,
    `IMT (BMI): ${bmi.toFixed(1)} kg/m²`,
    `${bmiLabel(bmiCat)}`,
  ];

  if (input.waist_cm != null) {
    lines.push(`Lingkar perut: ${input.waist_cm} cm${waistFlag === 'obesitas_sentral' ? ' — ⚠️ Obesitas sentral' : ' — Normal'}`);
  }
  if (input.bp_sys != null && input.bp_dia != null) {
    const bpEmoji = bpCat === 'hypertension' ? '🔴' : bpCat === 'elevated' ? '🟡' : '🟢';
    lines.push(`Tekanan darah: ${input.bp_sys}/${input.bp_dia} mmHg ${bpEmoji} ${bpCat === 'hypertension' ? 'Hipertensi' : bpCat === 'elevated' ? 'Meningkat' : 'Normal'}`);
  }

  // Risk banner
  lines.push('');
  if (riskLevel === 'HIGH') {
    lines.push('🔴 RISIKO TINGGI — Rujuk ke Puskesmas');
  } else if (riskLevel === 'MEDIUM') {
    lines.push('🟡 PERLU PERHATIAN — Pantau dan edukasi');
  } else {
    lines.push('🟢 SEHAT — Lanjutkan pola hidup baik');
  }

  // TTD section (remaja putri only)
  if (input.gender === 'female') {
    lines.push('');
    lines.push('💊 TABLET TAMBAH DARAH (TTD)');
    if (input.ttd_adherence === '1') {
      lines.push('✅ Rutin minum TTD — pertahankan!');
    } else if (input.ttd_adherence === '2') {
      lines.push('⚠️ Kadang-kadang minum TTD — tingkatkan menjadi 1x/minggu');
    } else if (input.ttd_adherence === '3') {
      lines.push('🔴 Tidak minum TTD — risiko anemia!');
      lines.push('• Minta TTD GRATIS di Puskesmas/sekolah');
      lines.push('• Minum 1 tablet per minggu');
    }

    if (input.hb_screening === '3') {
      lines.push('⚠️ Belum pernah skrining Hb — rujuk ke Puskesmas');
    } else if (input.hb_screening === '2') {
      lines.push('📋 Skrining Hb sudah >3 bulan — perlu cek ulang');
    }
  }

  // Lifestyle assessment
  lines.push('');
  lines.push('🏃 GAYA HIDUP');
  if (input.activity_level === '1') {
    lines.push('✅ Aktivitas fisik baik (≥60 menit/hari)');
  } else if (input.activity_level === '2') {
    lines.push('⚠️ Aktivitas fisik kurang — tingkatkan menjadi 60 menit/hari');
  } else {
    lines.push('🔴 Jarang aktivitas fisik — risiko kesehatan meningkat');
    lines.push('• Target: 60 menit per hari (jalan, lari, olahraga, bermain)');
  }

  if (input.eating_pattern === '1') {
    lines.push('✅ Pola makan sesuai Isi Piringku');
  } else if (input.eating_pattern === '2') {
    lines.push('⚠️ Pola makan belum seimbang — perbaiki porsi Isi Piringku');
  } else {
    lines.push('🔴 Pola makan tidak seimbang — risiko gizi kurang/lebih');
  }

  // Smoking
  if (input.smoking === '1') {
    lines.push('');
    lines.push('🚬 PERINGATAN MEROKOK');
    lines.push('🔴 Merokok/vape aktif — SANGAT BERBAHAYA');
    lines.push('• Merusak paru-paru, jantung, dan otak yang masih berkembang');
    lines.push('• Risiko kanker, stroke, dan penyakit jantung meningkat');
    lines.push('• Hentikan sekarang — minta bantuan di Puskesmas');
    lines.push('• Jauhi teman yang mengajak merokok');
  } else if (input.smoking === '2') {
    lines.push('');
    lines.push('🚬 Pernah merokok — jangan mulai lagi. Rokok sangat berbahaya bagi kesehatan.');
  }

  // Tindak lanjut
  lines.push('');
  lines.push('✅ TINDAK LANJUT');
  if (riskLevel === 'HIGH') {
    lines.push('• Rujuk ke Puskesmas untuk pemeriksaan lanjutan');
    if (bpCat === 'hypertension') lines.push('• Tekanan darah tinggi — perlu evaluasi dokter');
    if (bmiCat === 'obese') lines.push('• Obesitas — perlu konseling gizi di Puskesmas');
    if (bmiCat === 'severely_thin') lines.push('• Sangat kurus — perlu evaluasi gizi di Puskesmas');
  } else if (riskLevel === 'MEDIUM') {
    lines.push('• Pantau berat badan dan tekanan darah setiap bulan');
    lines.push('• Perbaiki pola makan dan tingkatkan aktivitas fisik');
    if (input.gender === 'female' && input.ttd_adherence !== '1') {
      lines.push('• Rutin minum TTD 1x/minggu');
    }
  } else {
    lines.push('• Pertahankan gaya hidup sehat');
    lines.push('• Cek kesehatan rutin di Posyandu setiap 3 bulan');
  }

  // Isi Piringku counselling
  const nutritionSection = generateIsiPiringku({
    sasaranType: 'remaja',
    gender: input.gender,
  });
  if (nutritionSection) {
    lines.push('');
    lines.push(nutritionSection);
  }

  lines.push('');
  if (chwName) lines.push(`Kader: ${chwName}`);
  if (ispaResult.reportSection) {
    lines.push('');
    lines.push(ispaResult.reportSection);
  }

  lines.push('Bukan diagnosis. SahAIbat Kader v1.');

  return {
    riskLevel,
    bmi,
    bmiCategory: bmiCat,
    bpCategory: bpCat,
    waistFlag,
    referNow,
    followUpDays,
    reportText: lines.join('\n'),
    ispaRisk: ispaResult.ispaRisk,
  };
}
