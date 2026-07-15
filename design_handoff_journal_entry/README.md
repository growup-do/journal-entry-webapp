# Handoff: 仕訳伝票 入力ページ（社会福祉法人 会計ソフト Web化）

## Overview
社会福祉法人（幼稚園・保育園）向け会計ソフトの「仕訳伝票 入力ページ」を、従来のスタンドアローン型からWebアプリ化するためのUIプロトタイプです。ユーザー（経理担当者）が「用紙に書く感覚」で仕訳伝票を入力し、各欄はミニマルな補助ドロップダウン（検索＋分類）で候補を選択、入力完了後に「処理終了／登録」で右（下）の**仕訳帳**に行が追加されます。

レイアウトの異なる**2案**を用意しており、実装前にどちらを採用するか（または折衷）を意思決定するためのものです。

- **案1a「伝票フォーム型」** — 紙の仕訳伝票を忠実に再現したフォーム。1件ずつ丁寧に入力する従来ユーザー向け。
- **案1b「スプレッドシート型」** — 上部の1行入力バーで連続入力し、下の帳簿へ追加。速い連続入力向き。

## About the Design Files
このバンドルに含まれるファイルは **HTMLで作成されたデザインリファレンス**です。意図した見た目と挙動を示すプロトタイプであり、そのまま本番コードにコピーするものではありません。

このプロトタイプは独自の軽量ランタイム（`.dc.html` ＋ `support.js`）で動いていますが、**実装時はこのランタイムを使う必要はありません**。ターゲットとなるコードベースの既存環境（React / Vue / Svelte など）とその確立されたパターン・ライブラリを用いて、これらのデザインを**再現**してください。環境がまだ無い場合は、プロジェクトに最も適したフレームワークを選定して実装してください。

## Fidelity
**High-fidelity (hifi)**。最終的な配色・タイポグラフィ・余白・インタラクションを含むピクセルレベルのモックアップです。UIは、コードベースの既存ライブラリ・パターンを使いつつ、本ドキュメントの数値どおりに忠実に再現してください。

---

## Screens / Views

### 案1a: 伝票フォーム型（Voucher Form）

**Name:** 仕訳伝票 入力フォーム（フォーム型）
**Purpose:** 1件の仕訳伝票を、紙の伝票と同じ視覚構造で入力し、「処理終了」で仕訳帳へ登録する。

**Layout:**
- 横並び2カラム。左＝入力フォームカード（`width: 716px`）、右＝仕訳帳カード（`width: 372px`）、`gap: 22px`、上端揃え（`align-items: flex-start`）。
- フォームカード: 白背景、`border: 1px solid #dde4ea`、`border-radius: 16px`、`box-shadow: 0 6px 26px rgba(30,50,70,.07)`、`padding: 26px 28px 22px`。

**Components（上から順に）:**

1. **タイトル行** — 下境界線 `border-bottom: 2px solid #28323c`、`padding-bottom: 15px`、`margin-bottom: 20px`。左右 space-between。
   - 左: 「仕訳伝票」見出し（`font-family: 'Zen Kaku Gothic New'`, `font-weight: 700`, `font-size: 25px`, `letter-spacing: .03em`）＋ サブ「チャイルド保育園　拠点区分」（`13px`, `#5b6773`, `margin-top: 4px`）。
   - 右: ラベル「取引区分」（`11px`, `#8895a3`）＋ **取引区分チップ**群（下記）。

2. **取引区分チップ**（3個: 資金 / 事業 / その他）— 単一選択トグル。`display: flex; gap: 6px`。
   - 各チップ: `padding: 6px 14px; font-size: 12.5px; font-weight: 600; border-radius: 20px; cursor: pointer`。
   - 非選択: `background: #fff; color: #5b6773; border: 1px solid #cfd8e0`。
   - 選択: `background: #1f7a52; color: #fff; border: 1px solid #1f7a52`（＝アクセント色。1bでは `#2c5f9e`）。
   - 初期選択: 案1aは「資金」。もう一度押すと解除可（空も許容）。

3. **メタ行** — `display: grid; grid-template-columns: 1.5fr 1.5fr .95fr; gap: 16px; margin-bottom: 20px`。
   - **サービス区分**: ラベル＋補助ドロップダウン付きフィールドボタン（type=service）。初期値「001 本部」。
   - **伝票日付**: 「令和8年」＋ 月入力（`width: 44px`）＋「月」＋ 日入力（`width: 44px`）＋「日」。数字のみ・最大2桁。
   - **伝票No**: 非活性の「自動採番」表示（`background: #f5f7f9; color: #9aa5b1`）。

4. **借方 / 貸方 2カラム** — `display: grid; grid-template-columns: 1fr 1fr; gap: 16px`。
   - **借方ボックス**: `border: 1px solid #cfe0f2; border-radius: 12px`。ヘッダー `background: #eaf2fb; color: #2c5f9e; font-weight: 700; font-size: 13px; padding: 9px 14px; border-radius: 11px 11px 0 0`、「借方」＋右上に「BS / PL」（`10px`, `#87a6cc`）。本文 `padding: 14px`: 科目フィールド（補助ドロップダウン type=account）＋「予算残 —／達成率 —」（`11px`, `#9aa5b1`）。
   - **貸方ボックス**: 同構造、色違い。`border: 1px solid #f2d0dc`、ヘッダー `background: #fdeef3; color: #b0426a`、「BS / PL」`#d18aa5`。
   - ⚠️ ボックスに `overflow: hidden` を付けないこと（補助ドロップダウンが切れる）。角丸はヘッダー側の `border-radius` で表現。

5. **明細ボックス** — `border: 1px solid #e2e8ee; border-radius: 12px; margin-bottom: 22px`。内側 `display: grid; grid-template-columns: 1fr 216px`。
   - 左セル（`padding: 15px 16px; border-right: 1px solid #eef2f5`, `border-radius: 11px 0 0 11px`）: **摘要**（テキスト入力＋右の▼ボタンで候補ドロップダウン type=summary。Enter/自由入力も可）＋ **業者**（補助ドロップダウン type=vendor）。
   - 右セル（`padding: 15px 18px; background: #fbfcfd; border-radius: 0 11px 11px 0`）: **金額**。「¥」＋ 大きな右寄せ入力（`font-size: 23px; font-weight: 700; border: none; border-bottom: 2px solid #cfd8e0; text-align: right; font-variant-numeric: tabular-nums`）。数字のみ、3桁区切りで表示。
   - ⚠️ 明細ボックスも `overflow: hidden` を付けない。

6. **フッター行** — space-between。左: バリデーションエラー領域（`min-height: 22px`, `color: #c0392b`, `font-size: 12.5px`）。右: **処理終了ボタン**。
   - ボタン: `display: inline-flex; align-items: center; gap: 8px; background: #1f7a52; color: #fff; border: none; border-radius: 11px; padding: 13px 24px; font-weight: 700; font-size: 15px; box-shadow: 0 3px 12px rgba(31,122,82,.24)`。hover: `filter: brightness(.92)`。ラベル「処理終了　→　仕訳帳へ登録」。

**仕訳帳カード（右・1a）:**
- `width: 372px`、白カード、`border-radius: 16px`、`max-height: 748px`、縦フレックス。
- ヘッダー: 「仕訳帳」（`Zen Kaku Gothic New`, 700, `16.5px`）＋ 件数「N 件」（`12px`, `#8895a3`）。`border-bottom: 1px solid #eef2f5; padding: 17px 18px`。
- テーブルヘッダー: `display: grid; grid-template-columns: 46px minmax(0,1fr) minmax(0,1fr) 78px; gap: 8px; padding: 9px 14px; background: #f6f8fa; font-size: 10.5px; font-weight: 700; color: #8290a0`。列: 月日 / 借方科目 / 貸方科目 / 金額（右寄せ）。
- 行リスト: スクロール領域（`overflow-y: auto`）。各行 `display: grid`（同 `grid-template-columns`）、`gap: 8px; padding: 11px 16px; border-bottom: 1px solid #f1f4f6; font-size: 12.5px; align-items: center`。
  - 月日（`11px`, `#8895a3`）。借方セル: 科目名（`font-weight: 500`, ellipsis）＋摘要サブテキスト（`10.5px`, `#9aa5b1`, ellipsis, 摘要があるときのみ）。貸方科目（`#48565f`, ellipsis）。金額（右寄せ, `font-weight: 700`, `tabular-nums`, 3桁区切り）。
  - 新規追加行は一時ハイライト: `background: #fff2c9` → `transparent`（`animation: rowin 1.8s ease`）。

---

### 案1b: スプレッドシート型（Spreadsheet）

**Name:** 仕訳帳 クイック入力（スプレッドシート型）
**Purpose:** 上部の1行入力バーで科目・摘要・金額を素早く入力し「登録」で下の帳簿へ連続追加する。

**Layout:**
- 単一カード（`width: 1140px`、白、`border-radius: 16px`、`overflow: hidden`）。上から: ヘッダー → 入力バー → テーブルヘッダー → 帳簿行リスト。

**Components:**

1. **ヘッダー行** — `padding: 18px 22px; border-bottom: 1px solid #eef2f5`、space-between。
   - 左: 「仕訳帳」（`Zen Kaku Gothic New`, 700, `19px`）＋薄いサブ「チャイルド保育園 拠点区分」＋説明文（`12.5px`, `#68757f`）。
   - 右: 「取引区分」ラベル＋取引区分チップ（1aと同仕様、アクセント `#2c5f9e`、初期「事業」）。

2. **入力バー** — `padding: 15px 22px 18px; background: #f7fafb; border-bottom: 1px solid #eef2f5`。
   - グリッド: `display: grid; grid-template-columns: 122px minmax(0,1.35fr) minmax(0,1.35fr) minmax(0,1.5fr) 128px 148px 96px; gap: 12px; align-items: end`。
   - ⚠️ **`minmax(0, …)` は必須**。通常の `fr` だと最小サイズが min-content になり、摘要列が膨張して「登録」ボタンがカードからはみ出す（既知の不具合として修正済み）。
   - 列: 日付（月/日 コンパクト入力）／借方科目（label色 `#2c5f9e`）／貸方科目（label色 `#b0426a`）／摘要（入力＋▼）／業者／金額（右寄せ入力）／**登録ボタン**。
   - 各フィールドはラベル上・入力下。ラベル `font-size: 10.5px; font-weight: 600; color: #8290a0`。
   - 登録ボタン: `height: 40px; background: #2c5f9e; color: #fff; border: none; border-radius: 8px; font-weight: 700; font-size: 14px`。hover: `filter: brightness(.92)`。
   - バー下にエラー領域（`min-height: 18px; margin-top: 9px`）。

3. **テーブルヘッダー** — `display: grid; grid-template-columns: 70px minmax(0,1.1fr) minmax(0,1.1fr) minmax(0,1.4fr) 118px; gap: 14px; padding: 10px 22px; background: #f6f8fa`。列: 月日 / 借方科目 / 貸方科目 / 摘要 / 金額（右寄せ）。

4. **帳簿行リスト** — `max-height: 430px; overflow-y: auto`。各行は同グリッド、`gap: 14px; padding: 11px 22px; border-bottom: 1px solid #f1f4f6; font-size: 12.5px; align-items: center`。摘要は独立列（`#7a8794`, ellipsis）。新規行ハイライトは1aと同じ。

---

### 共通コンポーネント: 補助ドロップダウン（AssistPanel）

参考画像（`参考.png`）準拠のミニマルなドロップダウン。フィールド直下に絶対配置（`position: absolute; top: calc(100% + 6px); z-index: 60`）。親フィールドは `position: relative` かつ `data-assist` 属性（外側クリックで閉じる判定用）を持つ。

- コンテナ: 白、`border: 1px solid #d3dce4; border-radius: 11px; box-shadow: 0 14px 36px rgba(24,42,62,.18); overflow: hidden`。
- 上部: 検索入力（`padding: 9px` の枠、`background: #fafcfd; border-bottom: 1px solid #eef2f5`）。入力 `padding: 8px 11px; border: 1px solid #d3dce4; border-radius: 8px; font-size: 13.5px`。placeholder「入力して絞り込み」。focus: `border-color: #1f7a52; box-shadow: 0 0 0 3px rgba(31,122,82,.10)`。開いたら自動フォーカス。
- リスト: `max-height: 232px; overflow-y: auto; padding: 4px 0`。
  - **分類見出し**（該当タイプのみ）: `padding: 9px 13px 3px; font-size: 10.5px; font-weight: 700; color: #93a0ad; letter-spacing: .05em`。
  - **候補行**: `padding: 8px 15px; font-size: 14px; color: #283641; cursor: pointer`。hover: `background: #eaf5ef; color: #186641`。
  - 該当なし: 「該当する候補がありません」（`#9aa5b1`, 中央）。
- 選択は `mousedown` で確定（外側クリックの閉じる処理より先に発火させるため）。

**タイプ別の候補データ:**
- `account`（勘定科目・分類見出しあり）:
  - 現金及び預金: 現金 / 普通預金（保育園）/ 当座預金（保育園）/ 小口現金
  - 事業未収金: 事業未収金 / 未収金 / 立替金 / 仮払金
  - 事業費: 保育材料費 / 給食費 / 水道光熱費（事業）/ 通信運搬費 / 賃借料（事業）/ 印刷製本費 / 消耗品費
  - 人件費: 職員俸給 / 法定福利費 / 特殊業務手当 / 扶養手当 / 時間外手当 / 通勤手当 / その他手当
  - 事業収益: 委託費収益 / その他の利用料収益 / 現金（収入）/ 受託事業収益 / 補助金収益
- `service`（サービス区分・見出しなし）: 001 本部 / 002 保育事業 / 003 子育て支援 / 004 一時預かり / 005 地域支援
- `vendor`（業者・見出しなし）: （なし）/ 東京電力 / ＮＴＴ東日本 / 中央リース / みどり商店 / 市役所 / 保護者。「（なし）」選択時は空値に。
- `summary`（摘要・見出し「よく使う摘要」）: 健康保険 / 厚生年金 / 法定福利費 / 職員俸給 / 委託費ー８月分 / 電話料金 / ガス代ー７月分 / 副食費ー保護者より / コピー代 / 夏祭り用品 / 振込手数料
- 検索は入力文字列の**部分一致**でフィルタ（分類見出しは残候補があるグループのみ表示）。

---

## Interactions & Behavior
- **フィールドを開く**: 科目/区分/業者/摘要のボタンをクリック → 該当タイプの候補で AssistPanel を表示、検索入力に自動フォーカス。他フィールドを開くと前のは閉じる。パネル外（`[data-assist]` の外）を mousedown で閉じる。
- **候補選択**: 行を mousedown → 対象フィールドに値をセットしパネルを閉じる。関連エラーはクリア。
- **摘要**: テキスト自由入力可（`onInput`）。▼ボタンで候補も選べる。
- **金額**: 入力を数字のみに正規化して保持し、表示は3桁区切り（`toLocaleString('ja-JP')`）。
- **月/日**: 数字のみ・最大2桁。
- **取引区分チップ**: 単一選択トグル（再クリックで解除）。
- **処理終了 / 登録（submit）**:
  - バリデーション: 借方科目・貸方科目・金額が必須。未入力なら「借方科目・貸方科目・金額を入力してください。」を表示し中断。
  - OKなら仕訳帳エントリを生成: `{ date: '月/日', kari: 借方科目, kashi: 貸方科目, tekiyo: 摘要, amount: 数値 }`。該当帳簿に**末尾追加**。
  - フォームは 借方科目/貸方科目/摘要/業者/金額 をリセット（日付・サービス区分・取引区分は保持）。
  - 追加後、該当スクロール領域を最下部へスクロール（`el.scrollTop = el.scrollHeight`。`scrollIntoView` は使わない）。
  - 追加行は `rowin`（1.8s）でハイライト。
- **アニメーション**: `@keyframes rowin { from { background:#fff2c9 } to { background:transparent } }`。チップ/フィールドのhoverは `transition: all .12s` 目安。

## State Management
案1a・1bは**独立した状態**（別々のフォーム値・別々の仕訳帳）を持つ比較用。実装ではどちらか採用案のみでよい。
- `formA` / `formB`: `{ service, month, day, torihiki, kariKamoku, kashiKamoku, tekiyo, gyosha, amount }`。初期 service='001 本部', 1a: month='8'/day='1'/torihiki='資金'、1b: month='8'/day='5'/torihiki='事業'。
- `assist`: `{ open, opt, field, type, query }`（現在開いているドロップダウンと検索語）。
- `journalA` / `journalB`: エントリ配列（下記シードで初期化、各行に一意 id）。
- `lastAdded`: 直近追加エントリの id（ハイライト判定）。
- `errA` / `errB`: バリデーションメッセージ。
- データ取得要件: プロトタイプは静的マスタ（科目/区分/業者/摘要）を内蔵。本番では会計マスタAPIから取得する想定。

**仕訳帳シード（1a・1b共通、初期5件）:**
| 月日 | 借方科目 | 貸方科目 | 摘要 | 金額 |
|---|---|---|---|---|
| 8/1 | 健康保険 | 普通預金（保育園） | 健康保険 | 237,873 |
| 8/1 | 厚生年金 | 普通預金（保育園） | 厚生年金 | 390,886 |
| 8/1 | 保育材料費 | 普通預金（保育園） | 夏祭り用品 | 12,529 |
| 8/1 | 手数料 | 小口現金 | 振込手数料 | 660 |
| 8/4 | 現金（収入） | その他の利用料収益 | 副食費ー保護者より | 4,500 |

## Design Tokens
**Colors**
- ブランド緑（アクセント/1a）: `#1f7a52`（濃 `#186641` / `#155c3d`）
- 青（1bアクセント/借方系）: `#2c5f9e`（淡 `#eaf2fb` / 枠 `#cfe0f2` / 補助 `#87a6cc`）
- 桃（貸方系）: `#b0426a`（淡 `#fdeef3` / 枠 `#f2d0dc` / 補助 `#d18aa5`）
- インク: `#22303c` / `#28323c`。本文薄: `#48565f` / `#5b6773` / `#68757f`。ミュート: `#7a8794` / `#8290a0` / `#8895a3` / `#93a0ad` / `#9aa5b1`。
- 枠線: `#dde4ea` / `#e2e8ee` / `#eef2f5` / `#f1f4f6` / `#cfd8e0` / `#d3dce4`。
- 面: `#fff` / `#fbfcfd` / `#f6f8fa` / `#f7fafb` / `#f5f7f9` / `#fafcfd`。ページ背景 `#e8ecf0`。
- 状態: エラー `#c0392b`。新規行ハイライト `#fff2c9`。hover面 `#eaf5ef` / 文字 `#186641`。
- アクセント色は Tweak 化（`#1f7a52` / `#2c5f9e` / `#b0592a` / `#5b4a8a`）— 実装では採用案のプライマリ色に。

**Typography**
- 本文: `'Noto Sans JP', sans-serif`（400/500/700）。
- 見出し: `'Zen Kaku Gothic New', sans-serif`（500/700）。
- スケール: 見出し 25/19/16.5px、本文 14〜14.5px、補足 12.5/11〜10.5px。数字は `font-variant-numeric: tabular-nums`。

**Radius**: 20px（チップ/ピル）/ 16px（カード）/ 12px（ボックス）/ 11px（ドロップダウン・内側角）/ 9px・8px（フィールド）。

**Shadow**: カード `0 6px 26px rgba(30,50,70,.07)`。ドロップダウン `0 14px 36px rgba(24,42,62,.18)`。ボタン `0 3px 12px rgba(31,122,82,.24)`。focusリング `0 0 0 3px rgba(<accent>,.10)`。

**Spacing**: カード内 padding 26/22/18/15/14px、要素間 gap 22/16/13/12/8/6px を基調。

## Assets
- 画像アセットなし。アイコンは不使用（`▼` 文字とテキストのみ）。ロゴ等の外部画像は使っていない。
- フォントは Google Fonts（Noto Sans JP / Zen Kaku Gothic New）。本番では社内のフォント配信/デザインシステムに置き換え可。
- 元システムの参考スクリーンショット（`1.png` 既存画面 / `2.png` 旧科目検索 / `参考.png` 目標のミニマル補助UI）はプロジェクトの `uploads/` にあり、必要なら別途共有。

## Files
- `仕訳伝票入力.dc.html` — 案1a・1b両方を含むメインのデザインプロトタイプ（キャンバス上に横並び。ロジック＝バリデーション/補助検索/登録処理を含む）。
- `AssistPanel.dc.html` — 補助ドロップダウン（テンプレートのみ）。
- `support.js` — プロトタイプ用ランタイム（**参考のみ。本番では不要**）。

> 注: `.dc.html` は本プロトタイプ環境専用の形式です。実装では上記READMEの仕様に沿って、対象コードベースの標準的なコンポーネント（React等）として再構築してください。ブラウザで挙動を確認したい場合は `仕訳伝票入力.dc.html` を開けば動作します。
