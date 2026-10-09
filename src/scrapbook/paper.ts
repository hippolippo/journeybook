export interface Paper {
  id: string;
  label: string;
  color: string;
  ink: string;
  lined: boolean;
  dark?: boolean;
}

export const PAPERS: Paper[] = [
  { id: 'cream', label: 'Cream', color: '#fdf8ef', ink: 'rgba(74,59,46,0.05)', lined: true },
  { id: 'blush', label: 'Blush', color: '#f7e6e2', ink: 'rgba(74,59,46,0.05)', lined: true },
  { id: 'mint', label: 'Mint', color: '#e6efe4', ink: 'rgba(74,59,46,0.05)', lined: true },
  { id: 'sky', label: 'Sky', color: '#e4eef4', ink: 'rgba(74,59,46,0.05)', lined: true },
  { id: 'mustard', label: 'Mustard', color: '#f6eccb', ink: 'rgba(74,59,46,0.05)', lined: true },
  { id: 'kraft', label: 'Kraft', color: '#e8d9c0', ink: 'rgba(74,59,46,0.05)', lined: false },
  { id: 'lilac', label: 'Lilac', color: '#ebe3f1', ink: 'rgba(74,59,46,0.05)', lined: true },
  { id: 'charcoal', label: 'Charcoal', color: '#3b3a44', ink: 'rgba(255,255,255,0.06)', lined: true, dark: true },
];

export function paperById(id?: string): Paper {
  return PAPERS.find((p) => p.id === id) ?? PAPERS[0];
}

export function paperCss(p: Paper): Record<string, string> {
  return {
    background: p.color,
    backgroundImage: p.lined ? `linear-gradient(${p.ink} 1px, transparent 1px)` : 'none',
    '--page-ink': p.dark ? '#f4efe6' : '#4a3b2e',
  };
}
