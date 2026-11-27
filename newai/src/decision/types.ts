export type Source = 'ask' | 'plan' | 'permission' | 'tail' | 'clarify' | 'bridge' | 'rule';
export type CardLevel = 'wait' | 'human';
export type CardStatus = 'pending' | 'paused' | 'resolved' | 'cancelled';
export type ResolvedBy = 'human' | 'auto' | 'preselect' | 'policy';

export const CRITERIA = ['goal', 'reversible', 'scope', 'env', 'rules', 'cost'] as const;
export type Criterion = (typeof CRITERIA)[number];
export type Breakdown = Record<Criterion, number>;
export type Weights = Record<Criterion, number>;
export const CRITERIA_KO: Record<Criterion, string> = {
  goal: '목표 부합', reversible: '되돌리기 쉬움', scope: '범위 준수', env: '환경 적합', rules: '규칙 부합', cost: '비용·시간',
};

export interface OptionIn { label: string; description?: string }

export interface Candidate {
  label: string;
  description?: string;
  /** 0~100 가중 점수 */
  score: number;
  breakdown?: Breakdown;
  reason: string;
  autoSelectable: boolean;
  /** 원래 선택지가 아니라 판단 모델이 제안한 안 */
  proposed?: boolean;
  /** 어댑터가 쓰는 값(예: 권한 카드의 allow/deny) */
  value?: string;
}

export type Answer = { kind: 'choice'; index: number; label: string; value?: string } | { kind: 'text'; text: string };

export interface Card {
  id: string;
  jobId: string | null;
  source: Source;
  header?: string;
  question: string;
  candidates: Candidate[];
  level: CardLevel;
  status: CardStatus;
  preselected: number | null;
  resolvedBy: ResolvedBy | null;
  answer: Answer | null;
  createdAt: number;
  /** wait 카드만 마감이 있다. human 카드는 null */
  deadlineAt: number | null;
  pausedMs: number;
  pausedAt: number | null;
  resolvedAt: number | null;
  /** 판단 모델이 실패해 규칙 점수로 대체했는지 */
  scoredBy: 'model' | 'rule' | 'fixed';
}

export interface ScoreContext {
  project?: string;
  request?: string;
  rules?: string[];
  env?: string;
  language?: string;
  extra?: string;
}

export type FixedCandidate = Omit<Candidate, 'autoSelectable'> & { autoSelectable?: boolean };

export interface DecisionRequest {
  jobId?: string | null;
  source: Source;
  header?: string;
  question: string;
  options: OptionIn[];
  level: CardLevel;
  context?: ScoreContext;
  /** 선택지가 3개 미만이면 판단 모델이 하나를 제안해도 되는지 */
  allowPropose?: boolean;
  /** 점수화를 건너뛰고 이 후보를 그대로 쓴다(권한 카드 등) */
  fixed?: FixedCandidate[];
}

export interface Resolution { card: Card; answer: Answer; resolvedBy: ResolvedBy }
