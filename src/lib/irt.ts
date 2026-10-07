/**
 * Item Response Theory (IRT) — Rasch Model (1-Parameter Logistic)
 * 
 * Used for standardized ability scoring in computer-based testing (V-SAT).
 * Standardized V-SAT Scale: Mean = 500, Standard Deviation (SD) = 100, Range: 200 - 800.
 */

export interface IRTItemResponse {
  itemId: string;
  /** Score fraction achieved: 1.0 (correct), 0.0 (incorrect), or partial in (0, 1) */
  score: number;
  /** Difficulty parameter b (typically between -3.0 and +3.0; default 0.0) */
  difficultyB: number;
}

export interface IRTResult {
  /** Latent ability estimate theta (in logits, typically -3.5 to +3.5) */
  theta: number;
  /** Standardized scaled score on V-SAT scale (mean 500, SD 100, bounded [200, 800]) */
  abilityScore: number;
  /** Standard Error of Measurement (SEM) */
  sem: number;
  /** Total raw score achieved */
  rawScoreTotal: number;
  /** Maximum possible raw score */
  maxScoreTotal: number;
  /** Reliability indicator based on test information */
  testInformation: number;
}

/**
 * Maps metadata difficulty or level to an initial Rasch b parameter.
 */
export function getQuestionDifficultyB(question: any): number {
  if (typeof question?.metadata?.difficulty_b === 'number') {
    return question.metadata.difficulty_b;
  }

  const level = (question?.metadata?.cognitive_level || question?.metadata?.level || '').toLowerCase();
  if (level === 'nb') return -1.2;
  if (level === 'th') return 0.0;
  if (level === 'vd') return 1.0;
  if (level === 'vdc') return 2.0;

  const diff = (question?.metadata?.difficulty || question?.difficulty || 'medium').toLowerCase();
  switch (diff) {
    case 'easy':
    case 'dễ':
      return -1.2;
    case 'hard':
    case 'khó':
      return 1.1;
    case 'very_hard':
      return 2.2;
    case 'medium':
    case 'trung bình':
    default:
      return 0.0;
  }
}

/**
 * Rasch 1PL item response probability:
 * P(X_i = 1 | theta) = 1 / (1 + exp(-(theta - b_i)))
 */
export function raschProbability(theta: number, b: number): number {
  const diff = theta - b;
  // Guard against exponential overflow/underflow
  if (diff > 30) return 1.0;
  if (diff < -30) return 0.0;
  return 1 / (1 + Math.exp(-diff));
}

/**
 * Estimates examinee ability theta using Maximum A Posteriori (MAP) estimation
 * with standard normal prior theta ~ N(0, 1).
 * 
 * MAP prevents divergence at extreme scores (0% or 100%) and converges rapidly
 * in 3–5 iterations.
 */
export function estimateAbility(responses: IRTItemResponse[]): IRTResult {
  if (responses.length === 0) {
    return {
      theta: 0,
      abilityScore: 500,
      sem: 1.0,
      rawScoreTotal: 0,
      maxScoreTotal: 0,
      testInformation: 0,
    };
  }

  let rawScoreTotal = 0;
  let maxScoreTotal = responses.length;

  responses.forEach(r => {
    rawScoreTotal += Math.max(0, Math.min(1, r.score));
  });

  // Initial estimate based on log-odds of raw score (with Laplace smoothing)
  const smoothedP = (rawScoreTotal + 0.5) / (maxScoreTotal + 1.0);
  let theta = Math.log(smoothedP / (1 - smoothedP));
  theta = Math.max(-3.5, Math.min(3.5, theta));

  const MAX_ITER = 30;
  const CONVERGENCE_EPS = 1e-4;

  for (let iter = 0; iter < MAX_ITER; iter++) {
    let scoreSum = 0;
    let infoSum = 0;

    for (const item of responses) {
      const p = raschProbability(theta, item.difficultyB);
      scoreSum += (item.score - p);
      infoSum += p * (1 - p);
    }

    // Bayesian MAP adjustment: prior theta ~ N(0, 1) adds -theta to derivative and +1 to info
    const firstDeriv = scoreSum - theta;
    const secondDeriv = infoSum + 1.0;

    const delta = firstDeriv / secondDeriv;
    theta += delta;

    // Constrain theta to reasonable boundaries [-4.0, +4.0]
    if (theta > 4.0) theta = 4.0;
    if (theta < -4.0) theta = -4.0;

    if (Math.abs(delta) < CONVERGENCE_EPS) {
      break;
    }
  }

  // Calculate final test information and Standard Error of Measurement (SEM)
  let testInformation = 0;
  for (const item of responses) {
    const p = raschProbability(theta, item.difficultyB);
    testInformation += p * (1 - p);
  }
  const sem = testInformation > 0 ? 1 / Math.sqrt(testInformation + 1.0) : 1.0;

  // Scale theta to V-SAT standard score: Mean = 500, SD = 100
  const abilityScore = convertThetaToVsatScore(theta);

  return {
    theta: Number(theta.toFixed(3)),
    abilityScore,
    sem: Number(sem.toFixed(3)),
    rawScoreTotal: Number(rawScoreTotal.toFixed(2)),
    maxScoreTotal,
    testInformation: Number(testInformation.toFixed(2)),
  };
}

/**
 * Converts latent ability theta to V-SAT standardized score.
 * Formula: round(500 + 100 * theta), clamped between 200 and 800.
 */
export function convertThetaToVsatScore(theta: number): number {
  const scaled = Math.round(500 + 100 * theta);
  return Math.max(200, Math.min(800, scaled));
}

/**
 * High-level helper to compute V-SAT IRT score from exam questions and graded scores.
 */
export function calculateVsatIRTScore(
  questionsWithScores: Array<{ question: any; scoreFraction: number }>
): IRTResult {
  const responses: IRTItemResponse[] = questionsWithScores.map(({ question, scoreFraction }) => ({
    itemId: question.id,
    score: Math.max(0, Math.min(1, scoreFraction)),
    difficultyB: getQuestionDifficultyB(question),
  }));

  return estimateAbility(responses);
}
