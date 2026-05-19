// lib/counselling/isiPiringku.ts
// IYCF + Isi Piringku nutrition counselling engine — Kemenkes competencies 2b, 3b, 4a, 5a.
// Pure function, zero AI, fully offline. Returns Bahasa Indonesia text block
// appended to triage reports for all sasaran types.

export type SasaranType =
  | 'child'        // 0–59 bulan (bayi & balita)
  | 'maternal'     // ibu hamil
  | 'postpartum'   // ibu nifas / menyusui
  | 'neonatal'     // 0–28 hari (not applicable for feeding counselling beyond ASI)
  | 'remaja'       // 6–18 tahun
  | 'produktif'    // 18–59 tahun
  | 'lansia';      // 60+ tahun

export interface IsiPiringkuInput {
  sasaranType: SasaranType;
  ageMonths?: number | null;       // for child: 0–59; for remaja: age in years × 12
  feedingFreq?: '1' | '2' | '3' | null;  // child feeding frequency
  muacCat?: 'sam' | 'mam' | 'normal';    // child MUAC classification
  laz?: string | null;             // child stunting status
  kekStatus?: 'kek' | 'normal' | 'not_measured';  // maternal KEK
  gender?: 'male' | 'female' | null;
}

export function generateIsiPiringku(input: IsiPiringkuInput): string {
  const lines: string[] = [];

  switch (input.sasaranType) {
    case 'child':
    case 'neonatal':
      return generateChildIYCF(input);
    case 'maternal':
      return generateMaternalNutrition(input);
    case 'postpartum':
      return generatePostpartumNutrition();
    case 'remaja':
      return generateRemajaNutrition(input);
    case 'produktif':
      return generateProduktifNutrition();
    case 'lansia':
      return generateLansiaNutrition();
    default:
      return '';
  }
}

// ── CHILD IYCF (0–59 months) ──────────────────────────────────────────────────

function generateChildIYCF(input: IsiPiringkuInput): string {
  const age = input.ageMonths ?? 0;
  const lines: string[] = ['🍽️ PANDUAN MAKAN'];

  // Age-specific feeding guidance
  if (age < 6) {
    lines.push('');
    lines.push('👶 ASI EKSKLUSIF (0–6 bulan):');
    lines.push('• ASI saja — tidak perlu air putih, madu, atau susu formula');
    lines.push('• Susui 8–12 kali per hari (termasuk malam)');
    lines.push('• Tanda bayi cukup ASI: kencing ≥6x/hari, berat naik');
    lines.push('• Jemur pagi jam 7–9 selama 10–15 menit untuk vitamin D');
  } else if (age >= 6 && age <= 8) {
    lines.push(` (usia ${age} bulan — mulai MPASI)`);
    lines.push('');
    lines.push('🥣 MPASI + ASI:');
    lines.push('• Frekuensi: 2–3 kali makan utama + ASI');
    lines.push('• Tekstur: Lumat/halus (bubur saring)');
    lines.push('• Porsi: Mulai 2–3 sendok makan, naik bertahap');
    lines.push('• WAJIB protein hewani SETIAP kali makan:');
    lines.push('  → Telur ayam kampung, hati ayam, ikan lele/nila/teri');
    lines.push('• Tambah sayur: bayam, labu kuning, wortel (haluskan)');
    lines.push('• Buah: pepaya, pisang (kaya vitamin C & A)');
    lines.push('• Lanjutkan ASI sesering mungkin');
  } else if (age >= 9 && age <= 11) {
    lines.push(` (usia ${age} bulan)`);
    lines.push('');
    lines.push('🥣 MPASI + ASI:');
    lines.push('• Frekuensi: 3–4 kali makan + 1 selingan + ASI');
    lines.push('• Tekstur: Dicincang halus, finger food');
    lines.push('• Minimal 4 kelompok makanan per hari');
    lines.push('• Protein hewani SETIAP kali makan:');
    lines.push('  → Telur, ikan, ayam, hati ayam (2–3x/minggu)');
    lines.push('• Karbohidrat: nasi tim, ubi, kentang');
    lines.push('• Sayur + buah setiap hari');
    lines.push('• Lanjutkan ASI');
  } else if (age >= 12 && age <= 23) {
    lines.push(` (usia ${age} bulan)`);
    lines.push('');
    lines.push('🥗 MAKANAN KELUARGA + ASI:');
    lines.push('• Frekuensi: 3–4 kali makan + 1–2 selingan');
    lines.push('• Tekstur: Makanan keluarga (dicincang/dipotong kecil)');
    lines.push('• Lanjutkan ASI sampai 2 tahun atau lebih');
    lines.push('• Protein hewani setiap kali makan utama');
    lines.push('• Variasikan: tempe, tahu, kacang hijau, ikan teri');
    lines.push('• Hindari makanan manis, asin berlebihan, dan jajanan kemasan');
  } else if (age >= 24) {
    lines.push(` (usia ${age} bulan)`);
    lines.push('');
    lines.push('🥗 ISI PIRINGKU ANAK:');
    lines.push('• Frekuensi: 3 kali makan + 2 selingan sehat');
    lines.push('• Porsi seimbang: ⅓ karbohidrat, ⅓ sayur+buah, ⅓ lauk');
    lines.push('• Protein hewani: telur, ikan, ayam, daging');
    lines.push('• Protein nabati: tempe, tahu, kacang-kacangan');
    lines.push('• Sayur hijau setiap hari (bayam, kangkung, buncis)');
    lines.push('• Buah: pepaya, jeruk, pisang (vitamin C bantu serap zat besi)');
    lines.push('• Minum air putih cukup');
  }

  // Conditional warnings
  if (input.feedingFreq === '1') {
    lines.push('');
    lines.push('⚠️ FREKUENSI MAKAN KURANG:');
    if (age < 6) {
      lines.push('• Susui lebih sering — minimal 8x/hari termasuk malam');
      lines.push('• Pastikan posisi dan pelekatan menyusu benar');
    } else {
      lines.push('• Tingkatkan frekuensi makan segera');
      lines.push('• Tambah selingan bergizi antara makan utama');
      lines.push('• Jika anak sulit makan, coba porsi kecil lebih sering');
    }
  }

  if (input.muacCat === 'sam' || input.muacCat === 'mam') {
    lines.push('');
    lines.push('⚠️ GIZI KURANG — PERLU PMT:');
    lines.push('• Ibu berhak mendapat PMT dari Puskesmas/Posyandu');
    lines.push('• Berikan makanan padat energi: telur, hati ayam, minyak');
    lines.push('• Makan lebih sering: 5–6 kali per hari');
    lines.push('• Bawa ke Posyandu setiap bulan untuk pantau berat badan');
  }

  const isStunted = input.laz === 'stunted' || input.laz === 'severely_stunted';
  if (isStunted) {
    lines.push('');
    lines.push('⚠️ ANAK PENDEK (STUNTING):');
    lines.push('• Prioritaskan protein hewani: telur setiap hari');
    lines.push('• Hati ayam 2–3x/minggu (kaya zat besi + vitamin A)');
    lines.push('• Ikan teri dimakan dengan tulang (kalsium)');
    lines.push('• Pastikan imunisasi lengkap — infeksi menghambat pertumbuhan');
  }

  // Vitamin A & obat cacing reminder
  if (age >= 6) {
    lines.push('');
    lines.push('💊 SUPLEMEN:');
    if (age >= 6 && age < 12) {
      lines.push('• Vitamin A kapsul BIRU: 1x di usia 6 bulan (GRATIS di Posyandu, Feb & Ags)');
    } else {
      lines.push('• Vitamin A kapsul MERAH: setiap Februari & Agustus di Posyandu (GRATIS)');
    }
    if (age >= 12) {
      lines.push('• Obat cacing: setiap 6 bulan (GRATIS di Posyandu)');
    }
  }

  return lines.join('\n');
}

// ── MATERNAL NUTRITION ────────────────────────────────────────────────────────

function generateMaternalNutrition(input: IsiPiringkuInput): string {
  const lines: string[] = [
    '🍽️ ISI PIRINGKU IBU HAMIL',
    '',
    '🥗 POLA MAKAN:',
    '• 3 kali makan utama + 2 selingan sehat per hari',
    '• Tambah porsi: +300 kkal/hari di trimester 2 & 3',
    '• Protein hewani SETIAP kali makan: telur, ikan, ayam, daging',
    '• Tempe dan tahu sebagai tambahan protein nabati',
    '• Sayur hijau setiap hari: bayam, kangkung (kaya zat besi & folat)',
    '• Buah: pepaya, jeruk (vitamin C bantu serap zat besi)',
    '• Hindari: teh/kopi bersamaan makan (hambat serap zat besi)',
    '',
    '💊 SUPLEMEN WAJIB:',
    '• TTD (Tablet Tambah Darah): 1 tablet setiap hari selama hamil',
    '• Minum TTD dengan air jeruk, JANGAN bersamaan teh/kopi/susu',
    '• Jika mual, minum TTD sebelum tidur',
  ];

  if (input.kekStatus === 'kek') {
    lines.push('');
    lines.push('⚠️ IBU KEK — PERLU MAKAN EKSTRA:');
    lines.push('• Tambah telur 1–2 butir per hari');
    lines.push('• Makan lebih sering: 5–6 kali per hari');
    lines.push('• Minta PMT (Pemberian Makanan Tambahan) di Puskesmas — GRATIS');
    lines.push('• Kontrol LILA setiap bulan di Posyandu');
  }

  return lines.join('\n');
}

// ── POSTPARTUM / BREASTFEEDING NUTRITION ──────────────────────────────────────

function generatePostpartumNutrition(): string {
  return [
    '🍽️ ISI PIRINGKU IBU NIFAS & MENYUSUI',
    '',
    '🥗 POLA MAKAN:',
    '• 3 kali makan utama + 2 selingan — porsi lebih banyak dari biasa',
    '• Tambah +500 kkal/hari untuk produksi ASI',
    '• Protein hewani: telur, ikan, ayam, daging — penting untuk pemulihan',
    '• Pelancar ASI: daun katuk (tumis/sayur bening), kacang-kacangan',
    '• Sayur hijau: bayam, kangkung, daun singkong (zat besi + folat)',
    '• Buah: pepaya (SANGAT dianjurkan — vitamin C + vitamin A)',
    '• Minum air putih minimal 8 gelas/hari',
    '',
    '❌ MITOS YANG SALAH:',
    '• Ibu nifas BOLEH makan ikan, telur, ayam — justru WAJIB untuk pemulihan',
    '• Tidak ada pantangan makanan setelah melahirkan',
    '',
    '💊 SUPLEMEN:',
    '• Vitamin A kapsul MERAH: 2 kali setelah melahirkan (minta ke bidan — GRATIS)',
    '• TTD: lanjutkan minimal 40 hari setelah melahirkan',
    '',
    '🧠 KESEHATAN MENTAL:',
    '• Rasa sedih/menangis di hari-hari pertama itu NORMAL (baby blues)',
    '• Jika berlanjut >2 minggu atau tidak mau merawat bayi → bicara ke bidan',
  ].join('\n');
}

// ── REMAJA NUTRITION ──────────────────────────────────────────────────────────

function generateRemajaNutrition(input: IsiPiringkuInput): string {
  const lines: string[] = [
    '🍽️ ISI PIRINGKU REMAJA',
    '',
    '🥗 POLA MAKAN SEIMBANG:',
    '• 3 kali makan utama + 2 selingan sehat',
    '• Porsi piring: ⅓ karbohidrat (nasi/ubi), ⅓ sayur+buah, ⅓ lauk',
    '• Protein hewani: telur, ikan, ayam, daging',
    '• Protein nabati: tempe, tahu, kacang-kacangan',
    '• Sayur + buah SETIAP hari — minimal 5 porsi',
    '• Minum air putih 8 gelas/hari',
    '',
    '❌ HINDARI:',
    '• Jajanan kemasan tinggi gula, garam, lemak',
    '• Minuman manis/bersoda',
    '• Melewatkan sarapan',
    '',
    '🏃 AKTIVITAS FISIK:',
    '• Minimal 60 menit per hari — jalan kaki, lari, olahraga, bermain aktif',
  ];

  if (input.gender === 'female') {
    lines.push('');
    lines.push('💊 KHUSUS REMAJA PUTRI:');
    lines.push('• Minum TTD (Tablet Tambah Darah) 1x/minggu — cegah anemia');
    lines.push('• Makan makanan kaya zat besi: hati, daging merah, bayam');
    lines.push('• Vitamin C (jeruk, pepaya) bantu serap zat besi');
  }

  return lines.join('\n');
}

// ── USIA PRODUKTIF NUTRITION ──────────────────────────────────────────────────

function generateProduktifNutrition(): string {
  return [
    '🍽️ ISI PIRINGKU — GERMAS',
    '',
    '🥗 POLA MAKAN SEIMBANG:',
    '• Porsi piring: ⅓ karbohidrat, ⅓ sayur+buah, ⅓ lauk (hewani+nabati)',
    '• Batasi gula: <4 sdm/hari (50 gram)',
    '• Batasi garam: <1 sdt/hari (5 gram)',
    '• Batasi lemak: <5 sdm minyak/hari (67 gram)',
    '• Minum air putih 8 gelas/hari',
    '• Perbanyak sayur hijau dan buah berwarna',
    '',
    '🏃 AKTIVITAS FISIK:',
    '• Minimal 150 menit per minggu (30 menit × 5 hari)',
    '• Jalan kaki, bersepeda, senam, berkebun',
    '• Kurangi duduk lama — berdiri dan bergerak setiap 30 menit',
    '',
    '🩺 CEK KESEHATAN RUTIN:',
    '• Timbang berat badan setiap bulan',
    '• Cek tekanan darah minimal 1x/tahun',
    '• Cek gula darah jika ada faktor risiko',
    '• Jangan merokok — berbahaya bagi diri sendiri dan keluarga',
  ].join('\n');
}

// ── LANSIA NUTRITION ──────────────────────────────────────────────────────────

function generateLansiaNutrition(): string {
  return [
    '🍽️ ISI PIRINGKU LANSIA',
    '',
    '🥗 POLA MAKAN:',
    '• Porsi kecil tapi sering: 3 makan utama + 2–3 selingan',
    '• Protein cukup: telur, ikan, tempe, tahu — cegah otot melemah',
    '• Kalsium untuk tulang: ikan teri (dengan tulang), susu jika tersedia',
    '• Sayur dan buah lunak setiap hari',
    '• Kurangi garam — cegah tekanan darah naik',
    '• Minum air putih cukup meski tidak merasa haus',
    '',
    '🏃 AKTIVITAS:',
    '• Jalan kaki ringan 30 menit/hari',
    '• Senam lansia jika tersedia di Posyandu',
    '• Latihan keseimbangan — cegah jatuh',
    '',
    '⚠️ PERHATIAN KHUSUS:',
    '• Jika sulit mengunyah: haluskan makanan, buat sup/bubur bergizi',
    '• Jika nafsu makan turun: makan sedikit-sedikit tapi sering',
    '• Jaga sosial aktif — ikut kegiatan Posyandu Lansia',
    '• Minum obat rutin sesuai anjuran dokter — jangan putus sendiri',
  ].join('\n');
}
