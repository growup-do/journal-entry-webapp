// 画面遷移図（?page=flow）：Figma のアートボードのようなキャンバスで、プロトタイプの全画面と遷移を俯瞰する。
//   ・ドラッグで移動、ホイール（またはボタン）で拡大縮小、「全体」で収める
//   ・画面は分類ごとのフレームにまとめ、ページ／モーダル／ダイアログ／外部サイトを見た目で区別
//   ・矢印は主な遷移（操作名つき）。アートボードにマウスを乗せると関係する矢印だけ強調
//   ・アートボードをクリックすると、その画面をプロトタイプで開く（ダイアログは親画面を開く）
//   依頼書 8章「情報設計（メニュー構成・画面遷移図）」の成果物。
//   【運用ルール】画面・モーダル・ダイアログを追加／削除／改名したら、必ず下の NODES（id・label・kind・group・open）と EDGES を同じコミットで更新する。

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { COPYRIGHT, backToApp, goStatic } from './Footer';
import { displayName } from '../data';

type Kind = 'page' | 'modal' | 'dialog' | 'panel' | 'external';
interface Node { id: string; label: string; kind: Kind; group: string; /** クリックで開く画面キー（?open=） */ open?: string; url?: string; note?: string }
interface Edge { from: string; to: string; label?: string; weak?: boolean }
interface Group { key: string; title: string; note?: string; color: string }

const GROUPS: Group[] = [
  { key: 'start', title: '起動・終了', note: 'ログイン → 区分・年度の選択 → 初期画面', color: '#5b6773' },
  { key: 'home', title: 'ホーム・機能から探す', color: '#1f7a52' },
  { key: 'entry', title: '伝票入力（4形式）', note: '右側に参照パネル。機能ボタンからダイアログ', color: '#1f7a52' },
  { key: 'ledger', title: '日記帳・元帳', note: '行の訂正・削除、検索条件、参照画面', color: '#2c5f9e' },
  { key: 'trend', title: '推移・分析', note: '推移表とグラフ・充実残額', color: '#2c5f9e' },
  { key: 'compare', title: '試算表・決算書', note: '科目 → 元帳 → 伝票のドリルダウン', color: '#2c5f9e' },
  { key: 'audit', title: '調査・チェック（ホームから開く）', color: '#b7791f' },
  { key: 'print', title: '帳票・印刷', note: '帳票画面内で 基本条件→詳細設定→出力先→印刷', color: '#6b3fb5' },
  { key: 'option', title: 'オプション（別売）', note: '未導入は導入案内', color: '#b45309' },
  { key: 'settings', title: '各種設定', note: 'マスター設定／登録機能／保守・運用／年度', color: '#48565f' },
  { key: 'user', title: 'ユーザー・共通', color: '#48565f' },
];

const N = (id: string, label: string, kind: Kind, group: string, extra: Partial<Node> = {}): Node => ({ id, label, kind, group, ...extra });
const NODES: Node[] = [
  // 起動・終了
  N('login', 'ログイン', 'page', 'start', { open: 'ログイン' }),
  N('pwreset', 'パスワード再設定', 'dialog', 'start', { open: 'ログイン', note: 'メール → コード → 新パスワード' }),
  N('division', '伝票入力区分の選択', 'dialog', 'start', { open: 'ホーム', note: '会計年度・区分（組織図）／1か月間表示しない' }),
  N('merge', '合算部門の選択', 'dialog', 'start', { open: 'ホーム' }),
  N('divinfo', '法人名の変更、及び区分の追加、変更', 'dialog', 'start', { open: 'ホーム', note: '集計区分／法人情報／伝票入力区分' }),
  // ホーム
  N('home', 'ホーム（ダッシュボード）', 'page', 'home', { open: 'ホーム' }),
  N('finder', '機能から探す', 'page', 'home', { open: '機能から探す' }),
  N('notices', 'お知らせ一覧', 'dialog', 'home', { open: 'ホーム' }),
  N('favedit', 'お気に入りの設定', 'dialog', 'home', { open: 'ホーム' }),
  N('homeedit', 'ダッシュボード表示オプション', 'dialog', 'home', { open: 'ホーム', note: '表示メニュー／最初に表示する画面' }),
  N('support', 'サポートサイト', 'external', 'home', { url: 'https://www.child.co.jp/' }),
  // 伝票入力
  N('e-voucher', '仕訳伝票形式', 'page', 'entry', { open: '伝票入力' }),
  N('e-single', '単一形式', 'page', 'entry', { open: '単一入力' }),
  N('e-transfer', '振替伝票形式', 'page', 'entry', { open: '振替入力' }),
  N('e-tsingle', '振替単一形式', 'page', 'entry', { open: '振替単一' }),
  N('widepanel', '参照パネル', 'panel', 'entry', { open: '伝票入力', note: '日記帳（当年／前年）／元帳１・２／残高照合' }),
  N('template', '定型仕訳・連続定型', 'dialog', 'entry', { open: '伝票入力', note: '呼出・新規登録ウィザード' }),
  N('alloc', '自動按分', 'dialog', 'entry', { open: '伝票入力', note: '金額入力 → 確認 → 登録' }),
  N('calendar', 'カレンダー', 'dialog', 'entry', { open: '単一入力' }),
  N('balance', '科目別残高／現預金残高', 'dialog', 'entry', { open: '単一入力' }),
  N('confirm', '確認画面', 'dialog', 'entry', { open: '伝票入力', note: '費用間・収益間・予算超過・連動' }),
  N('inputset', '入力の変更', 'dialog', 'entry', { open: '伝票入力' }),
  N('keys', 'キーボード操作一覧', 'dialog', 'entry', { open: '伝票入力' }),
  // 日記帳・元帳
  N('journal', '日記帳（仕訳一覧）', 'page', 'ledger', { open: '仕訳一覧' }),
  N('ledger', '総勘定元帳', 'page', 'ledger', { open: '勘定元帳' }),
  N('fundledger', '資金元帳', 'page', 'ledger', { open: '資金元帳' }),
  N('vendorledger', '業者元帳', 'page', 'ledger', { open: '業者元帳' }),
  N('search', '検索条件', 'dialog', 'ledger', { open: '仕訳一覧', note: '14条件・検索合計' }),
  N('vedit', '伝票の訂正', 'modal', 'ledger', { open: '仕訳一覧', note: '同一伝票の全行を同時編集' }),
  N('vdelete', '削除の確認', 'dialog', 'ledger', { open: '仕訳一覧' }),
  N('ledger1', '元帳１／元帳２（参照）', 'page', 'ledger', { open: '元帳１' }),
  N('ledgerpanel', '元帳パネル（右側）', 'panel', 'ledger', { open: '月次試算', note: '試算表・決算書・推移表の行から。画面遷移しない' }),
  N('balcheck', '残高照合', 'page', 'ledger', { open: '残高照合' }),
  // 推移
  N('trend', '科目推移表', 'page', 'trend', { open: '科目推移' }),
  N('ftrend', '資金推移表', 'page', 'trend', { open: '資金推移' }),
  N('vtrend', '業者推移表', 'page', 'trend', { open: '業者推移' }),
  N('trendgraph', 'グラフ作成', 'dialog', 'trend', { open: '科目推移' }),
  // 試算表・決算書
  N('trial', '試算表（月次試算）', 'page', 'compare', { open: '月次試算' }),
  N('budgetcmp', '予算対比表', 'page', 'compare', { open: '予算対比' }),
  N('closing', '決算書（月次決算）', 'page', 'compare', { open: '月次決算' }),
  N('balgraph', '残高グラフ', 'dialog', 'compare', { open: '月次決算' }),
  N('analysis', '収支分析', 'dialog', 'compare', { open: '月次決算' }),
  // 調査
  N('count', '仕訳数の問合せ', 'modal', 'audit', { open: '仕訳数' }),
  N('daily', '同額・不一致検索', 'modal', 'audit', { open: '日次調査', note: '不一致日で停止 → 伝票表示／検査継続' }),
  N('auditm', '決算チェック（決算調査）', 'modal', 'audit', { open: '決算調査', note: '28項目・5状態' }),
  N('auditexp', '説明／結果詳細／トレース', 'dialog', 'audit', { open: '決算調査' }),
  N('auditset', '決算チェック設定', 'page', 'audit', { open: '決算チェック設定' }),
  // グラフ
  N('ygraph', '経年グラフ', 'page', 'trend', { open: '経年グラフ' }),
  N('agraph', '分析グラフ', 'page', 'trend', { open: '分析グラフ' }),
  N('suff', '社会福祉充実残額', 'page', 'trend', { open: '充実残額', note: '算定方式の選択 → シミュレーター' }),
  // 帳票・印刷
  N('printc', '帳票の印刷', 'page', 'print', { open: '印刷センター' }),
  N('appendix', '別紙（注記・明細書・財産目録）', 'page', 'print', { open: '別紙（注記・明細書・財産目録）' }),
  N('commonprint', '共通の印刷設定', 'page', 'print', { open: '共通の印刷設定' }),
  N('printflow', '印刷（基本条件→詳細設定→出力先）', 'dialog', 'print', { open: '印刷センター' }),
  N('preview', 'プレビュー', 'modal', 'print', { open: '印刷センター' }),
  N('saveas', '名前を付けて保存', 'dialog', 'print', { open: '仕訳一覧', note: 'CSV／Excel／PDF' }),
  N('corpprint', '法人印刷', 'modal', 'print', { open: '法人印刷' }),
  // オプション
  N('petty', '小口現金出納', 'page', 'option', { open: '小口現金' }),
  N('dep', '減価償却', 'page', 'option', { open: '減価償却' }),
  N('bank', '預金出納帳', 'page', 'option', { open: '預金出納' }),
  N('receipt', '伺い書（収入・支出調書）', 'page', 'option', { open: '収入支出' }),
  N('stamp', '電子印（未導入の案内）', 'page', 'option', { open: '電子印' }),
  // 各種設定
  N('s-org', '法人・区分', 'page', 'settings', { open: '事業者' }),
  N('s-acct', '科目設定', 'page', 'settings', { open: '勘定科目' }),
  N('s-vendor', '業者', 'page', 'settings', { open: '取引先' }),
  N('s-summary', '摘要', 'page', 'settings', { open: '摘要辞書' }),
  N('s-opening', '残高（繰越・前年実績）', 'page', 'settings', { open: '開始残高' }),
  N('s-budget', '予算額の設定', 'page', 'settings', { open: '予算' }),
  N('s-attached', '決算附属明細書設定', 'page', 'settings', { open: '決算附属明細書' }),
  N('s-fin', '財務分析設定', 'page', 'settings', { open: '財務分析設定' }),
  N('s-carry', '繰越判断の基準', 'page', 'settings', { open: '繰越判断', note: '収支分析表／高額繰越／委託費30%／事前協議3%' }),
  N('s-deprlink', '減価償却との連動設定', 'page', 'settings', { open: '減価償却連動', note: '固定資産科目／償還補助／自動積立' }),
  N('s-tax', '消費税（税区分）', 'page', 'settings', { open: '税区分' }),
  N('s-template', '連続定型仕訳・自動按分仕訳の登録', 'page', 'settings', { open: '仕訳辞書' }),
  N('s-check', '伝票・科目チェック', 'page', 'settings', { open: '整合性チェック' }),
  N('s-env', '動作環境', 'page', 'settings', { open: '環境設定' }),
  N('s-refresh', '仕訳更新', 'page', 'settings', { open: '仕訳更新' }),
  N('s-backup', 'データのバックアップ', 'page', 'settings', { open: 'データのバックアップ' }),
  N('s-update', '年度更新／年度更新（減価のみ）', 'page', 'settings', { open: '年度更新', note: '取り消し不可・ステップ形式' }),
  // ユーザー・共通
  N('usersettings', 'ユーザー設定', 'page', 'user', { open: 'ユーザー設定' }),
  N('pwmail', 'メールアドレスでの確認', 'dialog', 'user', { open: 'ユーザー設定', note: 'パスワード変更時の確認コード' }),
  N('members', 'メンバーの追加、管理', 'page', 'settings', { open: 'メンバーの追加、管理', note: '各種設定 › ユーザー・権限' }),
  N('version', 'バージョン情報／ライセンス', 'dialog', 'user', { open: 'ホーム' }),
  N('terms', '利用規約', 'page', 'user', { url: '?page=terms' }),
  N('features', '機能一覧（プロトタイプ確認用）', 'page', 'user', { url: '?page=features', note: '製品のメニュー・フッターには置かない' }),
  N('issues', '確認事項・やりとり', 'page', 'user', { url: '?page=issues', note: 'クライアントとのやりとりをスレッドで記録' }),
  N('privacy', '個人情報保護方針（外部）', 'external', 'user', { url: 'https://www.child.co.jp/privacy.html' }),
];

const E = (from: string, to: string, label?: string, weak = false): Edge => ({ from, to, label, weak });
const EDGES: Edge[] = [
  E('login', 'pwreset', 'お忘れですか', true), E('login', 'division', 'ログイン'), E('division', 'merge', '合算追加', true), E('division', 'divinfo', '部門情報の変更', true),
  E('division', 'home', 'OK（初期画面：ホーム）'), E('login', 'home', 'ログイン（区分選択を1か月表示しない設定のとき）', true), E('division', 'e-voucher', 'OK（初期画面：伝票入力）', true),
  E('home', 'finder', '検索窓・一覧で見る'), E('home', 'notices', '一覧', true), E('home', 'favedit', '編集', true), E('home', 'homeedit', '右上のボタン', true), E('homeedit', 'favedit', '登録する画面を編集', true), E('home', 's-update', '年度更新の案内'), E('home', 'support', 'FAQ すべて見る', true), E('home', 'e-voucher', '伝票入力をはじめる'), E('usersettings', 'pwmail', 'パスワードを変更', true),
  E('home', 'count', '調査・チェック'), E('home', 'daily', '調査・チェック'), E('home', 'auditm', '調査・チェック'), E('home', 'balcheck', '残高照合へ', true), E('widepanel', 'balcheck', '残高照合の画面を開く', true),
  E('finder', 'trial', '機能を選ぶ', true),
  E('e-voucher', 'e-single', '形式切替'), E('e-single', 'e-transfer', '形式切替'), E('e-transfer', 'e-tsingle', '形式切替'),
  E('e-voucher', 'widepanel', '右側に常設'), E('widepanel', 'vedit', '行の訂正', true),
  E('e-voucher', 'template', '定型仕訳／連続定型', true), E('e-voucher', 'alloc', '自動按分', true), E('e-voucher', 'confirm', '伝票登録', true), E('e-voucher', 'inputset', '入力の変更', true), E('e-voucher', 'keys', 'キーボード操作一覧', true),
  E('e-single', 'confirm', '伝票登録（確認）', true), E('e-transfer', 'confirm', '伝票登録（確認）', true), E('e-single', 'calendar', 'カレンダー', true), E('e-single', 'balance', '科目別残高／現預金残高', true),
  E('journal', 'search', '検索条件', true), E('journal', 'vedit', '訂正'), E('journal', 'vdelete', '削除', true), E('journal', 'saveas', 'CSV出力', true),
  E('ledger', 'vedit', '訂正'), E('ledger', 'printflow', '印刷', true), E('journal', 'printflow', '印刷 ▾', true), E('trial', 'printflow', '印刷 ▾', true), E('closing', 'printflow', '印刷 ▾', true), E('e-voucher', 'printflow', '印刷 ▾', true), E('s-budget', 'printflow', '印刷 ▾', true), E('s-tax', 'printflow', '印刷 ▾', true), E('receipt', 'printflow', '印刷', true),
  E('daily', 'journal', '伝票表示（不一致の日）'), E('journal', 'daily', '← 戻る', true),
  E('trial', 'ledgerpanel', '科目 → 元帳'), E('closing', 'ledgerpanel', '科目 → 元帳'), E('trend', 'ledgerpanel', '月 → 元帳', true), E('ledgerpanel', 'ledger', '元帳の画面で開く'), E('ledgerpanel', 'vedit', '訂正', true), E('ledger', 'trial', '← 戻る', true),
  E('trend', 'trendgraph', 'グラフ作成', true), E('closing', 'balgraph', '残高グラフ', true), E('closing', 'analysis', '収支分析', true), E('closing', 'suff', '充実残額', true),
  E('auditm', 'auditexp', '説明／結果詳細', true), E('auditm', 'auditset', '決算チェック設定'), E('auditm', 'printflow', '結果印刷', true),
  E('printc', 'printflow', '帳票を選ぶ'), E('printflow', 'preview', 'プレビュー', true), E('printflow', 'saveas', 'CSV／Excel／PDF', true), E('printc', 'preview', 'まとめて印刷', true), E('appendix', 'printflow', '印刷', true),
  E('s-update', 'division', '完了後：会計期間を開く', true), E('s-update', 's-backup', 'バックアップの確認', true),
  E('s-acct', 's-attached', '関連する設定', true), E('s-carry', 'printflow', '収支分析表を印刷', true), E('s-deprlink', 's-acct', '科目設定で確認', true), E('s-deprlink', 'dep', '減価償却を開く', true), E('s-env', 'commonprint', '印刷の詳細設定を開く', true), E('auditset', 's-attached', '1年基準科目', true),
  E('s-template', 'template', '伝票入力で呼出', true),
  E('usersettings', 'login', 'ログアウト（確認なし）', true),
  E('e-voucher', 'dep', '固定資産科目の登録時', true),
];

/* ---------------- レイアウト ---------------- */
const NW = 176, NH = 92;      // ページのアートボード
const DW = 176, DH = 60;      // ダイアログ・モーダル
const GAP_X = 18, GAP_Y = 30, PAD = 22, HEAD = 40;
const COLS = 4;               // フレーム内の列数
const FRAME_COLS: string[][] = [ // キャンバス上のフレーム配置（列ごと）
  ['start', 'home', 'user'],
  ['entry', 'ledger', 'trend'],
  ['compare', 'audit', 'print'],
  ['settings', 'option'],
];
interface Placed { node: Node; x: number; y: number; w: number; h: number }
interface Frame { group: Group; x: number; y: number; w: number; h: number }
function layout(): { placed: Placed[]; frames: Frame[]; width: number; height: number } {
  const placed: Placed[] = []; const frames: Frame[] = [];
  const frameW = PAD * 2 + COLS * NW + (COLS - 1) * GAP_X;
  let colX = 40;
  let maxH = 0;
  FRAME_COLS.forEach((keys) => {
    let y = 40;
    keys.forEach((gk) => {
      const g = GROUPS.find((x) => x.key === gk)!;
      const nodes = NODES.filter((n) => n.group === gk);
      // ページを先に、ダイアログ類を後に並べる
      const ordered = [...nodes.filter((n) => n.kind === 'page' || n.kind === 'panel'), ...nodes.filter((n) => n.kind !== 'page' && n.kind !== 'panel')];
      let cx = 0, cy = HEAD + PAD, rowH = 0;
      ordered.forEach((n) => {
        const w = n.kind === 'page' ? NW : DW; const h = n.kind === 'page' ? NH : n.kind === 'panel' ? NH : DH;
        if (cx + w > COLS * NW + (COLS - 1) * GAP_X + 1) { cx = 0; cy += rowH + GAP_Y; rowH = 0; }
        placed.push({ node: n, x: colX + PAD + cx, y: y + cy, w, h });
        cx += w + GAP_X; rowH = Math.max(rowH, h);
      });
      const fh = cy + rowH + PAD;
      frames.push({ group: g, x: colX, y, w: frameW, h: fh });
      y += fh + 48;
    });
    maxH = Math.max(maxH, y);
    colX += frameW + 70;
  });
  return { placed, frames, width: colX + 40, height: maxH + 40 };
}

const KIND_LABEL: Record<Kind, string> = { page: 'ページ', modal: 'モーダル', dialog: 'ダイアログ', panel: 'パネル', external: '外部サイト' };
const KIND_STYLE: Record<Kind, CSSProperties> = {
  page: { background: '#fff', border: '1px solid #c9d3dc' },
  modal: { background: '#f3f6fa', border: '1px dashed #8fa3b8' },
  dialog: { background: '#fbfcfd', border: '1px dashed #b3bcc5' },
  panel: { background: '#eef6f1', border: '1px solid #9fc9b3' },
  external: { background: '#fff7e6', border: '1px dashed #d8b36a' },
};

/* ---------------- 本体 ---------------- */
export function FlowMapPage() {
  const { placed, frames, width, height } = useMemo(layout, []);
  const byId = useMemo(() => Object.fromEntries(placed.map((p) => [p.node.id, p])), [placed]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 0.6 });
  const [hover, setHover] = useState<string | null>(null);
  const [showWeak, setShowWeak] = useState(true);
  const [kinds, setKinds] = useState<Record<Kind, boolean>>({ page: true, modal: true, dialog: true, panel: true, external: true });
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);

  const fit = () => {
    const el = wrapRef.current; if (!el) return;
    const k = Math.min(el.clientWidth / width, el.clientHeight / height, 1.2);
    setView({ k, x: (el.clientWidth - width * k) / 2, y: (el.clientHeight - height * k) / 2 });
  };
  useEffect(() => { fit(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const zoomAt = (factor: number, cx?: number, cy?: number) => {
    const el = wrapRef.current; if (!el) return;
    const px = cx ?? el.clientWidth / 2, py = cy ?? el.clientHeight / 2;
    setView((v) => { const k = Math.min(2.5, Math.max(0.2, v.k * factor)); return { k, x: px - (px - v.x) * (k / v.k), y: py - (py - v.y) * (k / v.k) }; });
  };
  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); const r = el.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.1 : 0.9, e.clientX - r.left, e.clientY - r.top); };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === '+' || e.key === '=') zoomAt(1.2); else if (e.key === '-') zoomAt(0.8); else if (e.key === '0') fit(); };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openNode = (n: Node) => {
    if (n.url) { window.open(n.url, n.kind === 'external' ? '_blank' : '_self', 'noopener'); return; }
    if (n.open) window.open(`${window.location.pathname}?open=${encodeURIComponent(n.open)}`, '_blank', 'noopener');
  };
  const edges = EDGES.filter((e) => (showWeak || !e.weak) && byId[e.from] && byId[e.to] && kinds[byId[e.from].node.kind] && kinds[byId[e.to].node.kind]);
  const related = (id: string) => edges.filter((e) => e.from === id || e.to === id);
  const hot = hover ? new Set(related(hover).flatMap((e) => [e.from, e.to])) : null;

  const path = (e: Edge) => {
    const a = byId[e.from], b = byId[e.to];
    const ax = a.x + a.w, ay = a.y + a.h / 2, bx = b.x, by = b.y + b.h / 2;
    const leftward = bx < ax - 10;
    const sx = leftward ? a.x : ax, tx = leftward ? b.x + b.w : bx;
    const dx = Math.max(40, Math.abs(tx - sx) / 2) * (leftward ? -1 : 1);
    return { d: `M${sx},${ay} C${sx + dx},${ay} ${tx - dx},${by} ${tx},${by}`, mx: (sx + tx) / 2, my: (ay + by) / 2 - 6 };
  };
  const btn: CSSProperties = { padding: '6px 10px', border: '1px solid #cfd8e0', borderRadius: 8, background: '#fff', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', color: '#3d4a56' };
  const counts = { page: NODES.filter((n) => n.kind === 'page').length, other: NODES.filter((n) => n.kind !== 'page').length };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#e9edf1', fontFamily: "'Noto Sans JP', sans-serif", color: '#22303c' }}>
      {/* ツールバー */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: '#fff', borderBottom: '1px solid #dde4ea', flexWrap: 'wrap' }}>
        <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 16 }}>画面遷移図</div>
        <span style={{ fontSize: 11.5, color: '#7a8794' }}>Web チャッピー プロトタイプ　ページ {counts.page}／ダイアログ等 {counts.other}　ドラッグで移動・ホイールで拡大縮小・クリックで画面を開く</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
            <label key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: '#48565f', padding: '3px 8px', borderRadius: 8, ...KIND_STYLE[k], cursor: 'pointer' }}>
              <input type="checkbox" checked={kinds[k]} onChange={(e) => setKinds({ ...kinds, [k]: e.target.checked })} />{KIND_LABEL[k]}
            </label>
          ))}
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: '#48565f' }}><input type="checkbox" checked={showWeak} onChange={(e) => setShowWeak(e.target.checked)} />細い矢印（補助的な遷移）も表示</label>
          <span style={{ width: 1, height: 20, background: '#e2e8ee' }} />
          <button type="button" onClick={() => zoomAt(0.8)} style={btn}>－</button>
          <span style={{ fontSize: 12, width: 44, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{Math.round(view.k * 100)}%</span>
          <button type="button" onClick={() => zoomAt(1.25)} style={btn}>＋</button>
          <button type="button" onClick={fit} style={btn}>全体</button>
          <button type="button" onClick={() => setView({ x: 20, y: 20, k: 1 })} style={btn}>100%</button>
          <span style={{ width: 1, height: 20, background: '#e2e8ee' }} />
          <button type="button" onClick={() => goStatic('features')} style={btn}>機能一覧</button>
          <button type="button" onClick={backToApp} style={{ ...btn, background: '#1f7a52', color: '#fff', border: 'none' }}>システムへ戻る</button>
        </div>
      </div>

      {/* キャンバス */}
      <div
        ref={wrapRef}
        onMouseDown={(e) => { if ((e.target as HTMLElement).closest('[data-node]')) return; drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }; }}
        onMouseMove={(e) => { if (!drag.current) return; setView((v) => ({ ...v, x: drag.current!.vx + e.clientX - drag.current!.x, y: drag.current!.vy + e.clientY - drag.current!.y })); }}
        onMouseUp={() => { drag.current = null; }}
        onMouseLeave={() => { drag.current = null; }}
        style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: drag.current ? 'grabbing' : 'grab', backgroundImage: 'radial-gradient(#cfd6dd 1px, transparent 1px)', backgroundSize: `${24 * view.k}px ${24 * view.k}px`, backgroundPosition: `${view.x}px ${view.y}px` }}
      >
        <div style={{ position: 'absolute', left: 0, top: 0, width, height, transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, transformOrigin: '0 0' }}>
          {/* フレーム（分類） */}
          {frames.map((f) => (
            <div key={f.group.key} style={{ position: 'absolute', left: f.x, top: f.y, width: f.w, height: f.h, border: `1.5px solid ${f.group.color}33`, background: '#f7f9fb', borderRadius: 14 }}>
              <div style={{ position: 'absolute', left: 14, top: -14, display: 'flex', alignItems: 'baseline', gap: 8, padding: '3px 10px', background: f.group.color, color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap' }}>
                {f.group.title}{f.group.note && <span style={{ fontSize: 10.5, fontWeight: 500, opacity: 0.9 }}>{f.group.note}</span>}
              </div>
            </div>
          ))}
          {/* 矢印 */}
          <svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', overflow: 'visible' }}>
            <defs>
              <marker id="fm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#5b6773" /></marker>
              <marker id="fm-arrow-hot" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#1f7a52" /></marker>
            </defs>
            {edges.map((e, i) => {
              const p = path(e);
              const isHot = !!hover && (e.from === hover || e.to === hover);
              const dim = !!hover && !isHot;
              return (
                <g key={i} opacity={dim ? 0.12 : 1}>
                  <path d={p.d} fill="none" stroke={isHot ? '#1f7a52' : e.weak ? '#9aa5b1' : '#5b6773'} strokeWidth={isHot ? 2.4 : e.weak ? 1.1 : 1.8} strokeDasharray={e.weak ? '5 4' : undefined} markerEnd={`url(#${isHot ? 'fm-arrow-hot' : 'fm-arrow'})`} />
                  {e.label && (isHot || !hover) && (!e.weak || isHot || view.k > 0.8) && (
                    <g>
                      <rect x={p.mx - e.label.length * 5.6 - 5} y={p.my - 9} width={e.label.length * 11.2 + 10} height={17} rx={4} fill="#fff" stroke={isHot ? '#1f7a52' : '#dde4ea'} />
                      <text x={p.mx} y={p.my + 3.5} textAnchor="middle" fontSize={11} fill={isHot ? '#1f7a52' : '#5b6773'} fontWeight={isHot ? 700 : 500}>{e.label}</text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
          {/* アートボード */}
          {placed.filter((p) => kinds[p.node.kind]).map((p) => {
            const n = p.node;
            const dim = !!hot && !hot.has(n.id) && hover !== n.id;
            const isPage = n.kind === 'page' || n.kind === 'panel';
            return (
              <div key={n.id} data-node={n.id} onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)} onClick={() => openNode(n)} title={(n.note ? n.note + '　' : '') + (n.open ? `クリックで「${displayName(n.open)}」を開く` : n.url ? 'クリックで開く' : '')}
                style={{ position: 'absolute', left: p.x, top: p.y, width: p.w, height: p.h, cursor: n.open || n.url ? 'pointer' : 'default', opacity: dim ? 0.3 : 1, transition: 'opacity .12s' }}>
                {/* Figma のアートボード名のように枠の上に名前 */}
                <div style={{ position: 'absolute', left: 0, top: -17, fontSize: 11, fontWeight: 700, color: hover === n.id ? '#1f7a52' : '#5b6773', whiteSpace: 'nowrap', maxWidth: p.w + 60, overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.label}</div>
                <div style={{ width: '100%', height: '100%', boxSizing: 'border-box', borderRadius: 6, boxShadow: hover === n.id ? '0 0 0 2px #1f7a52, 0 8px 20px rgba(30,50,70,.18)' : '0 2px 6px rgba(30,50,70,.08)', overflow: 'hidden', ...KIND_STYLE[n.kind] }}>
                  {isPage ? (
                    <>
                      <div style={{ height: 10, background: '#dfe6ec', borderBottom: '1px solid #cfd8e0' }} />
                      <div style={{ display: 'flex', gap: 3, padding: '4px 6px' }}>{[0, 1, 2, 3].map((i) => <span key={i} style={{ width: 22, height: 4, borderRadius: 2, background: i === 0 ? '#1f7a52' : '#cfd8e0' }} />)}</div>
                      <div style={{ margin: '2px 6px', height: 36, borderRadius: 3, background: '#f1f4f6', border: '1px solid #e2e8ee', padding: 4, display: 'grid', gap: 3 }}>{[0, 1, 2].map((i) => <span key={i} style={{ height: 4, borderRadius: 2, background: '#dfe6ec', width: `${90 - i * 20}%` }} />)}</div>
                      <div style={{ position: 'absolute', right: 6, bottom: 5, fontSize: 9, color: '#9aa5b1' }}>{KIND_LABEL[n.kind]}</div>
                    </>
                  ) : (
                    <>
                      <div style={{ padding: '6px 8px', fontSize: 10.5, fontWeight: 700, color: '#48565f', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{n.note ?? n.label}</div>
                      <div style={{ position: 'absolute', right: 6, bottom: 4, fontSize: 9, color: '#9aa5b1' }}>{KIND_LABEL[n.kind]}</div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {/* 凡例 */}
        <div style={{ position: 'absolute', left: 14, bottom: 14, background: '#fff', border: '1px solid #dde4ea', borderRadius: 10, padding: '8px 12px', fontSize: 11, color: '#5b6773', display: 'grid', gap: 4, boxShadow: '0 6px 18px rgba(30,50,70,.1)' }}>
          <div><span style={{ display: 'inline-block', width: 26, height: 0, borderTop: '2px solid #5b6773', verticalAlign: 'middle', marginRight: 6 }} />主な遷移（操作名つき）</div>
          <div><span style={{ display: 'inline-block', width: 26, height: 0, borderTop: '1.5px dashed #9aa5b1', verticalAlign: 'middle', marginRight: 6 }} />補助的な遷移（ダイアログを開くなど）</div>
          <div style={{ color: '#9aa5b1' }}>アートボードにマウスを乗せると関係する矢印だけ強調。キー：＋／－で拡大縮小、0 で全体</div>
        </div>
      </div>
      <div style={{ padding: '4px 14px', fontSize: 10.5, color: '#8290a0', background: '#fff', borderTop: '1px solid #eef2f5' }}>{COPYRIGHT}</div>
    </div>
  );
}
