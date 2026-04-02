export interface Category {
  id: number;
  name: string;
}

export interface Entry {
  id: number;
  question?: string;
  original: string;
  spoken: string;
  translation: string;
  analysis: string;
  corrections: string;
  timestamp: string;
  color: string | null;
  categoryId: number | null;
}

export interface AnalyzeResult {
  spoken: string;
  translation: string;
  analysis: string;
  corrections: string;
  fromCache: boolean;
}

export type PracticeType = 'general' | 'interview';

export interface PendingEntry extends AnalyzeResult {
  question: string;
  original: string;
  includeSpoken: boolean;
  practiceType: PracticeType;
}
