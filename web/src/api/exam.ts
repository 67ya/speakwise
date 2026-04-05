import client from './client';

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
