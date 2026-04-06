import client from './client';

export interface ExamHistoryRecord {
  id:          number;
  date:        string;
  totalScore:  number;
  cardCount:   number;
  durationSec: number;
  itemsJson:   string;
}

export interface EntryScoreRecord { entryId: number; lastScore: number; examCount: number; }

export const getEntryScores = () =>
  client.get<EntryScoreRecord[]>('/api/entry-scores').then(r => r.data);

export const saveEntryScores = (items: { entryId: number; score: number }[]) =>
  client.post('/api/entry-scores', items);

export const getExamHistory = () =>
  client.get<ExamHistoryRecord[]>('/api/exam/history').then(r => r.data);

export const saveExamHistory = (payload: {
  date: string; totalScore: number; cardCount: number; durationSec: number; itemsJson: string;
}) => client.post('/api/exam/history', payload);

export interface ExamAnswer {
  entryId:    number;
  type:       'english' | 'daily' | 'code';
  prompt:     string;
  input:      string;
  expected:   string;
  codeBlanks: string;  // "val1|||val2|||val3|||val4|||val5"
  codeInputs: string;
}

export interface AnswerFeedback {
  entryId:      number;
  score:        number;
  deduction:    number;
  comment:      string;
  markedAnswer: string;
}

export interface ExamScoreResult {
  totalScore: number;
  feedbacks:  AnswerFeedback[];
}

export const scoreExam = (answers: ExamAnswer[]) =>
  client.post<ExamScoreResult>('/api/exam/score', { answers }).then(r => r.data);
