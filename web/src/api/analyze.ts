import client from './client';
import type { AnalyzeResult, PracticeType } from '../types';

export const analyze = (sentence: string, includeSpoken: boolean, practiceType: PracticeType) =>
  client.post<AnalyzeResult>('/api/analyze', { sentence, includeSpoken, practiceType }).then(r => r.data);
