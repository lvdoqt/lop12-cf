import type { Question, Answer } from '../types';
import { mulberry32 } from './random';

export type DynamicExamQuestion = Question & { answers: Answer[] };

export interface DynamicRenderResult {
  variables: Record<string, number | string>;
  content: string;
  options: string[];
  answer: string | null;
  explanation: string | null;
  hasDuplicateOptions: boolean;
  attemptsUsed: number;
}

interface VarSpec {
  name: string;
  kind: 'range' | 'choice';
  min: number;
  max: number;
  excludes: Array<{ type: 'number'; value: number } | { type: 'var'; name: string }>;
  choices?: Array<number | string>;
}

const DEFAULT_MIN = -10;
const DEFAULT_MAX = 10;

// ---------------------------------------------------------------------------
// 1. Safe Recursive-Descent Math & Comparison Evaluator (CSP / CF Workers safe)
// ---------------------------------------------------------------------------

type TokenType =
  | 'num'
  | 'ident'
  | 'op'
  | 'lparen'
  | 'rparen'
  | 'comma'
  | 'eof';

interface ExprToken {
  type: TokenType;
  value: string;
}

function tokenizeExpr(input: string): ExprToken[] {
  const tokens: ExprToken[] = [];
  let i = 0;
  const n = input.length;

  while (i < n) {
    const ch = input[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Numbers (integer or decimal)
    if (/[0-9]/.test(ch) || (ch === '.' && i + 1 < n && /[0-9]/.test(input[i + 1]))) {
      let start = i;
      while (i < n && /[0-9.]/.test(input[i])) i++;
      tokens.push({ type: 'num', value: input.slice(start, i) });
      continue;
    }

    // Identifiers (math functions / constants / logical words)
    if (/[a-zA-Z_]/.test(ch)) {
      let start = i;
      while (i < n && /[a-zA-Z0-9_]/.test(input[i])) i++;
      tokens.push({ type: 'ident', value: input.slice(start, i) });
      continue;
    }

    // Two-char operators
    const two = input.slice(i, i + 2);
    if (['**', '>=', '<=', '!=', '<>', '==', '&&', '||'].includes(two)) {
      tokens.push({ type: 'op', value: two });
      i += 2;
      continue;
    }

    // Single-char operators
    if ('+-*/%^><='.includes(ch)) {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }

    if (ch === '(') {
      tokens.push({ type: 'lparen', value: '(' });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen', value: ')' });
      i++;
      continue;
    }
    if (ch === ',') {
      tokens.push({ type: 'comma', value: ',' });
      i++;
      continue;
    }

    // Skip unknown characters safely
    i++;
  }

  tokens.push({ type: 'eof', value: '' });
  return tokens;
}

function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

function lcm(a: number, b: number): number {
  const g = gcd(a, b);
  return g === 0 ? 0 : Math.abs(Math.round(a) * Math.round(b)) / g;
}

class ExprParser {
  private tokens: ExprToken[];
  private pos = 0;

  constructor(input: string) {
    this.tokens = tokenizeExpr(input);
  }

  private peek(): ExprToken {
    return this.tokens[this.pos] || { type: 'eof', value: '' };
  }

  private next(): ExprToken {
    return this.tokens[this.pos++] || { type: 'eof', value: '' };
  }

  parseExpression(): number {
    return this.parseOr();
  }

  private parseOr(): number {
    let left = this.parseAnd();
    while (
      (this.peek().type === 'op' && this.peek().value === '||') ||
      (this.peek().type === 'ident' && this.peek().value.toLowerCase() === 'or')
    ) {
      this.next();
      const right = this.parseAnd();
      left = left !== 0 || right !== 0 ? 1 : 0;
    }
    return left;
  }

  private parseAnd(): number {
    let left = this.parseComparison();
    while (
      (this.peek().type === 'op' && this.peek().value === '&&') ||
      (this.peek().type === 'ident' && this.peek().value.toLowerCase() === 'and')
    ) {
      this.next();
      const right = this.parseComparison();
      left = left !== 0 && right !== 0 ? 1 : 0;
    }
    return left;
  }

  private parseComparison(): number {
    let left = this.parseAddSub();
    const cmpOps = ['>', '<', '>=', '<=', '==', '=', '!=', '<>'];
    while (this.peek().type === 'op' && cmpOps.includes(this.peek().value)) {
      const op = this.next().value;
      const right = this.parseAddSub();
      let res = false;
      switch (op) {
        case '>':
          res = left > right;
          break;
        case '<':
          res = left < right;
          break;
        case '>=':
          res = left >= right;
          break;
        case '<=':
          res = left <= right;
          break;
        case '==':
        case '=':
          res = Math.abs(left - right) < 1e-9;
          break;
        case '!=':
        case '<>':
          res = Math.abs(left - right) >= 1e-9;
          break;
      }
      left = res ? 1 : 0;
    }
    return left;
  }

  private parseAddSub(): number {
    let left = this.parseMulDiv();
    while (this.peek().type === 'op' && (this.peek().value === '+' || this.peek().value === '-')) {
      const op = this.next().value;
      const right = this.parseMulDiv();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  private parseMulDiv(): number {
    let left = this.parseUnary();
    while (
      this.peek().type === 'op' &&
      (this.peek().value === '*' || this.peek().value === '/' || this.peek().value === '%')
    ) {
      const op = this.next().value;
      const right = this.parseUnary();
      if (op === '*') left = left * right;
      else if (op === '/') left = right === 0 ? NaN : left / right;
      else left = right === 0 ? NaN : left % right;
    }
    return left;
  }

  private parseUnary(): number {
    if (this.peek().type === 'op' && (this.peek().value === '+' || this.peek().value === '-')) {
      const op = this.next().value;
      const val = this.parseUnary();
      return op === '-' ? -val : val;
    }
    return this.parsePower();
  }

  private parsePower(): number {
    let base = this.parsePrimary();
    if (this.peek().type === 'op' && (this.peek().value === '^' || this.peek().value === '**')) {
      this.next();
      const exp = this.parseUnary();
      base = Math.pow(base, exp);
    }
    return base;
  }

  private parsePrimary(): number {
    const tok = this.peek();

    if (tok.type === 'num') {
      this.next();
      return Number(tok.value);
    }

    if (tok.type === 'lparen') {
      this.next();
      const val = this.parseExpression();
      if (this.peek().type === 'rparen') this.next();
      return val;
    }

    if (tok.type === 'ident') {
      const name = this.next().value.toLowerCase();
      if (name === 'pi') return Math.PI;
      if (name === 'e') return Math.E;

      if (this.peek().type === 'lparen') {
        this.next();
        const args: number[] = [];
        if (this.peek().type !== 'rparen') {
          args.push(this.parseExpression());
          while (this.peek().type === 'comma') {
            this.next();
            args.push(this.parseExpression());
          }
        }
        if (this.peek().type === 'rparen') this.next();
        return this.evalFunc(name, args);
      }
      return NaN;
    }

    return NaN;
  }

  private evalFunc(name: string, args: number[]): number {
    const a = args[0] ?? NaN;
    const b = args[1] ?? NaN;
    switch (name) {
      case 'abs': return Math.abs(a);
      case 'sqrt': return Math.sqrt(a);
      case 'pow': return Math.pow(a, b);
      case 'round': return args.length >= 2 ? Number(a.toFixed(Math.max(0, Math.round(b)))) : Math.round(a);
      case 'floor': return Math.floor(a);
      case 'ceil': return Math.ceil(a);
      case 'min': return Math.min(...args);
      case 'max': return Math.max(...args);
      case 'sin': return Math.sin(a);
      case 'cos': return Math.cos(a);
      case 'tan': return Math.tan(a);
      case 'log': return Math.log10(a);
      case 'ln': return Math.log(a);
      case 'gcd':
      case 'ucln': return gcd(a, b);
      case 'lcm':
      case 'bcnn': return lcm(a, b);
      default: return NaN;
    }
  }
}

export function evaluateMathExpression(expr: string): number {
  const cleaned = expr.trim();
  if (!cleaned) return NaN;
  const parser = new ExprParser(cleaned);
  return parser.parseExpression();
}

export function formatComputedNumber(num: number): string {
  if (!Number.isFinite(num)) return 'NaN';
  const roundedInt = Math.round(num);
  if (Math.abs(num - roundedInt) < 1e-9) {
    return String(roundedInt === 0 ? 0 : roundedInt);
  }
  // Round to 4 decimal places and strip trailing zeros
  const fixed = Number(num.toFixed(4));
  return String(fixed);
}

// ---------------------------------------------------------------------------
// 2. Variable Token Scanner & Generator
// ---------------------------------------------------------------------------

/**
 * Matches variable tokens in templates:
 * - !a!                    -> integer in [-10, 10]
 * - !a:1:23!               -> integer in [1, 23]
 * - !a#0!                  -> integer in [-10, 10], != 0
 * - !a:1:10#5!             -> integer in [1, 10], != 5
 * - !b#!a!!                -> integer in [-10, 10], != value of a
 * - !b:1:10#!a!!           -> integer in [1, 10], != value of a
 * - !b(2,4,6)!             -> random choice from [2, 4, 6]
 */
const VAR_TOKEN_REGEX = /!([a-zA-Z][a-zA-Z0-9_]*)(?:(\([^)]+\))|(?::(-?\d+):(-?\d+))?(?:#((?:![a-zA-Z][a-zA-Z0-9_]*!|-?\d+)(?:,(?:![a-zA-Z][a-zA-Z0-9_]*!|-?\d+))*))?)?!/g;

function parseExcludes(raw?: string): VarSpec['excludes'] {
  if (!raw) return [];
  return raw.split(',').map(part => {
    const trimmed = part.trim();
    const varMatch = /^!([a-zA-Z][a-zA-Z0-9_]*)!$/.exec(trimmed);
    if (varMatch) {
      return { type: 'var' as const, name: varMatch[1] };
    }
    return { type: 'number' as const, value: Number(trimmed) };
  });
}

function collectVarSpecs(texts: string[]): { specs: Map<string, VarSpec>; order: string[] } {
  const specs = new Map<string, VarSpec>();
  const order: string[] = [];

  const ensureVar = (name: string) => {
    if (!specs.has(name)) {
      specs.set(name, {
        name,
        kind: 'range',
        min: DEFAULT_MIN,
        max: DEFAULT_MAX,
        excludes: [],
      });
      order.push(name);
    }
  };

  for (const text of texts) {
    if (!text) continue;
    VAR_TOKEN_REGEX.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = VAR_TOKEN_REGEX.exec(text)) !== null) {
      const name = m[1];
      const choiceGroup = m[2]; // e.g. "(2,4,6)"
      const minStr = m[3];
      const maxStr = m[4];
      const excludeStr = m[5];

      ensureVar(name);
      const spec = specs.get(name)!;

      if (choiceGroup) {
        const inner = choiceGroup.slice(1, -1);
        const items = inner
          .split(',')
          .map(s => s.trim())
          .filter(s => s.length > 0)
          .map(s => {
            const num = Number(s);
            return !Number.isNaN(num) && s !== '' ? num : s;
          });
        if (items.length > 0) {
          spec.kind = 'choice';
          spec.choices = items;
        }
      } else {
        if (minStr !== undefined && maxStr !== undefined) {
          const minVal = parseInt(minStr, 10);
          const maxVal = parseInt(maxStr, 10);
          spec.min = Math.min(minVal, maxVal);
          spec.max = Math.max(minVal, maxVal);
        }
        if (excludeStr) {
          const excls = parseExcludes(excludeStr);
          for (const ex of excls) {
            if (ex.type === 'var') {
              ensureVar(ex.name);
            }
            spec.excludes.push(ex);
          }
        }
      }
    }
  }

  // Topological sort so dependencies (e.g. b depends on a in !b#!a!!) are resolved first
  const visited = new Set<string>();
  const sorted: string[] = [];
  const visit = (name: string, stack: Set<string>) => {
    if (visited.has(name) || stack.has(name)) return;
    stack.add(name);
    const spec = specs.get(name);
    if (spec) {
      for (const ex of spec.excludes) {
        if (ex.type === 'var' && ex.name !== name) {
          visit(ex.name, stack);
        }
      }
    }
    stack.delete(name);
    visited.add(name);
    sorted.push(name);
  };
  for (const name of order) {
    visit(name, new Set());
  }

  return { specs, order: sorted };
}

function generateVariables(
  specs: Map<string, VarSpec>,
  order: string[],
  prng: () => number,
): Record<string, number | string> {
  const vars: Record<string, number | string> = {};

  for (const name of order) {
    const spec = specs.get(name)!;
    if (spec.kind === 'choice' && spec.choices && spec.choices.length > 0) {
      const idx = Math.floor(prng() * spec.choices.length);
      vars[name] = spec.choices[idx];
      continue;
    }

    const excludedValues = new Set<number>();
    for (const ex of spec.excludes) {
      if (ex.type === 'number' && Number.isFinite(ex.value)) {
        excludedValues.add(ex.value);
      } else if (ex.type === 'var') {
        const depVal = vars[ex.name];
        if (typeof depVal === 'number') excludedValues.add(depVal);
      }
    }

    const min = spec.min;
    const max = spec.max;
    const span = max - min + 1;

    // If range is reasonable, build candidate list to guarantee uniform distribution
    if (span <= 2000) {
      const candidates: number[] = [];
      for (let v = min; v <= max; v++) {
        if (!excludedValues.has(v)) candidates.push(v);
      }
      if (candidates.length > 0) {
        const idx = Math.floor(prng() * candidates.length);
        vars[name] = candidates[idx];
      } else {
        vars[name] = min;
      }
    } else {
      // Rejection sampling for very large ranges
      let chosen = min;
      for (let tries = 0; tries < 50; tries++) {
        const cand = min + Math.floor(prng() * span);
        if (!excludedValues.has(cand)) {
          chosen = cand;
          break;
        }
      }
      vars[name] = chosen;
    }
  }

  return vars;
}

// ---------------------------------------------------------------------------
// 3. Template Substitution: !var!, {tinh: ...}, iff(cond, t, f), LaTeX sign cleanup
// ---------------------------------------------------------------------------

function substituteVariables(text: string, vars: Record<string, number | string>): string {
  if (!text) return text;
  VAR_TOKEN_REGEX.lastIndex = 0;
  return text.replace(VAR_TOKEN_REGEX, (_match, name: string) => {
    return name in vars ? String(vars[name]) : _match;
  });
}

/**
 * Evaluates all `{tinh: expr}` blocks (supports nested braces/parens).
 */
function evaluateTinhBlocks(text: string): string {
  if (!text || !text.toLowerCase().includes('{tinh:')) return text;

  let result = text;
  let guard = 0;
  while (guard++ < 50) {
    const idx = result.toLowerCase().indexOf('{tinh:');
    if (idx === -1) break;

    let depth = 0;
    let endIdx = -1;
    for (let i = idx; i < result.length; i++) {
      if (result[i] === '{') depth++;
      else if (result[i] === '}') {
        depth--;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
    }
    if (endIdx === -1) break;

    const innerExpr = result.slice(idx + 6, endIdx);
    const val = evaluateMathExpression(innerExpr);
    const formatted = formatComputedNumber(val);
    result = result.slice(0, idx) + formatted + result.slice(endIdx + 1);
  }
  return result;
}

/**
 * Evaluates all `iff(condition, trueBranch, falseBranch)` calls.
 * Properly handles nested parentheses in arguments.
 */
function evaluateIffBlocks(text: string): string {
  if (!text || !/iff\s*\(/i.test(text)) return text;

  let result = text;
  let guard = 0;
  while (guard++ < 50) {
    const match = /iff\s*\(/i.exec(result);
    if (!match) break;

    const startIdx = match.index;
    const openParenIdx = startIdx + match[0].length - 1;

    let depth = 0;
    let endIdx = -1;
    const commas: number[] = [];

    for (let i = openParenIdx; i < result.length; i++) {
      const ch = result[i];
      if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      } else if (ch === ',' && depth === 1) {
        commas.push(i);
      }
    }

    if (endIdx === -1 || commas.length < 2) break;

    const condStr = result.slice(openParenIdx + 1, commas[0]).trim();
    const trueStr = result.slice(commas[0] + 1, commas[1]).trim();
    const falseStr = result.slice(commas[1] + 1, endIdx).trim();

    const condVal = evaluateMathExpression(condStr);
    const chosen = condVal !== 0 && !Number.isNaN(condVal) ? trueStr : falseStr;

    result = result.slice(0, startIdx) + chosen + result.slice(endIdx + 1);
  }

  return result;
}

/**
 * Cleans up double signs produced by negative variable substitution inside $...$ math blocks,
 * e.g. `$2x^2+-3x--2=0$` -> `$2x^2-3x+2=0$`.
 */
function cleanLatexSigns(text: string): string {
  if (!text || !text.includes('$')) return text;
  return text.replace(/(\$\$[\s\S]*?\$\$|\$[^$]+\$)/g, (mathBlock) => {
    return mathBlock
      .replace(/\+\s*-/g, '-')
      .replace(/-\s*-/g, '+')
      .replace(/\+\s*\+/g, '+');
  });
}

export function renderDynamicText(
  text: string,
  vars: Record<string, number | string>,
): string {
  if (!text) return text;
  let out = substituteVariables(text, vars);
  // Run tinh and iff in a short loop so nested combinations (e.g. iff inside tinh or tinh inside iff) resolve cleanly
  for (let pass = 0; pass < 3; pass++) {
    const prev = out;
    out = evaluateTinhBlocks(out);
    out = evaluateIffBlocks(out);
    if (out === prev) break;
  }
  out = cleanLatexSigns(out);
  return out;
}

// ---------------------------------------------------------------------------
// 4. Question Instantiation (with MCQ distinct-options guarantee)
// ---------------------------------------------------------------------------

export function isDynamicQuestion(q: { metadata?: any; is_dynamic?: boolean }): boolean {
  return Boolean(q?.metadata?.is_dynamic || q?.is_dynamic);
}

/**
 * Generates concrete values for a dynamic question template.
 * For MCQ / single_choice questions, retries up to `maxAttempts` times to ensure
 * all rendered options are distinct and contain no NaN/Infinity errors.
 */
export function instantiateDynamicTemplate(
  template: {
    type?: string;
    content: string;
    options: string[];
    answer: string | null;
    explanation: string | null;
  },
  prng: () => number,
  maxAttempts = 50,
): DynamicRenderResult {
  const allTexts = [
    template.content,
    ...template.options,
    template.answer || '',
    template.explanation || '',
  ];
  const { specs, order } = collectVarSpecs(allTexts);

  const isMcq =
    !template.type ||
    template.type === 'mcq' ||
    template.type === 'single_choice' ||
    template.type === 'multiple_choice';

  // If no variables are present in the template, still evaluate {tinh:} / iff() once
  const attemptsLimit = order.length === 0 ? 1 : maxAttempts;

  let bestResult: DynamicRenderResult | null = null;

  for (let attempt = 1; attempt <= attemptsLimit; attempt++) {
    const vars = generateVariables(specs, order, prng);
    const content = renderDynamicText(template.content, vars);
    const options = template.options.map(opt => renderDynamicText(opt, vars));
    const answer = template.answer !== null ? renderDynamicText(template.answer, vars) : null;
    const explanation = template.explanation !== null ? renderDynamicText(template.explanation, vars) : null;

    const hasNaN =
      content.includes('NaN') ||
      options.some(o => o.includes('NaN')) ||
      (answer !== null && answer.includes('NaN'));

    let hasDuplicateOptions = false;
    if (isMcq && options.length > 1) {
      const normalized = options.map(o => o.trim().replace(/\s+/g, ' '));
      const unique = new Set(normalized);
      hasDuplicateOptions = unique.size < normalized.length;
    }

    const res: DynamicRenderResult = {
      variables: vars,
      content,
      options,
      answer,
      explanation,
      hasDuplicateOptions,
      attemptsUsed: attempt,
    };

    bestResult = res;

    if (!hasNaN && !hasDuplicateOptions) {
      return res;
    }
  }

  return bestResult!;
}

/**
 * Instantiates a full ExamQuestion if `metadata.is_dynamic === true`.
 * Uses a dedicated child PRNG seeded from the parent `prng` so retry counts
 * never perturb downstream shuffling of other questions.
 */
export function instantiateDynamicQuestion<T extends DynamicExamQuestion>(
  q: T,
  parentPrng: () => number,
): T {
  if (!isDynamicQuestion(q)) return q;

  // Derive an isolated PRNG for this question
  const childSeed = Math.floor(parentPrng() * 0x7fffffff);
  const childPrng = mulberry32(childSeed);

  const rawOptions = (q.answers || []).map(a => a.content);
  const rendered = instantiateDynamicTemplate(
    {
      type: q.type,
      content: q.content || '',
      options: rawOptions,
      answer: q.answer ?? null,
      explanation: q.explanation ?? q.metadata?.explanation ?? null,
    },
    childPrng,
  );

  const updatedAnswers: Answer[] = (q.answers || []).map((a, idx) => ({
    ...a,
    content: rendered.options[idx] ?? a.content,
  }));

  const updatedMetadata = q.metadata
    ? {
        ...q.metadata,
        explanation: rendered.explanation ?? q.metadata.explanation,
        _dynamic_vars: rendered.variables,
      }
    : q.metadata;

  return {
    ...q,
    content: rendered.content,
    options: Array.isArray(q.options) ? rendered.options : q.options,
    answers: updatedAnswers,
    answer: rendered.answer,
    explanation: rendered.explanation,
    metadata: updatedMetadata,
  };
}
