import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  let app: App;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();

    const fixture = TestBed.createComponent(App);
    app = fixture.componentInstance;
  });

  it('should create the app', () => {
    expect(app).toBeTruthy();
  });

  describe('basic arithmetic', () => {
    it('adds two numbers', () => {
      app.inputDigit('5');
      app.handleOperator('+');
      app.inputDigit('3');
      app.handleEqual();
      expect(app.currentInput).toBe('8');
    });

    it('subtracts two numbers', () => {
      app.inputDigit('9');
      app.handleOperator('-');
      app.inputDigit('4');
      app.handleEqual();
      expect(app.currentInput).toBe('5');
    });

    it('multiplies two numbers', () => {
      app.inputDigit('6');
      app.handleOperator('*');
      app.inputDigit('7');
      app.handleEqual();
      expect(app.currentInput).toBe('42');
    });

    it('divides two numbers', () => {
      app.inputDigit('8');
      app.handleOperator('/');
      app.inputDigit('2');
      app.handleEqual();
      expect(app.currentInput).toBe('4');
    });

    it('handles decimals without floating point noise', () => {
      app.inputDigit('0');
      app.inputDigit('.');
      app.inputDigit('1');
      app.handleOperator('+');
      app.inputDigit('0');
      app.inputDigit('.');
      app.inputDigit('2');
      app.handleEqual();
      // 0.1 + 0.2 === 0.30000000000000004 in raw JS floating point
      expect(app.currentInput).toBe('0.3');
    });
  });

  describe('division by zero', () => {
    it('shows Error for X / 0', () => {
      app.inputDigit('5');
      app.handleOperator('/');
      app.inputDigit('0');
      app.handleEqual();
      expect(app.currentInput).toBe('Error');
    });

    it('recovers cleanly after an Error by typing a new digit', () => {
      app.inputDigit('5');
      app.handleOperator('/');
      app.inputDigit('0');
      app.handleEqual();
      app.inputDigit('7');
      expect(app.currentInput).toBe('7');
      expect(app.operator).toBeNull();
    });
  });

  describe('chained operators', () => {
    it('computes the running total when pressing another operator', () => {
      app.inputDigit('5');
      app.handleOperator('+');
      app.inputDigit('3');
      app.handleOperator('+');
      // 5 + 3 = 8 should already be reflected
      expect(app.currentInput).toBe('8');
      app.inputDigit('2');
      app.handleEqual();
      expect(app.currentInput).toBe('10');
    });

    it('swaps the pending operator without recalculating when pressed twice in a row', () => {
      app.inputDigit('5');
      app.handleOperator('+');
      app.handleOperator('-');
      app.inputDigit('3');
      app.handleEqual();
      expect(app.currentInput).toBe('2');
    });
  });

  describe('repeat equals', () => {
    it('repeats the last operation on subsequent equals presses', () => {
      app.inputDigit('5');
      app.handleOperator('+');
      app.inputDigit('3');
      app.handleEqual();
      expect(app.currentInput).toBe('8');
      app.handleEqual();
      expect(app.currentInput).toBe('11');
      app.handleEqual();
      expect(app.currentInput).toBe('14');
    });

    it('stops repeating once the result overflows into Error', () => {
      app.inputDigit('9');
      app.handleOperator('/');
      app.inputDigit('0');
      app.handleEqual();
      expect(app.currentInput).toBe('Error');
      app.inputDigit('3');
      app.handleOperator('+');
      app.inputDigit('4');
      app.handleEqual();
      expect(app.currentInput).toBe('7');
      // lastOperator/lastOperand should now be from the +4, not the /0
      app.handleEqual();
      expect(app.currentInput).toBe('11');
    });
  });

  describe('percent', () => {
    it('divides the current value by 100', () => {
      app.inputDigit('5');
      app.inputDigit('0');
      app.handlePercent();
      expect(app.currentInput).toBe('0.5');
    });

    it('does not leak raw JS scientific notation for very small results', () => {
      app.inputDigit('0');
      app.inputDigit('.');
      app.inputDigit('0');
      app.inputDigit('0');
      app.inputDigit('0');
      app.inputDigit('0');
      app.inputDigit('1');
      app.handlePercent();
      // 0.00001 / 100 = 0.0000001 -- Number.prototype.toString() would render
      // this as "1e-7", which the rest of the app cannot parse/display.
      expect(app.currentInput).not.toContain('e');
      expect(app.currentInput).toBe('0.0000001');
    });

    it('computes an add-on percentage of the first operand after +', () => {
      // General calculator convention: 200 + 10% means 200 + (200 * 10%) = 220,
      // not 200 + 0.1.
      app.inputDigit('2');
      app.inputDigit('0');
      app.inputDigit('0');
      app.handleOperator('+');
      app.inputDigit('1');
      app.inputDigit('0');
      app.handlePercent();
      expect(app.currentInput).toBe('20');
      app.handleEqual();
      expect(app.currentInput).toBe('220');
    });

    it('computes an add-on percentage of the first operand after -', () => {
      app.inputDigit('2');
      app.inputDigit('0');
      app.inputDigit('0');
      app.handleOperator('-');
      app.inputDigit('1');
      app.inputDigit('0');
      app.handlePercent();
      app.handleEqual();
      expect(app.currentInput).toBe('180');
    });

    it('treats percent as a plain fraction (not add-on) after * or /', () => {
      app.inputDigit('2');
      app.inputDigit('0');
      app.inputDigit('0');
      app.handleOperator('*');
      app.inputDigit('1');
      app.inputDigit('0');
      app.handlePercent();
      expect(app.currentInput).toBe('0.1');
      app.handleEqual();
      expect(app.currentInput).toBe('20');
    });

    it('is a no-op while waiting for the second operand', () => {
      app.inputDigit('5');
      app.handleOperator('+');
      app.handlePercent();
      expect(app.currentInput).toBe('5');
    });
  });

  describe('digit input limits', () => {
    it('does not append a leading zero ("0" + "0" stays "0", not "00")', () => {
      app.inputDigit('0');
      app.inputDigit('0');
      expect(app.currentInput).toBe('0');
    });

    it('replaces a lone leading zero with the next digit ("0" + "5" -> "5")', () => {
      app.inputDigit('0');
      app.inputDigit('5');
      expect(app.currentInput).toBe('5');
    });

    it('still allows "0." for decimal entry from a lone zero', () => {
      app.inputDigit('0');
      app.inputDigit('.');
      expect(app.currentInput).toBe('0.');
    });

    it('overwrites a stray "Error" left with no pending operator or result flag, instead of appending', () => {
      // Reproduces a lingering Error that survives with both
      // waitingForSecondOperand and isResultDisplayed false: an operator
      // chain computes an Error mid-chain. handleOperator() now resets
      // operator/waitingForSecondOperand as soon as that happens (see the
      // "does not permanently poison previousInput" test below), so this
      // stray state is reached immediately, with no extra C press needed.
      app.inputDigit('5');
      app.handleOperator('/');
      app.inputDigit('0');
      app.handleOperator('/'); // 5/0 -> 'Error'
      expect(app.currentInput).toBe('Error');
      expect(app.operator).toBeNull();
      expect(app.waitingForSecondOperand).toBeFalse();
      expect(app.isResultDisplayed).toBeFalse();

      app.inputDigit('1');
      expect(app.currentInput).toBe('1');
      expect(app.currentInput).not.toBe('Error1');
    });

    it('pressing "." right after an Error gives "0.", not a bare "."', () => {
      app.inputDigit('5');
      app.handleOperator('/');
      app.inputDigit('0');
      app.handleEqual();
      expect(app.currentInput).toBe('Error');

      app.inputDigit('.');
      expect(app.currentInput).toBe('0.');
      // the stale repeat-calculation state from the division by zero must
      // not survive to corrupt a later equals press
      expect(app.lastOperator).toBeNull();
      expect(app.lastOperand).toBeNull();

      app.inputDigit('7');
      expect(app.currentInput).toBe('0.7');
      app.handleEqual();
      expect(app.currentInput).toBe('0.7');
    });

    it('ignores a second decimal point', () => {
      app.inputDigit('1');
      app.inputDigit('.');
      app.inputDigit('2');
      app.inputDigit('.');
      app.inputDigit('3');
      expect(app.currentInput).toBe('1.23');
    });

    it('caps the integer length at 10 characters', () => {
      for (const d of '12345678901234') {
        app.inputDigit(d);
      }
      expect(app.currentInput.length).toBeLessThanOrEqual(10);
    });

    it('caps decimal digits at 8 places', () => {
      app.inputDigit('1');
      app.inputDigit('.');
      for (const d of '123456789') {
        app.inputDigit(d);
      }
      expect(app.currentInput).toBe('1.12345678');
    });
  });

  describe('overflow formatting', () => {
    it('renders very large results with an E marker instead of raw exponential text', () => {
      // 999999 * 999999 = 999998000001, which is >= 1e10 and must overflow.
      for (const d of '999999') {
        app.inputDigit(d);
      }
      app.handleOperator('*');
      for (const d of '999999') {
        app.inputDigit(d);
      }
      app.handleEqual();
      expect(app.currentInput.startsWith('E')).toBeTrue();
      expect(app.errorMark()).toBe('E');
    });

    it('round-trips an overflowed value back through parseOperand within display precision', () => {
      const big = 12345678901;
      const formatted = app.formatOverflow(big);
      // Only ~10 significant digits survive the fixed-width display, so allow
      // for that rounding instead of expecting bit-for-bit equality.
      expect(app.parseOperand(formatted)).toBeCloseTo(big, -1);
    });

    it('round-trips a negative overflowed value back through parseOperand within display precision', () => {
      const big = -12345678901;
      const formatted = app.formatOverflow(big);
      expect(app.parseOperand(formatted)).toBeCloseTo(big, -1);
    });

    it('displays only the significant digits for an overflowed value (by spec)', () => {
      // The display intentionally shows just the leading significant
      // digits, dropping the exponent, once a result overflows past the
      // required 10億 range - this is an accepted, unfixed limitation
      // rather than a bug.
      expect(app.visibleNumber(app.formatOverflow(1e10))).toBe('1000000000');
    });

    it('shows a negative overflowed value with a leading sign', () => {
      // Negative overflow uses one fewer significant digit than positive
      // (9 instead of 10) to make room for the minus sign.
      expect(app.visibleNumber(app.formatOverflow(-1e10))).toBe('-100000000');
    });
  });

  describe('clear / all clear', () => {
    it('backspaces one digit at a time', () => {
      app.inputDigit('1');
      app.inputDigit('2');
      app.inputDigit('3');
      app.clear();
      expect(app.currentInput).toBe('12');
    });

    it('cancels a pending operator without touching the number', () => {
      app.inputDigit('2');
      app.inputDigit('5');
      app.handleOperator('*');
      app.clear();
      expect(app.operator).toBeNull();
      expect(app.currentInput).toBe('25');
    });

    it('allClear resets every piece of state', () => {
      app.inputDigit('5');
      app.handleOperator('+');
      app.inputDigit('3');
      app.handleEqual();
      app.allClear();
      expect(app.currentInput).toBe('');
      expect(app.operator).toBeNull();
      expect(app.previousInput).toBe('');
      expect(app.isResultDisplayed).toBeFalse();
      expect(app.waitingForSecondOperand).toBeFalse();
      expect(app.lastOperator).toBeNull();
      expect(app.lastOperand).toBeNull();
    });
  });

  describe('negative numbers', () => {
    it('produces a negative result from subtraction', () => {
      app.inputDigit('3');
      app.handleOperator('-');
      app.inputDigit('5');
      app.handleEqual();
      expect(app.currentInput).toBe('-2');
    });

    it('clears a single-digit negative result to empty in one C press', () => {
      app.inputDigit('3');
      app.handleOperator('-');
      app.inputDigit('5');
      app.handleEqual();
      expect(app.currentInput).toBe('-2');
      app.clear();
      expect(app.currentInput).toBe('');
    });

    it('backspaces a multi-digit negative number one digit at a time', () => {
      app.inputDigit('3');
      app.handleOperator('-');
      app.inputDigit('5');
      app.inputDigit('0');
      app.handleEqual();
      expect(app.currentInput).toBe('-47');
      app.allClear();
      // re-derive a multi-digit negative currentInput by typing it back in
      // (there is no +/- key, so drive it through clear()'s digit path)
      app.inputDigit('4');
      app.inputDigit('7');
      // simulate having a negative number in currentInput directly, as the
      // component itself only ever produces one via calculate()
      (app as any).currentInput = '-47';
      app.clear();
      expect(app.currentInput).toBe('-4');
    });

    it('continuing to type digits after a negative result appends correctly', () => {
      app.inputDigit('3');
      app.handleOperator('-');
      app.inputDigit('5');
      app.handleEqual();
      expect(app.currentInput).toBe('-2');
      expect(app.isResultDisplayed).toBeTrue();
      app.inputDigit('9');
      // isResultDisplayed should make this overwrite, not append to "-2"
      expect(app.currentInput).toBe('9');
    });
  });

  describe('operator pressed right after an Error', () => {
    it('ignores the operator key while Error is displayed, like a real calculator', () => {
      app.inputDigit('5');
      app.handleOperator('/');
      app.inputDigit('0');
      app.handleEqual();
      expect(app.currentInput).toBe('Error');
      app.handleOperator('+');
      expect(app.operator).toBeNull();
      expect(app.currentInput).toBe('Error');
    });

    it('still lets a fresh digit start a new calculation after an Error', () => {
      app.inputDigit('5');
      app.handleOperator('/');
      app.inputDigit('0');
      app.handleEqual();
      expect(app.currentInput).toBe('Error');
      app.inputDigit('3');
      expect(app.currentInput).toBe('3');
      app.handleOperator('+');
      app.inputDigit('4');
      app.handleEqual();
      expect(app.currentInput).toBe('7');
    });

    it('still allows continuing a calculation from an overflowed E-value (unlike a real Error)', () => {
      // Overflow keeps full precision internally (see formatOverflow's
      // comment), so a real calculator lets you keep computing with it -
      // only a genuine Error (divide by zero, etc.) should require C/AC.
      for (const d of '999999') {
        app.inputDigit(d);
      }
      app.handleOperator('*');
      for (const d of '999999') {
        app.inputDigit(d);
      }
      app.handleEqual();
      expect(app.currentInput.startsWith('E')).toBeTrue();
      app.handleOperator('-');
      expect(app.operator).toBe('-');
      app.inputDigit('1');
      app.handleEqual();
      // 999999 * 999999 - 1 = 999998000000
      expect(app.currentInput.startsWith('E')).toBeTrue();
    });

    it('does not permanently poison previousInput when an operator chain itself produces an Error', () => {
      // "5 / 0 +" computes the Error *during* the '+' press (currentInput
      // was still '0' when handleOperator started, so the top-of-function
      // guard can't catch it). Continuing to queue '+' as a pending
      // operator on top of previousInput='Error' would mean every future
      // calculation involving this operand is silently wrong forever.
      app.inputDigit('5');
      app.handleOperator('/');
      app.inputDigit('0');
      app.handleOperator('+');
      expect(app.currentInput).toBe('Error');
      expect(app.operator).toBeNull();
      expect(app.waitingForSecondOperand).toBeFalse();

      app.inputDigit('2');
      expect(app.currentInput).toBe('2');

      app.handleOperator('+');
      expect(app.previousInput).toBe('2');
      app.inputDigit('3');
      app.handleEqual();
      expect(app.currentInput).toBe('5');
    });
  });

  describe('overflow boundary', () => {
    it('does not overflow a result just under 1e10', () => {
      const result = app.calculate('9999999999', '+', '0');
      expect(result).toBe('9999999999');
      expect(result.startsWith('E')).toBeFalse();
    });

    it('overflows a result at exactly 1e10', () => {
      const result = app.calculate('9999999999', '+', '1');
      expect(result.startsWith('E')).toBeTrue();
    });
  });

  describe('percent chained with more operators', () => {
    it('can be applied twice in a row', () => {
      app.inputDigit('2');
      app.inputDigit('0');
      app.inputDigit('0');
      app.handlePercent();
      expect(app.currentInput).toBe('2');
      app.handlePercent();
      expect(app.currentInput).toBe('0.02');
    });

    it('feeds into a following operator as the previous operand', () => {
      app.inputDigit('5');
      app.inputDigit('0');
      app.handlePercent();
      expect(app.currentInput).toBe('0.5');
      app.handleOperator('+');
      app.inputDigit('1');
      app.handleEqual();
      expect(app.currentInput).toBe('1.5');
    });
  });

  describe('spec requirement: 10億の桁まで計算できること', () => {
    it('calculates exactly up to 1,000,000,000 (10億) without erroring or overflowing', () => {
      app.inputDigit('9');
      app.inputDigit('9');
      app.inputDigit('9');
      app.inputDigit('9');
      app.inputDigit('9');
      app.inputDigit('9');
      app.inputDigit('9');
      app.inputDigit('9');
      app.inputDigit('9');
      app.handleOperator('+');
      app.inputDigit('1');
      app.handleEqual();
      expect(app.currentInput).toBe('1000000000');
      expect(app.currentInput.startsWith('E')).toBeFalse();
    });

    it('still calculates correctly well past 10億, up to the 10-digit ceiling', () => {
      const result = app.calculate('9999999999', '-', '1');
      expect(result).toBe('9999999998');
    });
  });

  describe('spec requirement: 小数点は最大8位まで表示できること', () => {
    it('rounds a value smaller than 8 decimal places up to the smallest displayable unit, not "0", "" or "-"', () => {
      // 1 / 1,000,000,000 = 0.000000001, which is finer than the 8-decimal
      // display can show. Rather than collapsing to a literal "0" (which
      // would be indistinguishable from an exact zero), it shows the
      // smallest representable amount, and must never become an empty
      // string or a bare "-" that would corrupt the next calculation.
      app.inputDigit('1');
      app.handleOperator('/');
      for (const d of '1000000000') {
        app.inputDigit(d);
      }
      app.handleEqual();
      expect(app.currentInput).toBe('0.00000001');
    });

    it('handles a negative value smaller than 8 decimal places the same way', () => {
      // One fewer decimal digit than the positive case, to leave room for
      // the minus sign within the 10-character display budget.
      const result = app.calculate('-1', '/', '1000000000');
      expect(result).toBe('-0.0000001');
      expect(result.length).toBeLessThanOrEqual(10);
      expect(result).not.toBe('');
      expect(result).not.toBe('-');
    });

    it('still shows an exact zero as "0", not the sub-precision fallback', () => {
      app.inputDigit('5');
      app.handleOperator('-');
      app.inputDigit('5');
      app.handleEqual();
      expect(app.currentInput).toBe('0');
    });

    it('recovers correctly after a sub-precision result (no corrupted state)', () => {
      app.inputDigit('1');
      app.handleOperator('/');
      for (const d of '1000000000') {
        app.inputDigit(d);
      }
      app.handleEqual();
      expect(app.currentInput).toBe('0.00000001');
      app.handleOperator('+');
      app.inputDigit('5');
      app.handleEqual();
      expect(app.currentInput).toBe('5.00000001');
    });

    it('rounds a repeating decimal (1/3) to exactly 8 decimal places', () => {
      app.inputDigit('1');
      app.handleOperator('/');
      app.inputDigit('3');
      app.handleEqual();
      expect(app.currentInput).toBe('0.33333333');
      expect(app.currentInput.split('.')[1].length).toBe(8);
    });

    it('rounds up correctly for 2/3 (0.6666...7, not truncated to 0.66666666)', () => {
      app.inputDigit('2');
      app.handleOperator('/');
      app.inputDigit('3');
      app.handleEqual();
      expect(app.currentInput).toBe('0.66666667');
    });

    it('rounds 22/7 to exactly 8 decimal places', () => {
      app.inputDigit('2');
      app.inputDigit('2');
      app.handleOperator('/');
      app.inputDigit('7');
      app.handleEqual();
      expect(app.currentInput).toBe('3.14285714');
    });
  });

  describe('display', () => {
    it('shows just the current number when no operator is pending', () => {
      app.inputDigit('4');
      app.inputDigit('2');
      expect(app.display()).toBe('42');
    });

    it('shows the operator symbol while waiting for the second operand', () => {
      app.inputDigit('4');
      app.handleOperator('/');
      expect(app.display()).toBe('4 ÷');
    });

    it('shows both operands and the symbol mid-entry', () => {
      app.inputDigit('4');
      app.handleOperator('*');
      app.inputDigit('2');
      expect(app.display()).toBe('4 × 2');
    });
  });
});
