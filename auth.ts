// Client-side auth helpers — stores Kader identity in localStorage

export interface KaderIdentity {
  profileId: string;
  name: string;
  ngoId: string;
  phone: string;
  savedAt: string;
}

const STORAGE_KEY = "sahaibat_kader_identity";

export function getIdentity(): KaderIdentity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as KaderIdentity;
  } catch {
    return null;
  }
}

export function saveIdentity(identity: KaderIdentity): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
}

export function clearIdentity(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function isLoggedIn(): boolean {
  return getIdentity() !== null;
}

export function normalisePhone(raw: string): string {
  let p = raw.trim().replace(/\s+/g, "").replace(/-/g, "");
  if (p.startsWith("0")) p = "+62" + p.slice(1);
  if (p.startsWith("62") && !p.startsWith("+62")) p = "+" + p;
  if (!p.startsWith("+")) p = "+62" + p;
  return p;
}
