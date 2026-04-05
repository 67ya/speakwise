import client from './client';

export interface ExamHistoryRecord {
  id:          number;
  date:        string;
  totalScore:  number;
  cardCount:   number;
  durationSec: number;
  itemsJson:   string;
}

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
  entryId:   number;
  score:     number;
  deduction: number;
  comment:   string;
}

export interface ExamScoreResult {
  totalScore: number;
  feedbacks:  AnswerFeedback[];
}

export const scoreExam = (answers: ExamAnswer[]) =>
  client.post<ExamScoreResult>('/api/exam/score', { answers }).then(r => r.data);
