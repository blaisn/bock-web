// Formatage (fr-CA)

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juill.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export function dateCourte(iso?: string | null): string {
  if (!iso) return '';
  const [a, m, j] = iso.slice(0, 10).split('-').map(Number);
  return `${j} ${MOIS[m - 1]} ${a}`;
}

export function heure(iso?: string | null): string {
  if (!iso || iso.length < 16) return '';
  const hm = iso.slice(11, 16);
  return hm === '00:00' ? '' : hm.replace(':', ' h ');
}

export function annee(iso: string): string {
  return iso.slice(0, 4);
}

/** Cote ou pourcentage affiché comme .667 (style baseball) */
export function trois(x: number): string {
  if (x >= 1) return '1.000';
  return x.toFixed(3).replace(/^0/, '');
}

export function signe(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

/** Date-heure locale courante au format AAAA-MM-JJTHH:MM:SS */
export function maintenantLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`;
}

export function aujourdhui(): string {
  return maintenantLocal().slice(0, 10);
}

export function ilYa(iso?: string | null): string {
  if (!iso) return 'jamais';
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  return dateCourte(iso);
}
