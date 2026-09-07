import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  title = 'calculator';
  //状態を管理する変数を定義
  currentInput: string = ''; //今画面で打ち込んでいる最中の数字」 を覚える箱
  operator: string | null = null;  //選択された計算記号（+, -, *, /）」 を覚える箱
  previousInput: string = '';  //演算子を押す前に入力していた1つ前の数字」 を一時退避させておく箱
  isResultDisplayed: boolean = false;   //イコールを押した直後かどうかのメモ
  waitingForSecondOperand: boolean = false;  //演算子（+ や -）を押した直後（2つ目の数字の入力待ち）かどうかのメモ
  lastOperator: string | null = null; //リピート計算用の演算子を覚える箱
  lastOperand: string | null = null; //リピート計算用の2つ目の入力値を覚える箱

  //ボタンクリック時の処理
  inputDigit(digit: string) {
    // 上書き中でなければ、10桁以上は足さない
    const replacing = this.waitingForSecondOperand || this.isResultDisplayed;
    //小数点を何回も押せてしまうのを防止する
    if (!replacing && digit === '.' && this.currentInput.includes('.')) {
      return;
    }
    if (!replacing && this.currentInput.length >= 10) {
      return;
    }
    // 小数点以下は最大8桁
    if (!replacing && digit !== '.' && this.currentInput.includes('.')) {
      const decimalPart = this.currentInput.split('.')[1];
      if (decimalPart.length >= 8) {
        return;
      }
    }

    //if文で1+1を11にしないようにする
    if (this.waitingForSecondOperand) {
      if (digit === '.') {
        this.currentInput = '0.';
      } else {
        this.currentInput = digit;
      }
      this.waitingForSecondOperand = false;
      this.isResultDisplayed = false;

    } else if (this.isResultDisplayed) {
      if (digit === '.') {
        this.currentInput = '0.';
      } else {
        this.currentInput = digit;
      }
      this.isResultDisplayed = false;

      this.lastOperator = null;
      this.lastOperand = null;

    } else {
      if (this.currentInput === '' && digit === '.') {
        this.currentInput = '0.';
      } else {
        this.currentInput = this.currentInput + digit;
      }
      this.isResultDisplayed = false;
    }
  }

  //演算子ボタンクリック時の処理
  handleOperator(op: string) {
    // エラー表示中は一般的な電卓と同じく C/AC を押すまで演算子入力を無効化する
    if (this.currentInput === 'Error' || this.currentInput.startsWith('E')) {
      return;
    }
    if (this.operator !== null && !this.waitingForSecondOperand) {
      const result = this.calculate(this.previousInput, this.operator, this.currentInput);
      this.currentInput = result;
      this.previousInput = this.currentInput;
    } else {
      this.previousInput = this.currentInput;
    }
    this.operator = op;
    this.waitingForSecondOperand = true;
  }

  //等号ボタンクリック時の処理
  handleEqual() {
    if (this.operator !== null) {
      // リピート計算用に「演算子」と「2つ目の入力値」を保存
      this.lastOperator = this.operator;
      this.lastOperand = this.currentInput;
      const result = this.calculate(this.previousInput, this.operator, this.currentInput);
      this.currentInput = result;
      this.previousInput = this.currentInput;
      this.operator = null;

      //=を連続で押した時はリピート計算
    } else if (this.lastOperator && this.lastOperand) {
      const result = this.calculate(this.currentInput, this.lastOperator, this.lastOperand);
      this.currentInput = result;
      this.previousInput = this.currentInput;

      //桁あふれ、エラーになったらリピーター計算を止める
      if (this.currentInput.startsWith('E') || this.currentInput.startsWith('Error')) {
        this.lastOperator = null;
        this.lastOperand = null;
      }
    }
    this.isResultDisplayed = true;
    this.waitingForSecondOperand = false;
  }

  //演算子を押した後に%を押した時の処理
  handlePercent() {
    if (this.currentInput === 'エラー' || this.currentInput === 'Error' || this.waitingForSecondOperand) {
      return;
    }

    const current = this.parseOperand(this.currentInput);
    if (isNaN(current)) {
      return;
    }
    //100で割る
    const result = current / 100;
    const formatted = this.formatResult(result);
    this.currentInput = formatted;

    this.isResultDisplayed = true;
  }

  //計算をする関数
  calculate(previousInput: string, operator: string, currentInput: string): string {
    const prev = this.parseOperand(previousInput);
    const current = this.parseOperand(currentInput);
    let result: number;
    switch (operator) {
      case '+':
        result = prev + current;
        break;
      case '-':
        result = prev - current;
        break;
      case '*':
        result = prev * current;
        break;
      case '/':
        if (current === 0) {
          return 'Error';
        }
        result = prev / current;
        break;
      default:
        return String(current);
    }
    if (!Number.isFinite(result)) {
      return 'Error';
    }

    return this.formatResult(result);
  }

  // 新しく作成した関数
  formatResult(result: number): string {
    // 本当に桁あふれしたときだけ E。文字数や指数表記だけで Error にしない
    if (Math.abs(result) >= 1e10) {
      return this.formatOverflow(result);
    }
    // 小数点以下は最大8桁。末尾の0とドットを消す
    let formatted = result.toFixed(8).replace(/\.?0+$/, '');
    // ".00000000" までしか消えないので通常はここで空/"-"にはならないが、念のため保険を入れる
    if (formatted === '' || formatted === '-' || formatted === '-0') {
      formatted = '0';
    }
    //10文字を超える場合は10文字でカット
    if (formatted.length > 10) {
      formatted = formatted.slice(0, 10);
      if (formatted.endsWith('.')) {
        formatted = formatted.slice(0, -1);
      }
    }

    return formatted;
  }

  //計算時のEを取り除く
  parseOperand(value: string): number {
    //空の場合は0として計算する
    if (value === '') {
      return 0;
    }
    if (value.startsWith('E-')) {
      return -parseFloat(value.slice(2));
    }
    if (value.startsWith('E')) {
      return parseFloat(value.slice(1));
    }
    return parseFloat(value);
  }

  //オーバーフロー用
  formatOverflow(result: number): string {
    const isNegative = result < 0;
    //-なら一桁減らす
    let maxDigits: number;
    if (isNegative) {
      maxDigits = 9;
    } else {
      maxDigits = 10;
    }
    //指数を捨てずに計算に残す
    const exponential = Math.abs(result).toExponential(maxDigits - 1);
    return isNegative ? `E-${exponential}` : `E${exponential}`;
  }

  //エラー表示用
  errorMark() {
    return this.currentInput.startsWith('E') ? 'E' : '';
  }

  //数字部分の表示
  visibleNumber(value: string): string {
    if (!value) {
      return '0';
    }
    //erorrの場合は一桁削らない
    if (value === 'Error') {
      return 'Error';
    }
    //E-の場合2文字削る
    if (value.startsWith('E-')) {
      const raw = value.slice(2);
      const digits = raw.split('e')[0].replace('.', '');
      return `-${digits}`;
    }
    //Eの場合1文字削る
    if (value.startsWith('E')) {
      const raw = value.slice(1);
      const digits = raw.split('e')[0].replace('.', '');
      return digits;
    }
    return value;
  }

  //計算式等を表示させる
  display() {
    const current = this.visibleNumber(this.currentInput);
    if (this.operator !== '+' && this.operator !== '-' && this.operator !== '*' && this.operator !== '/') {
      return current;
    }

    const symbol = this.operator === '*' ? '×' : this.operator === '/' ? '÷' : this.operator;
    const previous = this.visibleNumber(this.previousInput);

    if (this.waitingForSecondOperand) {
      return `${previous} ${symbol}`;
    }
    return `${previous} ${symbol} ${current}`;
  }

  //Cボタンを押した時の処理
  clear() {
    // × などを押した直後は、桁を削らず演算子だけ取り消す（25 × → 25）
    if (this.waitingForSecondOperand) {
      this.operator = null;
      this.waitingForSecondOperand = false;
      this.previousInput = '';
      return;
    }
    // エラー表示や、桁が溢れた時は一括クリア
    if (this.currentInput.startsWith('E') || this.currentInput.startsWith('Error')) {
      this.currentInput = '';
      this.isResultDisplayed = false;
      return;
    }
    //マイナス一桁や通常の場合はリセット
    const signal = this.currentInput.length === 2 && this.currentInput.startsWith('-');
    if (this.currentInput.length > 1 && !signal) {
      this.currentInput = this.currentInput.slice(0, -1);
    } else {
      this.currentInput = '';
    }

    this.isResultDisplayed = false;
  }

  //ACボタンを押した時の処理
  allClear() {
    this.currentInput = '';
    this.operator = null;
    this.previousInput = '';
    this.isResultDisplayed = false;
    this.waitingForSecondOperand = false;
    this.lastOperator = null;
    this.lastOperand = null;
  }
}
