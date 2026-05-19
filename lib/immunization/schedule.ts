// lib/immunization/schedule.ts
// Kemenkes 2023 National Immunization Schedule + Vitamin A + Obat Cacing.
// Pure function: DOB → due dates. Deterministic, zero AI, fully offline.

export interface VaccineDefinition {
  code: string;
  label: string;
  doseNumber: number;
  dueAgeMonths: number;         // months from DOB
  category: 'imunisasi' | 'vitamin_a' | 'obat_cacing';
}

export interface VaccineStatus extends VaccineDefinition {
  dueDate: string;              // ISO date
  status: 'done' | 'overdue' | 'due_now' | 'upcoming';
  administeredDate?: string;    // ISO date, if done
}

export interface ImmunizationRecord {
  vaccine_code: string;
  dose_number: number;
  administered_date: string;    // ISO date
}

// ── Kemenkes 2023 Schedule ────────────────────────────────────────────────────
const SCHEDULE: VaccineDefinition[] = [
  // Birth
  { code: 'hb0', label: 'Hepatitis B (HB0)', doseNumber: 1, dueAgeMonths: 0, category: 'imunisasi' },
  { code: 'opv_0', label: 'Polio 0 (OPV tetes)', doseNumber: 1, dueAgeMonths: 0, category: 'imunisasi' },
  // 1 month
  { code: 'bcg', label: 'BCG', doseNumber: 1, dueAgeMonths: 1, category: 'imunisasi' },
  // 2 months
  { code: 'dpt_hb_hib_1', label: 'DPT-HB-Hib 1', doseNumber: 1, dueAgeMonths: 2, category: 'imunisasi' },
  { code: 'opv_1', label: 'Polio 1 (OPV)', doseNumber: 2, dueAgeMonths: 2, category: 'imunisasi' },
  { code: 'pcv_1', label: 'PCV 1', doseNumber: 1, dueAgeMonths: 2, category: 'imunisasi' },
  { code: 'rotavirus_1', label: 'Rotavirus 1', doseNumber: 1, dueAgeMonths: 2, category: 'imunisasi' },
  // 3 months
  { code: 'dpt_hb_hib_2', label: 'DPT-HB-Hib 2', doseNumber: 2, dueAgeMonths: 3, category: 'imunisasi' },
  { code: 'opv_2', label: 'Polio 2 (OPV)', doseNumber: 3, dueAgeMonths: 3, category: 'imunisasi' },
  { code: 'pcv_2', label: 'PCV 2', doseNumber: 2, dueAgeMonths: 3, category: 'imunisasi' },
  { code: 'rotavirus_2', label: 'Rotavirus 2', doseNumber: 2, dueAgeMonths: 3, category: 'imunisasi' },
  // 4 months
  { code: 'dpt_hb_hib_3', label: 'DPT-HB-Hib 3', doseNumber: 3, dueAgeMonths: 4, category: 'imunisasi' },
  { code: 'opv_3', label: 'Polio 3 (OPV)', doseNumber: 4, dueAgeMonths: 4, category: 'imunisasi' },
  { code: 'ipv_1', label: 'IPV 1 (Polio suntik)', doseNumber: 1, dueAgeMonths: 4, category: 'imunisasi' },
  { code: 'rotavirus_3', label: 'Rotavirus 3', doseNumber: 3, dueAgeMonths: 4, category: 'imunisasi' },
  // 9 months
  { code: 'mr_1', label: 'Campak-Rubela (MR) 1', doseNumber: 1, dueAgeMonths: 9, category: 'imunisasi' },
  // 10 months
  { code: 'ipv_2', label: 'IPV 2 (Polio suntik)', doseNumber: 2, dueAgeMonths: 10, category: 'imunisasi' },
  // 12 months
  { code: 'pcv_3', label: 'PCV 3 (booster)', doseNumber: 3, dueAgeMonths: 12, category: 'imunisasi' },
  // 18 months
  { code: 'dpt_hb_hib_4', label: 'DPT-HB-Hib 4 (booster)', doseNumber: 4, dueAgeMonths: 18, category: 'imunisasi' },
  { code: 'mr_2', label: 'Campak-Rubela (MR) 2', doseNumber: 2, dueAgeMonths: 18, category: 'imunisasi' },

  // ── Vitamin A ──
  // Kapsul biru (100,000 IU) at 6 months, then kapsul merah (200,000 IU) every Feb & Aug
  // Simplified: 6, 12, 18, 24, 30, 36, 42, 48, 54, 60 months
  { code: 'vita_1', label: 'Vitamin A (kapsul biru)', doseNumber: 1, dueAgeMonths: 6, category: 'vitamin_a' },
  { code: 'vita_2', label: 'Vitamin A (kapsul merah)', doseNumber: 2, dueAgeMonths: 12, category: 'vitamin_a' },
  { code: 'vita_3', label: 'Vitamin A (kapsul merah)', doseNumber: 3, dueAgeMonths: 18, category: 'vitamin_a' },
  { code: 'vita_4', label: 'Vitamin A (kapsul merah)', doseNumber: 4, dueAgeMonths: 24, category: 'vitamin_a' },
  { code: 'vita_5', label: 'Vitamin A (kapsul merah)', doseNumber: 5, dueAgeMonths: 30, category: 'vitamin_a' },
  { code: 'vita_6', label: 'Vitamin A (kapsul merah)', doseNumber: 6, dueAgeMonths: 36, category: 'vitamin_a' },
  { code: 'vita_7', label: 'Vitamin A (kapsul merah)', doseNumber: 7, dueAgeMonths: 42, category: 'vitamin_a' },
  { code: 'vita_8', label: 'Vitamin A (kapsul merah)', doseNumber: 8, dueAgeMonths: 48, category: 'vitamin_a' },
  { code: 'vita_9', label: 'Vitamin A (kapsul merah)', doseNumber: 9, dueAgeMonths: 54, category: 'vitamin_a' },
  { code: 'vita_10', label: 'Vitamin A (kapsul merah)', doseNumber: 10, dueAgeMonths: 60, category: 'vitamin_a' },

  // ── Obat Cacing ──
  // Every 6 months from 12 months to 59 months
  { code: 'cacing_1', label: 'Obat Cacing', doseNumber: 1, dueAgeMonths: 12, category: 'obat_cacing' },
  { code: 'cacing_2', label: 'Obat Cacing', doseNumber: 2, dueAgeMonths: 18, category: 'obat_cacing' },
  { code: 'cacing_3', label: 'Obat Cacing', doseNumber: 3, dueAgeMonths: 24, category: 'obat_cacing' },
  { code: 'cacing_4', label: 'Obat Cacing', doseNumber: 4, dueAgeMonths: 30, category: 'obat_cacing' },
  { code: 'cacing_5', label: 'Obat Cacing', doseNumber: 5, dueAgeMonths: 36, category: 'obat_cacing' },
  { code: 'cacing_6', label: 'Obat Cacing', doseNumber: 6, dueAgeMonths: 42, category: 'obat_cacing' },
  { code: 'cacing_7', label: 'Obat Cacing', doseNumber: 7, dueAgeMonths: 48, category: 'obat_cacing' },
  { code: 'cacing_8', label: 'Obat Cacing', doseNumber: 8, dueAgeMonths: 54, category: 'obat_cacing' },
  { code: 'cacing_9', label: 'Obat Cacing', doseNumber: 9, dueAgeMonths: 60, category: 'obat_cacing' },
];

function addMonths(dob: Date, months: number): Date {
  const d = new Date(dob);
  d.setMonth(d.getMonth() + months);
  return d;
}

function toISO(d: Date): string {
  return d.toISOString().split('T')[0];
}

function monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

/**
 * Get the full immunization status for a child given their DOB and existing records.
 * Returns only items relevant to the child's current age (not future items beyond age + 3 months).
 */
export function getImmunizationStatus(
  dob: string,
  records: ImmunizationRecord[],
  now?: Date
): VaccineStatus[] {
  const birthDate = new Date(dob);
  const today = now ?? new Date();
  const ageMonths = monthsBetween(birthDate, today);

  // Show items up to current age + 3 months (upcoming window)
  const relevantSchedule = SCHEDULE.filter(v => v.dueAgeMonths <= ageMonths + 3);

  return relevantSchedule.map(v => {
    const dueDate = addMonths(birthDate, v.dueAgeMonths);
    const dueDateStr = toISO(dueDate);

    // Check if this vaccine has been administered
    const record = records.find(
      r => r.vaccine_code === v.code && r.dose_number === v.doseNumber
    );

    let status: VaccineStatus['status'];
    if (record) {
      status = 'done';
    } else if (v.dueAgeMonths > ageMonths) {
      status = 'upcoming';
    } else if (v.dueAgeMonths === ageMonths || (v.dueAgeMonths >= ageMonths - 1 && v.dueAgeMonths <= ageMonths)) {
      status = 'due_now';
    } else {
      status = 'overdue';
    }

    return {
      ...v,
      dueDate: dueDateStr,
      status,
      administeredDate: record?.administered_date,
    };
  });
}

/**
 * Get summary counts for quick display
 */
export function getImmunizationSummary(statuses: VaccineStatus[]) {
  const done = statuses.filter(s => s.status === 'done').length;
  const overdue = statuses.filter(s => s.status === 'overdue').length;
  const dueNow = statuses.filter(s => s.status === 'due_now').length;
  const upcoming = statuses.filter(s => s.status === 'upcoming').length;
  return { done, overdue, dueNow, upcoming, total: statuses.length };
}

/**
 * Get all vaccines that are overdue or due now (for the "log today" action)
 */
export function getActionableVaccines(statuses: VaccineStatus[]): VaccineStatus[] {
  return statuses.filter(s => s.status === 'overdue' || s.status === 'due_now');
}
