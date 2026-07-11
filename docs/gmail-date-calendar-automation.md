# Gmailの日付を読み取ってGoogleカレンダーに自動登録するガイド

## 前提

Gmailには「メール内の予定を自動検出してカレンダーに追加する」機能が標準で存在しますが、これは航空券・ホテル・レストラン予約など **Googleが認識できる定型フォーマットのメールのみ** が対象です。
友人からの「7/20 19時に飲み会」のような自由な文面のメールや、業務システムからの通知メールなど、定型フォーマット外のメールから日付を拾いたい場合は、**Google Apps Script（GAS）** を使ってGmail APIとCalendar APIを連携させる方法が最も柔軟です。

```
Gmail（対象メールを検索）
      │  (定期的にスキャン: 時間主導型トリガー)
      ▼
Google Apps Script
      │  (本文/件名から日付・件名を抽出)
      ▼
Googleカレンダー（予定を自動作成）
      │
      ▼
処理済みメールに処理済みラベルを付与（重複登録防止）
```

> 注意: 自由な文面からの日付抽出は完全ではありません。誤検出・抽出漏れが起こり得るため、まずは対象を絞り込み（送信者・件名キーワードなど）、慣れてきたら対象範囲を広げることを推奨します。

---

## 方法1: Gmail標準機能を使う（コード不要・対象は定型メールのみ）

まずは最も簡単な標準機能で十分か確認してください。

1. パソコンでGoogleカレンダーを開く
2. 右上の **設定（歯車アイコン）** → **設定** を開く
3. 左メニューから自分のGoogleアカウントの **「Gmailのイベント」** を選択
4. **「Gmailのイベントをカレンダーに自動的に表示する」** をオンにする

これで、フライト・ホテル・レストラン・イベントのチケットなど、Googleが認識する定型メールは自動的にカレンダーに反映されます。
自由な文面のメールにも対応したい場合は、以下の方法2に進んでください。

---

## 方法2: Google Apps Scriptで自動登録する

### 手順1: スクリプトプロジェクトを作成する

1. [script.google.com](https://script.google.com) にアクセスし、**新しいプロジェクト** を作成
2. プロジェクト名を「Gmail予定自動登録」などに変更
3. デフォルトの `Code.gs` の内容を削除し、以下のスクリプトを貼り付ける

```javascript
// ===== 設定 =====
const SEARCH_QUERY = 'is:unread label:予定候補 -label:予定登録済み'; // 対象メールの検索条件
const PROCESSED_LABEL_NAME = '予定登録済み'; // 処理済みメールに付けるラベル
const DEFAULT_EVENT_DURATION_MINUTES = 60;   // 時刻はあるが終了時刻がない場合の予定の長さ(分)
const CALENDAR_ID = 'primary'; // 登録先カレンダー。特定のカレンダーIDを指定することも可能

// 日付・時刻を抽出する正規表現（例: 2026年7月20日 19:00 / 7/20 19時 / 7月20日19:00 など）
const DATE_PATTERNS = [
  // 2026年7月20日 19:00 / 2026年7月20日19時
  /(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日\s*(\d{1,2})[:時]\s*(\d{0,2})分?/,
  // 7月20日 19:00 / 7月20日19時（年省略）
  /(\d{1,2})月\s*(\d{1,2})日\s*(\d{1,2})[:時]\s*(\d{0,2})分?/,
  // 7/20 19:00
  /(\d{1,2})\/(\d{1,2})\s*(\d{1,2}):(\d{2})/,
];

function scanGmailAndCreateEvents() {
  const threads = GmailApp.search(SEARCH_QUERY, 0, 20);
  if (threads.length === 0) {
    Logger.log('対象メールはありませんでした');
    return;
  }

  const processedLabel = getOrCreateLabel_(PROCESSED_LABEL_NAME);
  const calendar = CALENDAR_ID === 'primary'
    ? CalendarApp.getDefaultCalendar()
    : CalendarApp.getCalendarById(CALENDAR_ID);

  threads.forEach(thread => {
    const messages = thread.getMessages();
    messages.forEach(message => {
      const subject = message.getSubject();
      const body = message.getPlainBody();
      const dateInfo = extractDateTime_(subject + '\n' + body);

      if (dateInfo) {
        calendar.createEvent(
          subject,
          dateInfo.start,
          dateInfo.end,
          { description: `Gmailより自動登録\n\n元メール件名: ${subject}\n${body.slice(0, 500)}` }
        );
        Logger.log(`予定を作成しました: ${subject} (${dateInfo.start})`);
      } else {
        Logger.log(`日付を抽出できませんでした: ${subject}`);
      }
    });
    thread.addLabel(processedLabel);
    thread.markRead();
  });
}

// 本文から日付・時刻を抽出してDateオブジェクトを返す
function extractDateTime_(text) {
  const now = new Date();

  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern);
    if (!match) continue;

    let year, month, day, hour, minute;
    if (match.length === 6) {
      // 年あり: 2026年7月20日 19:00
      [, year, month, day, hour, minute] = match;
    } else if (match.length === 5) {
      // 年なし: 7月20日19:00 または 7/20 19:00
      year = now.getFullYear();
      [, month, day, hour, minute] = match;
    } else {
      continue;
    }

    const start = new Date(
      Number(year), Number(month) - 1, Number(day),
      Number(hour), Number(minute) || 0
    );

    // 抽出した日付が過去すぎる場合（1ヶ月以上前）は誤検出とみなしスキップ
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    if (start < oneMonthAgo) continue;

    const end = new Date(start.getTime() + DEFAULT_EVENT_DURATION_MINUTES * 60 * 1000);
    return { start, end };
  }
  return null;
}

function getOrCreateLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}
```

### 手順2: 対象メールにラベルを付ける運用にする

このスクリプトは `label:予定候補` が付いたメールだけを対象にします（誤検出・意図しない予定の乱立を防ぐため）。

1. Gmailで **設定** → **ラベル** → **新しいラベルを作成** から `予定候補` ラベルを作成
2. カレンダー登録したいメールに手動で `予定候補` ラベルを付ける
   - または、Gmailの **フィルタ機能**（設定 → フィルタとブロック中のアドレス）で特定の送信者・件名のメールに自動でラベルを付けるよう設定すると、完全自動化できる

### 手順3: 動作確認する

1. スクリプトエディタの関数選択で `scanGmailAndCreateEvents` を選び、**実行** ボタンを押す
2. 初回実行時は権限の承認を求められるので、Gmail・カレンダーへのアクセスを許可する
3. 実行ログ（表示 → ログ）で処理結果を確認する
4. Googleカレンダーに予定が登録されていることを確認する

### 手順4: 定期実行のトリガーを設定する

1. スクリプトエディタ左メニューの **トリガー（時計アイコン）** を開く
2. **トリガーを追加** をクリック
3. 実行する関数: `scanGmailAndCreateEvents`
4. イベントのソース: **時間主導型**
5. 時間ベースのトリガーのタイプ: **分ベースのタイマー**（例: 15分おき）または **時間ベースのタイマー**
6. 保存する

これで、対象ラベルが付いたメールを定期的にスキャンし、日付が見つかれば自動でカレンダーに予定を登録するようになります。

---

## カスタマイズのポイント

- **検索対象を絞る**: `SEARCH_QUERY` を `from:example@company.com` のように特定の送信者に限定すると、誤検出を減らせます
- **抽出パターンを増やす**: `DATE_PATTERNS` に自分がよく受け取るメールの日付表記に合わせた正規表現を追加できます
- **より賢く抽出したい場合**: 正規表現では表現しにくい自然な日本語（「来週の金曜」など）まで対応したい場合は、Gemini API等の生成AIにメール本文を渡して日時をJSON形式で抽出させる方法もあります（要APIキー・利用料金）

## うまく動かない場合の確認事項

- Apps Scriptの実行権限（Gmail・カレンダーへのアクセス）が許可されているか
- `SEARCH_QUERY` の検索条件に該当するメールが実際に存在するか（Gmailの検索窓で同じクエリを試して確認）
- 抽出したい日付表記が `DATE_PATTERNS` のいずれにも一致していないか（ログで `extractDateTime_` の結果を確認）
- トリガーが正しく設定・有効化されているか（トリガー画面で最終実行結果がエラーになっていないか確認）

## 制限事項

- Apps Scriptには1日あたりの実行時間・カレンダーAPI呼び出し回数などのクォータ制限があります（個人利用の範囲では通常問題になりません）
- 正規表現ベースの抽出のため、完全に自由な文面（曖昧な日付表現など）の解析には限界があります
- メールを削除・アーカイブしても、一度作成されたカレンダーの予定は自動削除されません（手動で削除する必要があります）
