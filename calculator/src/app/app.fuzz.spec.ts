import { TestBed } from '@angular/core/testing';
import { App } from './app';

// Deterministic PRNG (mulberry32) so a failing seed can be reproduced exactly
// instead of chasing a flaky Math.random() failure.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ACTIONS = [
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.',
  '+', '-', '*', '/', '%', '=', 'C', 'AC',
] as const;

function applyAction(app: App, action: string): void {
  switch (action) {
    case '+':
    case '-':
    case '*':
    case '/':
      app.handleOperator(action);
      break;
    case '%':
      app.handlePercent();
      break;
    case '=':
      app.handleEqual();
      break;
    case 'C':
      app.clear();
      break;
    case 'AC':
      app.allClear();
      break;
    default:
      app.inputDigit(action);
  }
}

function checkInvariants(app: App, trace: string[]): void {
  const ci = app.currentInput;
  const context = () => `after [${trace.join(' ')}] currentInput=${JSON.stringify(ci)}`;

  expect(typeof ci).withContext(context()).toBe('string');

  // No raw JS artifacts should ever leak into the display state.
  expect(ci).withContext(context()).not.toContain('NaN');
  expect(ci).withContext(context()).not.toContain('undefined');
  expect(ci).withContext(context()).not.toContain('Infinity');

  const isOverflowOrError = ci === 'Error' || ci.startsWith('E');

  if (!isOverflowOrError) {
    // Anything that isn't the deliberate "E..." overflow/Error format must
    // never contain a lowercase scientific-notation "e" - that was exactly
    // the bug where handlePercent() leaked "1e-7" onto the screen.
    expect(ci.toLowerCase().includes('e')).withContext(context()).toBeFalse();
    // The 10-character display budget must hold for every ordinary value,
    // including the sub-precision "smallest displayable unit" fallback.
    expect(ci.length).withContext(context()).toBeLessThanOrEqual(10);
    // Every non-Error value must round-trip through parseOperand as a
    // finite number - never NaN, never +/-Infinity.
    const parsed = app.parseOperand(ci);
    expect(Number.isFinite(parsed)).withContext(context() + ` parsed=${parsed}`).toBeTrue();
  } else if (ci === 'Error') {
    expect(isNaN(app.parseOperand(ci))).withContext(context()).toBeTrue();
  } else {
    // Anything starting with "E" that isn't the exact literal "Error" must
    // be a well-formed overflow value ("E" or "E-", a digit, optional
    // decimals, "e", a sign, and an exponent) - never something like
    // "Error1" left over from a digit pressed on top of a stale Error.
    expect(ci).withContext(context()).toMatch(/^E-?\d(\.\d+)?e[+-]\d+$/);
  }

  // display() and errorMark() must never throw and must return sane types.
  let displayValue: string | undefined;
  expect(() => (displayValue = app.display())).withContext(context()).not.toThrow();
  expect(typeof displayValue).withContext(context()).toBe('string');

  let mark: string | undefined;
  expect(() => (mark = app.errorMark())).withContext(context()).not.toThrow();
  expect(mark === '' || mark === 'E').withContext(context() + ` errorMark=${mark}`).toBeTrue();

  // visibleNumber() must handle whatever currentInput/previousInput hold.
  expect(() => app.visibleNumber(app.currentInput)).withContext(context()).not.toThrow();
  expect(() => app.visibleNumber(app.previousInput)).withContext(context()).not.toThrow();

  // Boolean/nullable flags must never drift into invalid types.
  expect(typeof app.isResultDisplayed).withContext(context()).toBe('boolean');
  expect(typeof app.waitingForSecondOperand).withContext(context()).toBe('boolean');
  expect(app.operator === null || typeof app.operator === 'string').withContext(context()).toBeTrue();
}

describe('App fuzz testing (randomized button sequences)', () => {
  const TRIALS = 500;
  const ACTIONS_PER_TRIAL = 60;

  for (let trial = 0; trial < TRIALS; trial++) {
    it(`survives random sequence #${trial} without crashing or corrupting state`, () => {
      const rand = mulberry32(trial * 7919 + 13);
      const fixture = TestBed.configureTestingModule({ imports: [App] });
      const app = TestBed.createComponent(App).componentInstance;
      const trace: string[] = [];

      for (let step = 0; step < ACTIONS_PER_TRIAL; step++) {
        const action = ACTIONS[Math.floor(rand() * ACTIONS.length)];
        trace.push(action);
        expect(() => applyAction(app, action)).withContext(`step ${step}: ${trace.join(' ')}`).not.toThrow();
        checkInvariants(app, trace);
      }
    });
  }
});

describe('App fuzz testing (targeted numeric sweep through calculate())', () => {
  let app: App;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [App] }).compileComponents();
    app = TestBed.createComponent(App).componentInstance;
  });

  const interestingValues = [
    '0', '1', '-1', '9', '-9', '0.00000001', '-0.00000001',
    '9999999999', '-999999999', '1000000000', '0.1', '0.2', '0.3',
    '3.14159265', '2.71828182', '', '100', '-100', '0.00000005',
  ];
  const operators = ['+', '-', '*', '/'];

  it('never produces a non-finite or malformed result for any combination', () => {
    for (const prev of interestingValues) {
      for (const op of operators) {
        for (const cur of interestingValues) {
          const label = `calculate(${JSON.stringify(prev)}, ${JSON.stringify(op)}, ${JSON.stringify(cur)})`;
          let result = '';
          expect(() => (result = app.calculate(prev, op, cur))).withContext(label).not.toThrow();
          expect(typeof result).withContext(label).toBe('string');

          if (result === 'Error') {
            continue;
          }
          if (result.startsWith('E')) {
            // Overflow format keeps full precision internally; just make
            // sure it round-trips to a finite number.
            expect(Number.isFinite(app.parseOperand(result))).withContext(label + ` -> ${result}`).toBeTrue();
            continue;
          }
          expect(result.length).withContext(label + ` -> ${JSON.stringify(result)}`).toBeLessThanOrEqual(10);
          expect(result.toLowerCase()).withContext(label + ` -> ${result}`).not.toContain('e');
          expect(Number.isFinite(app.parseOperand(result))).withContext(label + ` -> ${result}`).toBeTrue();
        }
      }
    }
  });
});
