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

    it('is a no-op while waiting for the second operand', () => {
      app.inputDigit('5');
      app.handleOperator('+');
      app.handlePercent();
      expect(app.currentInput).toBe('5');
    });
  });

  describe('digit input limits', () => {
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
