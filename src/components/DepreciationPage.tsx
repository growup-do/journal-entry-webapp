// オプション：減価償却（既存「Chappy24 減価償却オプションシステム」の再現）
//   トップ（機能メニュー＋固定資産／備品一覧）から各機能へ：
//   固定資産 新規登録・変更／備品 新規登録・変更／一括処理（除却・売却・移管）／決算機能（伝票一覧→伝票作成→決算処理）
//   全項目手入力／移管（先）取込み／固定資産・備品データ削除／帳票印刷／動作環境設定／操作ログ
//   ホーム（会計と同じ機能の一覧。確認メモ #244）から各機能を開く。
//   値はサンプル。定額法の年間償却額＝（取得価額－残存価額）÷耐用年数 で自動計算。
//   帳票・ファイル出力は ExportDialog（印刷／CSV）で実際に出力する。各種設定ダイアログは画面内の状態を変更する。

import { Fragment, useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { Modal } from './Modal';
import { NUM, TD, TH } from './ReportShell';
import { ToastView, useToast } from './Toast';
import { ExportDialog } from './ExportDialog';
import { PrintOutButton } from './PrintOutDialog';
import { DepPrintModal, printMethod, type DepValues } from './DepPrintModal';
import { PreviewModal } from './PrintCenter';
import type { ExportSpec } from './ExportDialog';
import { IconButton, Notice, PrintIcon, SelectionBar, btn as uiBtn } from './ui';
import { WarekiDate, isWarekiComplete, parseWareki } from './WarekiDate';
import { ScreenPrintMenu } from './ScreenPrintMenu';
import { ACCOUNT_META, accountMatches } from '../lib/accounts';
import { SUMMARIES } from '../data';
import { DivisionList } from './DivisionPicker';
import { DivisionOrgChart, OrgChartLegend } from './DivisionOrgChart';
import { FunctionDirectory, type FunctionGroup } from './FunctionFinder';
import { EditVoucherModal, groupVouchers } from './VoucherEdit';
import { addVoucher, deleteVouchers, useVouchers, type Voucher as JVoucher } from '../store/journalStore';
import { divisionLabel, flattenDivisions, useSession, type DivisionNode } from '../store/session';
import { isMemoReplaying } from '../memo/uiContext';

const yen = (n: number) => n.toLocaleString('ja-JP');
const USER = '鈴木';
const pad2 = (n: number) => String(n).padStart(2, '0');
const stamp = () => { const d = new Date(); return `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`; };
const waToday = () => { const d = new Date(); return `令和${d.getFullYear() - 2018}年 ${d.getMonth() + 1}月${String(d.getDate()).padStart(2, ' ')}日`; };
const numOf = (s: string) => parseInt(String(s || '').replace(/[^0-9]/g, ''), 10) || 0;

interface Asset { code: string; name: string; account: string; acquired: string; life: number; cost: number; /** 移管取込＝移管取込で登録した資産、移管年度＝移管(元)として移管した資産（確認メモ #286） */ status: '償却中' | '償却終了' | '対象外' | '移管取込' | '移管年度'; opening: number; subsidy: number; method: string; qty: number; place?: string; purpose?: string; transferIn?: boolean; depStart?: string; manualRows?: Record<YrTab, MRow[]>; /** 全項目手入力で登録した資産（確認メモ #281） */ manual?: boolean; /** 資本的支出として登録した資産の、元の固定資産の資産コード（確認メモ #279） */ capexOf?: string; capexKind?: CapexKind }
/** 資本的支出の方法（確認メモ #279。現行システムの「資本的支出の方法選択画面」と同じ 2 通り） */
type CapexKind = '新たな固定資産' | '特例合算';
const CAPEX_LABEL: Record<CapexKind, string> = { 新たな固定資産: '新たな固定資産として登録', 特例合算: '特例合算' };
/** 動作環境設定「除却物件および移管物件の当期減価償却額」（確認メモ #282） */
type DispCalc = '計算しない（期首価額を除却損／移管損とする）' | '除却月／移管月まで（月按分する）';
const ASSETS: Asset[] = [
  { code: '00001', name: '園舎', account: '建物　－基本財産－', acquired: '昭和54年 4月 1日', life: 47, cost: 27580000, status: '償却中', opening: 4349772, subsidy: 2934626, method: '定額法', qty: 1 },
  { code: '00002', name: '哺乳びん殺菌乾燥保管庫', account: '器具及び備品', acquired: '平成30年 2月 5日', life: 5, cost: 203040, status: '償却終了', opening: 33840, subsidy: 0, method: '定額法', qty: 1 },
  { code: '00003', name: '調理室エアコン', account: '器具及び備品', acquired: '平成30年 3月31日', life: 6, cost: 467000, status: '償却中', opening: 148545, subsidy: 0, method: '定額法', qty: 1 },
  { code: '00004', name: '事務室エアコン', account: '器具及び備品', acquired: '平成30年 3月31日', life: 6, cost: 548200, status: '償却中', opening: 174375, subsidy: 0, method: '定額法', qty: 1 },
  { code: '00005', name: '木製下駄箱', account: '器具及び備品', acquired: '平成30年10月 5日', life: 8, cost: 155000, status: '償却中', opening: 87188, subsidy: 0, method: '定額法', qty: 1 },
  { code: '00006', name: 'うんてい', account: '構築物', acquired: '平成31年 3月31日', life: 5, cost: 432000, status: '償却中', opening: 165600, subsidy: 0, method: '定額法', qty: 1 },
  { code: '00007', name: '門扉', account: '構築物', acquired: '平成31年 3月 6日', life: 10, cost: 342360, status: '償却中', opening: 236799, subsidy: 0, method: '定額法', qty: 1 },
  { code: '00008', name: 'フェンス', account: '構築物', acquired: '平成31年 3月31日', life: 10, cost: 529200, status: '償却中', opening: 366030, subsidy: 0, method: '定額法', qty: 1 },
  { code: '00028', name: '立看板', account: '構築物', acquired: '平成15年 5月 1日', life: 15, cost: 147000, status: '償却中', opening: 5880, subsidy: 0, method: '定額法', qty: 1 },
  { code: '00030', name: '未満児用ソフト滑り台', account: '器具及び備品', acquired: '平成17年 3月25日', life: 5, cost: 120000, status: '償却終了', opening: 1, subsidy: 0, method: '定額法', qty: 1 },
  { code: '00032', name: '給湯器', account: '器具及び備品', acquired: '平成18年 1月 8日', life: 6, cost: 231000, status: '償却終了', opening: 1, subsidy: 0, method: '定額法', qty: 1 },
  { code: '00039', name: '防犯用　街灯設置', account: '構築物', acquired: '平成20年 3月31日', life: 10, cost: 247800, status: '償却終了', opening: 4956, subsidy: 0, method: '定額法', qty: 1 },
  { code: '00040', name: 'ミニパトカー', account: '器具及び備品', acquired: '平成22年 3月 5日', life: 8, cost: 350000, status: '償却終了', opening: 7000, subsidy: 0, method: '定額法', qty: 1 },
  { code: '10001', name: '砂場', account: '構築物', acquired: '昭和54年 2月 1日', life: 10, cost: 200000, status: '償却終了', opening: 1, subsidy: 0, method: '定額法', qty: 1 },
  { code: '10004', name: '土地', account: '土地　－基本財産－', acquired: '昭和54年 4月 1日', life: 0, cost: 5803427, status: '対象外', opening: 5803427, subsidy: 0, method: '減価償却対象外', qty: 1 },
  { code: '20002', name: 'ピアノ', account: '器具及び備品', acquired: '昭和55年 2月 1日', life: 5, cost: 383000, status: '償却終了', opening: 1, subsidy: 0, method: '定額法', qty: 1 },
];
interface Equip { code: string; name: string; acquired: string; cost: number; account?: string; qty?: number; subsidy?: number }
const EQUIPS: Equip[] = [
  { code: '00001', name: 'ノートパソコン（事務室）', acquired: '令和6年 4月10日', cost: 98000, account: '消耗器具備品費', qty: 1, subsidy: 0 },
  { code: '00002', name: '掃除機', acquired: '令和7年 6月 2日', cost: 32800, account: '消耗器具備品費', qty: 1, subsidy: 0 },
];
interface Voucher { name: string; date: string; format: string; proc: string; /** 会計の仕訳伝票に登録した行の id（確認メモ #245） */ ids?: number[] }
interface LogRow { time: string; kind: '資産' | '備品' | 'システム'; code: string; target: string; action: string; user: string }
interface Disposal { code: string; name: string; account: string; proc: string; date: string; amount: number; opening: number; cost: number; subsidy: number; /** 区分を選んで移管したときの移管先（確認メモ #247） */ to?: string }
/** 補助金1件。償還補助金は国庫補助金等の内訳（内数）で、補助金総合計には加算しない（確認メモ #63） */
interface SubsidyRow { name: string; /** 国庫補助金等の額 */ amount: number; /** うち償還補助金の額（amount の内数） */ redeem: number; date: string; /** 会計の伝票から選んだときの伝票No */ src?: string; /** 伝票から選んだときの伝票の金額（登録できる上限） */ max?: number }
/** 会計の国庫補助金の伝票（プロトタイプのサンプル）。redeem＝償還補助金の伝票（設備資金借入金元金償還補助金） */
interface SubsidyVoucher { no: string; date: string; account: string; tekiyo: string; amount: number; redeem: boolean }
const SUBSIDY_VOUCHERS: SubsidyVoucher[] = [
  { no: '5-25', date: '令和8年5月20日', account: '施設整備等補助金収益', tekiyo: '施設整備費補助金（園舎改修）', amount: 5000000, redeem: false },
  { no: '6-31', date: '令和8年6月25日', account: '設備資金借入金元金償還補助金収益', tekiyo: '償還補助金（園舎建設借入金 元金分）', amount: 480000, redeem: true },
  { no: '7-12', date: '令和8年7月10日', account: '施設整備等補助金収益', tekiyo: '施設整備費補助金（空調設備）', amount: 3200000, redeem: false },
  { no: '8-21', date: '令和8年8月18日', account: '施設整備等補助金収益', tekiyo: '施設整備費補助金（調理室改修）', amount: 1650000, redeem: false },
];

/** 国庫補助金の伝票から選ぶ。登録する金額は全額か一部を任意に入力する（確認メモ #255） */
function SubsidyVoucherPicker({ used, onClose, onAdd, accent, toast }: { used: string[]; onClose: () => void; onAdd: (rows: SubsidyRow[]) => void; accent: string; toast: (m: string) => void }) {
  const [sel, setSel] = useState<Record<string, number>>({});
  const on = (v: SubsidyVoucher) => v.no in sel;
  const toggle = (v: SubsidyVoucher) => setSel((m) => { const n = { ...m }; if (v.no in n) delete n[v.no]; else n[v.no] = v.amount; return n; });
  return (
    <Modal open onClose={onClose} width={900} title="国庫補助金の伝票から選ぶ">
      <div style={{ padding: '12px 22px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 14, color: '#5b6773' }}>この固定資産に充てる補助金の伝票を選び、登録する金額を入力します。全額でも一部の金額でも登録できます。</div>
        <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={{ ...TH, width: 36 }} /><th style={TH}>伝票No</th><th style={TH}>日付</th><th style={TH}>科目</th><th style={TH}>摘要</th><th style={{ ...TH, textAlign: 'right' }}>伝票の金額</th><th style={{ ...TH, textAlign: 'right' }}>登録する金額</th></tr></thead>
            <tbody>{SUBSIDY_VOUCHERS.map((v) => {
              const done = used.includes(v.no);
              return (
                <tr key={v.no} data-subsidy-voucher={v.no} style={{ background: on(v) ? '#f4f8f6' : undefined, color: done ? '#9aa5b1' : undefined }}>
                  <td style={TD}><input type="checkbox" checked={on(v)} disabled={done} onChange={() => toggle(v)} aria-label={`伝票 ${v.no} を選ぶ`} /></td>
                  <td style={{ ...TD, fontVariantNumeric: 'tabular-nums' }}>{v.no}</td>
                  <td style={{ ...TD, whiteSpace: 'nowrap' }}>{v.date}</td>
                  <td style={TD}>{v.account}{v.redeem && <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 700, padding: '1px 6px', borderRadius: 6, background: '#eef3fb', color: '#2c5f9e' }}>償還補助金</span>}</td>
                  <td style={TD}>{v.tekiyo}</td>
                  <td style={{ ...TD, ...NUM }}>{yen(v.amount)}</td>
                  <td style={{ ...TD, textAlign: 'right' }}>{done ? <span style={{ fontSize: 12 }}>登録済み</span> : <input className="field-input" data-subsidy-pick-amount value={on(v) ? yen(sel[v.no]) : ''} disabled={!on(v)} onChange={(e) => setSel((m) => ({ ...m, [v.no]: Math.min(numOf(e.target.value), v.amount) }))} inputMode="numeric" placeholder="選ぶと全額" style={{ ...IN_NUM, width: 130 }} />}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
        <div style={{ fontSize: 12, color: '#7a8794' }}>伝票の金額を超えては入力できません。償還補助金の伝票は、うち償還補助金額にも同じ金額が入ります。</div>
        <div style={FOOT}>
          <button type="button" onClick={onClose} style={BTN()}>キャンセル</button>
          <button type="button" className="submit-btn" onClick={() => {
            const picked = SUBSIDY_VOUCHERS.filter((v) => v.no in sel);
            if (!picked.length) return toast('伝票を選んでください');
            if (picked.some((v) => !sel[v.no])) return toast('登録する金額を入力してください');
            onAdd(picked.map((v) => ({ name: v.tekiyo, amount: sel[v.no], redeem: v.redeem ? sel[v.no] : 0, date: v.date, src: v.no, max: v.amount })));
            onClose();
          }} style={BTN(accent, true)}>選んだ伝票を追加</button>
        </div>
      </div>
    </Modal>
  );
}
interface HistoryRow { time: string; file: string; count: number; user: string; result: string }
type RoundMode = '切捨て' | '四捨五入' | '切上げ';
interface Rounding { dep: RoundMode; sub: RoundMode; prorate: RoundMode; digits: '3桁' | '4桁' }
const DEFAULT_ROUNDING: Rounding = { dep: '切捨て', sub: '切捨て', prorate: '切捨て', digits: '3桁' };
const roundBy = (v: number, m: RoundMode) => (m === '四捨五入' ? Math.round(v) : m === '切上げ' ? Math.ceil(v) : Math.floor(v));

const PRINT_REPORTS = ['基本財産及びその他の固定資産（有形・無形固定資産）の明細書', '固定資産管理台帳(新会計版)', '固定資産管理台帳', '個別固定資産管理台帳', '当期変更情報一覧表', '固定資産タックシール', '備品一覧表（1）', '備品一覧表（2）', '固定資産管理台帳（施設設備管理用）', '取得固定資産一覧表', '除却固定資産一覧表', '移管(元)固定資産一覧表', '移管(先)固定資産一覧表', '売却固定資産一覧表'];
/** ホームの機能一覧（会計のホームと同じ形。確認メモ #244） */
const HOME_GROUPS: FunctionGroup[] = [
  { key: 'd-asset', label: '固定資産', note: '', danger: false, items: ['固定資産台帳', '固定資産を登録', '全項目手入力で登録'] },
  { key: 'd-equip', label: '備品', note: '', danger: false, items: ['備品台帳', '備品を登録'] },
  { key: 'd-move', label: '除却・売却・移管', note: '', danger: false, items: ['除却・売却・移管', '移管取込'] },
  { key: 'd-closing', label: '決算', note: '', danger: false, items: ['決算処理（伝票の作成）'] },
  { key: 'd-setting', label: '設定・ログ', note: '', danger: false, items: ['環境設定', '操作ログ'] },
  { key: 'print', label: '帳票', note: '', danger: false, items: PRINT_REPORTS },
];
const FA_ACCOUNTS = ['土地　－基本財産－', '建物　－基本財産－', '建物　－その他－', '構築物', '器具及び備品', '車両運搬具', 'ソフトウェア'];
/** 並び順項目（コード 100〜499 ＋ 名称）。100 の位：1＝基本財産、2＝有形固定資産、3＝無形固定資産、4＝備品（確認メモ #285） */
interface SortItem { code: string; name: string }
const DEFAULT_SORT_ITEMS: SortItem[] = [
  ['101', '土地'], ['102', '建物'], ['201', '土地'], ['202', '建物'], ['203', '構築物'], ['204', '機械及び装置'], ['205', '車輌運搬具'], ['206', '器具及び備品'], ['207', '有形リース資産'],
  ['301', '建設仮勘定'], ['302', '権利'], ['303', 'ソフトウエア'], ['304', '無形リース資産'], ['305', '投資有価証券'], ['306', '長期貸付金'], ['307', '事業区分間長期貸付金'], ['308', '拠点区分間長期貸付金'],
  ['309', '退職給付引当資産'], ['310', '長期預り金積立資産'], ['311', '○○積立資産'], ['312', '差入保証金'], ['313', '長期前払費用'], ['314', 'その他の固定資産'], ['401', '備品'],
].map(([code, name]) => ({ code, name }));
const sortLabel = (it: SortItem) => `${it.code} ${it.name}`;
/** 科目から並び順項目の初期値を選ぶ（基本財産の科目は 1＊＊、それ以外は 2＊＊・3＊＊ の同じ名称） */
const sortFor = (items: SortItem[], account: string) => {
  const base = account.split('　')[0].replace('ソフトウェア', 'ソフトウエア').replace('車両', '車輌');
  const basic = account.includes('基本財産');
  return (items.find((it) => it.name === base && (basic ? it.code.startsWith('1') : !it.code.startsWith('1'))) ?? items[0])?.code ?? '';
};
const CLOSING_ACCOUNTS = ['減価償却費', '国庫補助金等特別積立金取崩額', '国庫補助金等特別積立金', '固定資産除却・廃棄損', '固定資産売却損・処分損', '固定資産売却益', '固定資産受贈額', '建物減価償却累計額', '構築物減価償却累計額', '器具及び備品減価償却累計額', ...FA_ACCOUNTS];
const PICK_ACCOUNTS = Array.from(new Set([...CLOSING_ACCOUNTS, ...ACCOUNT_META.map((m) => m.name)]));
const CLOSING_SUMMARIES = ['当期減価償却', '国庫補助金等特別積立金取崩', '固定資産除却', '固定資産売却', '移管（元）による減少', '移管（先）による増加', ...SUMMARIES];
const LIFE_DICT: { cat: string; name: string; life: number; account: string }[] = [
  { cat: '建物', name: '鉄筋コンクリート造（園舎・事務所）', life: 47, account: '建物　－基本財産－' },
  { cat: '建物', name: '鉄骨造（骨格材 4mm超）', life: 34, account: '建物　－基本財産－' },
  { cat: '建物', name: '鉄骨造（骨格材 3〜4mm）', life: 27, account: '建物　－基本財産－' },
  { cat: '建物', name: '木造・合成樹脂造', life: 22, account: '建物　－基本財産－' },
  { cat: '建物', name: '木造モルタル造', life: 20, account: '建物　－基本財産－' },
  { cat: '建物附属設備', name: '電気設備・給排水・衛生設備', life: 15, account: '建物　－その他－' },
  { cat: '建物附属設備', name: '冷暖房設備（22kW以下）', life: 13, account: '建物　－その他－' },
  { cat: '構築物', name: '金属造の門扉・フェンス', life: 10, account: '構築物' },
  { cat: '構築物', name: '遊具（金属造）', life: 10, account: '構築物' },
  { cat: '構築物', name: '遊具（木造）・砂場', life: 5, account: '構築物' },
  { cat: '構築物', name: '舗装路面（アスファルト）', life: 10, account: '構築物' },
  { cat: '構築物', name: '看板・街灯（金属造）', life: 10, account: '構築物' },
  { cat: '器具及び備品', name: 'エアコン（器具備品扱い）', life: 6, account: '器具及び備品' },
  { cat: '器具及び備品', name: '事務机・椅子・キャビネット（金属製）', life: 15, account: '器具及び備品' },
  { cat: '器具及び備品', name: '事務机・椅子・下駄箱（木製）', life: 8, account: '器具及び備品' },
  { cat: '器具及び備品', name: 'パソコン', life: 4, account: '器具及び備品' },
  { cat: '器具及び備品', name: 'サーバー・複合機', life: 5, account: '器具及び備品' },
  { cat: '器具及び備品', name: '冷蔵庫・洗濯機・給湯器', life: 6, account: '器具及び備品' },
  { cat: '器具及び備品', name: 'テレビ・音響機器・ピアノ', life: 5, account: '器具及び備品' },
  { cat: '器具及び備品', name: '消毒保管庫・調理器具', life: 5, account: '器具及び備品' },
  { cat: '器具及び備品', name: 'カーテン・じゅうたん', life: 3, account: '器具及び備品' },
  { cat: '車両運搬具', name: '小型自動車（総排気量0.66L以下）', life: 4, account: '車両運搬具' },
  { cat: '車両運搬具', name: '普通自動車・送迎バス', life: 6, account: '車両運搬具' },
  { cat: '無形固定資産', name: 'ソフトウェア', life: 5, account: 'ソフトウェア' },
];
const INITIAL_LOGS: LogRow[] = [
  { time: '2026/04/01 09:12:05', kind: 'システム', code: '', target: 'ログイン', action: 'ログイン', user: USER },
  { time: '2026/04/01 09:15:40', kind: 'システム', code: '', target: '動作環境設定', action: '登録（償却方法：定額法）', user: USER },
  ...ASSETS.map((a): LogRow => ({ time: '2026/07/13 16:02:16', kind: '資産', code: a.code, target: `${Number(a.code)}:${a.name}`, action: 'C24へコンバート', user: 'システム' })),
  ...EQUIPS.map((e): LogRow => ({ time: '2026/07/13 16:02:20', kind: '備品', code: e.code, target: `${Number(e.code)}:${e.name}`, action: 'C24へコンバート', user: 'システム' })),
  { time: '2026/07/13 16:05:02', kind: 'システム', code: '', target: '固定資産管理台帳', action: '帳票印刷', user: USER },
];

interface Props {
  variant: 'form' | 'sheet';
  accent: string;
}

type Tab = 'home' | 'assets' | 'equips' | 'disposal' | 'closing' | 'transfer';
const TABS: { key: Tab; label: string; hint: string }[] = [
  { key: 'home', label: '機能一覧', hint: '機能の一覧と、固定資産の概要' },
  { key: 'assets', label: '固定資産台帳', hint: '登録・変更・削除、経年の確認' },
  { key: 'equips', label: '備品台帳', hint: '少額備品の登録・一覧' },
  { key: 'disposal', label: '除却・売却・移管', hint: '複数資産をまとめて処理' },
  { key: 'closing', label: '決算処理', hint: '減価償却の仕訳伝票を作成' },
  { key: 'transfer', label: '移管取込', hint: '移管（元）ファイルの読込' },
];
const STATUS_COLOR: Record<Asset['status'], [string, string]> = { 償却中: ['#eaf5ef', '#1f7a52'], 償却終了: ['#fff1b8', '#8a6d00'], 対象外: ['#f1f4f6', '#7a8794'], 移管取込: ['#e8f0fb', '#2c5f9e'], 移管年度: ['#f3e8fb', '#6b3fa0'] };
const statusStyle = (st: Asset['status']): CSSProperties => ({ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: STATUS_COLOR[st][0], color: STATUS_COLOR[st][1], whiteSpace: 'nowrap' });
/** 経年表示の切替。減価償却・国庫補助金は帳簿価額の推移、償還補助金は未入金額の推移（確認メモ #65） */
const YR_TABS = ['数量／減価償却', '国庫補助金', '償還補助金'] as const;
type YrTab = (typeof YR_TABS)[number];
/** 全項目手入力の 1 年度ぶん。a〜d は 期首帳簿価額・当期増加額・当期減価償却額・当期減少額（償還補助金は a＝期首未入金額、b＝当期入金額）（確認メモ #62） */
interface MRow { a: number; b: number; c: number; d: number }
const MAX_YEARS = 80;
/** 当期の年度（令和8年度） */
const THIS_FY = 2026;
const ERA_BASE: Record<string, number> = { 昭和: 1925, 平成: 1988, 令和: 2018 };
/** 和暦の年月日 → 年度（4月始まり）。読み取れなければ null */
const fiscalYearOf = (s: string) => { const m = s.match(/(昭和|平成|令和)\s*(元|\d+)\s*年\s*(\d+)\s*月/); if (!m) return null; const y = ERA_BASE[m[1]] + (m[2] === '元' ? 1 : Number(m[2])); return Number(m[3]) <= 3 ? y - 1 : y; };
const fyLabel = (y: number) => { const [era, base] = y >= 2019 ? ['令和', 2018] as const : y >= 1989 ? ['平成', 1988] as const : ['昭和', 1925] as const; return `${era}${y - base === 1 ? '元' : y - base}年度`; };
/** 償却を開始する年度（償却開始年月日があればその年度、なければ取得した年度。確認メモ #248） */
const depStartFy = (a: Asset) => (a.depStart ? fiscalYearOf(a.depStart) : null) ?? fiscalYearOf(a.acquired) ?? THIS_FY;
/** 取得した年度。償却開始年月日を使うときも、経年表示は取得した年度から並べる（確認メモ #259） */
const acqFy = (a: Asset) => fiscalYearOf(a.acquired) ?? THIS_FY;
/** 取得した年度から償却を開始する年度までの年数。この間は当期増加額だけが入り、当期減価償却額は 0 円（確認メモ #259） */
const depLag = (a: Asset) => Math.max(0, depStartFy(a) - acqFy(a));
/** 償却方法（確認メモ #258） */
const METHODS = ['定額法', '旧定額法', '旧定額法（備忘）', 'リース定額法', '減価償却対象外'];
/** 償却計算表で直接編集できる金額（取得価額の行の A〜D と、国庫補助金等の行の A〜D） */
type CalcKey = 'A' | 'B' | 'C' | 'D' | 'sA' | 'sB' | 'sC' | 'sD';
const blankRows = (): MRow[] => Array.from({ length: MAX_YEARS }, () => ({ a: 0, b: 0, c: 0, d: 0 }));
/** 期末帳簿価額（償還補助金は期末未入金額） */
const endOf = (r: MRow, redeemTab: boolean) => (redeemTab ? r.a - r.b : r.a + r.b - r.c - r.d);
// 見出しは2行に分けて表示する（列の幅を金額に合わせるため）
const YR_HEAD_BOOK = ['年度', '期首\n帳簿価額', '当期\n増加額', '当期\n減価償却額', '当期\n減少額', '期末\n帳簿価額', '減価償却\n累計額', '期末\n取得原価'];
const YR_HEAD_REDEEM = ['年度', '期首\n未入金額', '当期\n入金額', '期末\n未入金額'];
const annualOf = (a: Asset) => (a.life && a.method !== '減価償却対象外' ? Math.min(Math.floor((a.cost - 1) / a.life), Math.max(0, a.opening - 1)) : 0);
const isNewThisYear = (a: Asset) => a.acquired.startsWith('令和8') || !!a.transferIn;

/* ================= 帳票の組み立て（ExportDialog に渡す表データ） ================= */
interface ReportCtx { assets: Asset[]; equips: Equip[]; disposals: Disposal[]; logs: LogRow[]; single?: Asset; /** 印刷の詳細設定（確認メモ #251） */ opts?: DepValues }
const H_LEDGER = ['資産コード', '固定資産名称', '科目', '取得年月日', '耐用年数', '償却方法', '取得価額', 'うち国庫補助金等', '期首帳簿価額', '当期減価償却額', '期末帳簿価額', '状態'];
const ledgerRow = (a: Asset): (string | number)[] => { const d = annualOf(a); return [a.code, a.name, a.account, a.acquired, a.life || '—', a.method, a.cost, a.subsidy, a.opening, d, a.opening - d, a.status]; };
const H_SUMMARY = ['科目', '期首帳簿価額', '当期増加額', '当期減少額', '当期減価償却額', '期末帳簿価額', '減価償却累計額', '期末取得原価'];
function accountSummary(assets: Asset[], disposals: Disposal[]): (string | number)[][] {
  const accs = Array.from(new Set(assets.map((a) => a.account)));
  const rows = accs.map((acc): (string | number)[] => {
    let open = 0, inc = 0, dep = 0, cost = 0;
    assets.filter((a) => a.account === acc).forEach((a) => { const n = isNewThisYear(a); open += n ? 0 : a.opening; inc += n ? a.cost : 0; dep += annualOf(a); cost += a.cost; });
    const dec = disposals.filter((d) => d.account === acc).reduce((s, d) => s + d.opening, 0);
    const end = open + inc - dep - dec;
    return [acc, open, inc, dec, dep, end, cost - end, cost];
  });
  const tot: (string | number)[] = ['合計', 0, 0, 0, 0, 0, 0, 0];
  rows.forEach((r) => r.forEach((v, i) => { if (i > 0) tot[i] = (tot[i] as number) + (v as number); }));
  return [...rows, tot];
}
// 経年表示は「〇年目」ではなく、償却を開始する年度から年度で表示する（確認メモ #248）
const H_SCHEDULE = ['年度', '期首帳簿価額', '当期減価償却額', '期末帳簿価額', '減価償却累計額'];
function scheduleRows(a: Asset): (string | number)[][] {
  const rows: (string | number)[][] = [];
  if (!a.life || a.method === '減価償却対象外') return rows;
  let bal = a.cost;
  const fy0 = Math.min(acqFy(a), depStartFy(a));
  const lag = depLag(a);
  for (let y = 0; y < lag; y++) rows.push([fyLabel(fy0 + y), bal, 0, bal, 0]);
  for (let y = 1; y <= Math.min(a.life, 60); y++) { const d = Math.min(Math.floor((a.cost - 1) / a.life), Math.max(0, bal - 1)); rows.push([fyLabel(fy0 + lag + y - 1), bal, d, bal - d, a.cost - (bal - d)]); bal -= d; }
  return rows;
}
const H_DISPOSAL = ['資産コード', '固定資産名称', '科目', '処理', '処分年月日', '取得価額', '期首帳簿価額', 'うち国庫補助金等', '処分額または売却額', '移管先'];
const disposalRow = (d: Disposal): (string | number)[] => [d.code, d.name, d.account, d.proc, d.date, d.cost, d.opening, d.subsidy, d.amount, d.to ?? ''];
/** 和暦の年月日 → 並べ替え用の数（読み取れなければ 0） */
const dateKey = (s: string) => { const m = String(s).match(/(昭和|平成|令和)\s*(元|\d+)\s*年\s*(\d+)\s*月\s*(\d+)?/); return m ? (ERA_BASE[m[1]] + (m[2] === '元' ? 1 : Number(m[2]))) * 10000 + Number(m[3]) * 100 + Number(m[4] ?? 1) : 0; };
/** 帳票の表に詳細設定を反映する（タイトル・印刷順序・償却方法の印字・集計期間。確認メモ #251） */
function buildReport(name: string, ctx: ReportCtx): ExportSpec {
  const spec = buildReportBase(name, ctx);
  const o = ctx.opts;
  if (!o) return spec;
  const h = spec.header ?? [];
  let rows = spec.rows ?? [];
  const iCode = h.indexOf('資産コード'), iDate = h.indexOf('取得年月日'), iMethod = h.indexOf('償却方法');
  if (o.order === '資産コード順' && iCode >= 0) rows = [...rows].sort((a, b) => String(a[iCode]).localeCompare(String(b[iCode])));
  if (o.order === '取得日付順' && iDate >= 0) rows = [...rows].sort((a, b) => dateKey(String(a[iDate])) - dateKey(String(b[iDate])));
  if (o.method !== undefined && iMethod >= 0) rows = rows.map((r) => r.map((c, i) => (i === iMethod ? printMethod(String(c), o.method) : c)));
  const title = String(o.title ?? '').trim();
  const period = o.periodOn ? '　集計期間 ' + o.periodFrom + '〜' + o.periodTo : '';
  return { ...spec, title: title || spec.title, rows, meta: (spec.meta ?? '') + period };
}
function buildReportBase(name: string, ctx: ReportCtx): ExportSpec {
  const { assets, equips, disposals, logs, single } = ctx;
  const base = { kind: 'print' as const, title: name, meta: 'チャイルド保育園　令和8年度' };
  switch (name) {
    case '基本財産及びその他の固定資産（有形・無形固定資産）の明細書':
    case '別紙３(⑧)':
      return { ...base, header: H_SUMMARY, rows: accountSummary(single ? assets.filter((a) => a.account === single.account) : assets, disposals) };
    case '固定資産管理台帳（施設設備管理用）':
      return { ...base, header: ['資産コード', '固定資産名称', '科目', '取得年月日', '数量', '場所・物量等', '使用目的', '取得価額'], rows: assets.map((a) => [a.code, a.name, a.account, a.acquired, a.qty, a.place ?? '', a.purpose ?? '', a.cost]) };
    case '個別固定資産管理台帳':
      if (single) return { ...base, meta: `${single.code} ${single.name}（${single.account}）　取得 ${single.acquired}　取得価額 ${yen(single.cost)}　${single.method}／${single.life || '—'}年`, header: H_SCHEDULE, rows: scheduleRows(single) };
      return { ...base, header: H_LEDGER, rows: assets.map(ledgerRow) };
    case '当期変更情報一覧表':
      return { ...base, header: ['日時', '資産コード', '対象', '操作', '担当者'], rows: logs.filter((l) => l.kind === '資産').map((l) => [l.time, l.code, l.target, l.action, l.user]) };
    case '固定資産タックシール':
      return { ...base, header: ['資産コード', '固定資産名称', '取得年月日', '場所・物量等', '管理者'], rows: assets.map((a) => [a.code, a.name, a.acquired, a.place ?? '', 'チャイルド保育園']) };
    case '備品一覧表（1）':
    case '備品一覧表(1)':
      return { ...base, header: ['備品コード', '備品名称', '取得年月日', '数量', '取得価額'], rows: equips.map((e) => [e.code, e.name, e.acquired, e.qty ?? 1, e.cost]) };
    case '備品一覧表（2）':
    case '備品一覧表(2)':
      return { ...base, header: ['備品コード', '備品名称', '科目', '取得年月日', '取得価額', 'うち補助金'], rows: equips.map((e) => [e.code, e.name, e.account ?? '', e.acquired, e.cost, e.subsidy ?? 0]) };
    case '取得固定資産一覧表':
      return { ...base, header: H_LEDGER, rows: assets.filter((a) => a.acquired.startsWith('令和8') && !a.transferIn).map(ledgerRow) };
    case '除却固定資産一覧表':
      return { ...base, header: H_DISPOSAL, rows: disposals.filter((d) => d.proc === '除却').map(disposalRow) };
    case '売却固定資産一覧表':
      return { ...base, header: H_DISPOSAL, rows: disposals.filter((d) => d.proc === '売却').map(disposalRow) };
    case '移管(元)固定資産一覧表':
      return { ...base, header: H_DISPOSAL, rows: disposals.filter((d) => d.proc === '移管(元)').map(disposalRow) };
    case '移管(先)固定資産一覧表':
      return { ...base, header: H_LEDGER, rows: assets.filter((a) => a.transferIn).map(ledgerRow) };
    default:
      return { ...base, header: H_LEDGER, rows: assets.map(ledgerRow) };
  }
}

/* ================= 共通の小さなダイアログ ================= */
const IN: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '7px 10px', border: '1px solid #cfd8e0', borderRadius: 7, fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#fff', color: '#22303c' };
const IN_NUM: CSSProperties = { ...IN, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
const LBL: CSSProperties = { fontSize: 12, fontWeight: 700, color: '#8290a0', marginBottom: 4, display: 'block' };
const BTN = (color = '#5b6773', solid = false): CSSProperties => ({ padding: '7px 12px', borderRadius: 7, border: '1px solid ' + (solid ? color : '#cfd8e0'), background: solid ? color : '#fff', color: solid ? '#fff' : color, fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' });
const FOOT: CSSProperties = { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 };
const noIme = (e: KeyboardEvent) => e.nativeEvent.isComposing || (e.nativeEvent as unknown as { keyCode: number }).keyCode === 229;

/** 科目・摘要などの選択リスト（検索付き） */
function PickerModal({ title, items, current, onPick, onClose, accent, matcher, allowFree, placeholder }: { title: string; items: string[]; current: string; onPick: (v: string) => void; onClose: () => void; accent: string; matcher?: (name: string, q: string) => boolean; allowFree?: boolean; placeholder?: string }) {
  const [q, setQ] = useState('');
  const list = items.filter((n) => (matcher ? matcher(n, q) : !q || n.includes(q)));
  return (
    <Modal open onClose={onClose} width={520} title={title}>
      <div style={{ padding: '12px 22px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input className="search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder ?? '名称で検索'} autoComplete="off" autoFocus onKeyDown={(e) => { if (e.key === 'Enter' && !noIme(e) && allowFree && q.trim()) { onPick(q.trim()); onClose(); } }} style={IN} />
        <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, maxHeight: 320, overflow: 'auto' }}>
          {list.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#9aa5b1', fontSize: 14 }}>該当する項目がありません。</div>}
          {list.map((n) => { const on = n === current; return <button key={n} type="button" className="menu-sub" onClick={() => { onPick(n); onClose(); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', borderBottom: '1px solid #f1f4f6', background: on ? '#eef2f6' : '#fff', color: on ? accent : '#22303c', fontSize: 14, fontWeight: on ? 700 : 500, fontFamily: 'inherit', cursor: 'pointer' }}>{n}{on && <span style={{ marginLeft: 8, fontSize: 12 }}>（現在）</span>}</button>; })}
        </div>
        {allowFree && <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, color: '#7a8794' }}><span>一覧にない場合は入力した文字をそのまま使えます</span><button type="button" className="btn-outline" disabled={!q.trim()} onClick={() => { onPick(q.trim()); onClose(); }} style={{ ...BTN(accent, true), marginLeft: 'auto', opacity: q.trim() ? 1 : 0.5 }}>「{q.trim() || '　'}」を使用</button></div>}
      </div>
    </Modal>
  );
}

/** 取込み履歴／出力履歴 */
function HistoryModal({ open, title, rows, onClose }: { open: boolean; title: string; rows: HistoryRow[]; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} width={720} title={title}>
      <div style={{ padding: '12px 22px 18px' }}>
        <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, overflow: 'auto', maxHeight: 380 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={TH}>日時</th><th style={TH}>ファイル名</th><th style={{ ...TH, textAlign: 'right' }}>件数</th><th style={TH}>担当者</th><th style={TH}>結果</th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={5} style={{ ...TD, textAlign: 'center', color: '#9aa5b1', padding: 30 }}>履歴はありません。</td></tr>}
              {[...rows].reverse().map((r, i) => <tr key={i}><td style={{ ...TD, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{r.time}</td><td style={{ ...TD, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 14 }}>{r.file}</td><td style={NUM}>{r.count}</td><td style={TD}>{r.user}</td><td style={TD}><span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: r.result.startsWith('正常') ? '#eaf5ef' : '#fdeee9', color: r.result.startsWith('正常') ? '#1f7a52' : '#c0392b' }}>{r.result}</span></td></tr>)}
            </tbody>
          </table>
        </div>
        <div style={{ ...FOOT, marginTop: 12 }}><button type="button" onClick={onClose} style={BTN()}>閉じる</button></div>
      </div>
    </Modal>
  );
}

/** 資産画像／備品画像（ファイル選択 → FileReader でプレビュー。アップロードはしない） */
function ImageModal({ open, title, src, onClose, onChange, accent, toast }: { open: boolean; title: string; src?: string; onClose: () => void; onChange: (src: string | null) => void; accent: string; toast: (m: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const pick = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast('画像ファイル（JPEG／PNG など）を選択してください');
    if (file.size > 5 * 1024 * 1024) return toast('画像は 5MB 以下にしてください');
    const r = new FileReader();
    r.onload = () => { onChange(String(r.result)); setName(file.name); toast('画像を添付しました'); };
    r.readAsDataURL(file);
  };
  return (
    <Modal open={open} onClose={onClose} width={560} title={title}>
      <div style={{ padding: '12px 22px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
        <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0]); }} onClick={() => !src && fileRef.current?.click()} style={{ border: '2px dashed ' + (src ? '#e2e8ee' : '#cfd8e0'), borderRadius: 12, minHeight: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafbfc', cursor: src ? 'default' : 'pointer', overflow: 'hidden' }}>
          {src ? <img src={src} alt={title} style={{ maxWidth: '100%', maxHeight: 340, objectFit: 'contain' }} /> : <div style={{ textAlign: 'center', color: '#7a8794', fontSize: 14, lineHeight: 1.8 }}>ここに画像をドロップ、またはクリックして選択<br /><span style={{ fontSize: 12, color: '#9aa5b1' }}>JPEG／PNG／GIF　5MB まで</span></div>}
        </div>
        {name && <div style={{ fontSize: 14, color: '#7a8794' }}>ファイル：{name}</div>}
        <Notice>画像はこの画面内でのみ保持します（本番ではサーバーに保存し、固定資産タックシール等に印字できます）。</Notice>
        <div style={FOOT}>
          {src && <button type="button" className="btn-outline" onClick={() => { if (confirm('添付した画像を削除しますか？')) { onChange(null); setName(''); toast('画像を削除しました'); } }} style={{ ...BTN('#c0392b'), marginRight: 'auto' }}>削除</button>}
          <button type="button" className="btn-outline" onClick={() => fileRef.current?.click()} style={BTN(accent, true)}>{src ? '画像を差し替え' : '画像を選択'}</button>
          <button type="button" onClick={onClose} style={BTN()}>閉じる</button>
        </div>
      </div>
    </Modal>
  );
}

/** 耐用年数 辞書（資産の種類から耐用年数を選ぶ） */
function LifeDictModal({ onClose, onPick, accent }: { onClose: () => void; onPick: (item: { life: number; account: string }) => void; accent: string }) {
  const [q, setQ] = useState('');
  const list = LIFE_DICT.filter((d) => !q || d.name.includes(q) || d.cat.includes(q) || d.account.includes(q));
  const cats = Array.from(new Set(list.map((d) => d.cat)));
  return (
    <Modal open onClose={onClose} width={620} title="耐用年数 辞書">
      <div style={{ padding: '12px 22px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input className="search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="資産の種類・科目で検索（例：エアコン、木造）" autoComplete="off" autoFocus style={IN} />
        <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, maxHeight: 380, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={TH}>資産の種類</th><th style={TH}>科目</th><th style={{ ...TH, textAlign: 'right' }}>耐用年数</th><th style={{ ...TH, width: 70 }} /></tr></thead>
            <tbody>
              {list.length === 0 && <tr><td colSpan={4} style={{ ...TD, textAlign: 'center', color: '#9aa5b1', padding: 30 }}>該当する項目がありません。</td></tr>}
              {cats.map((c) => (
                <Fragment key={c}>
                  <tr><td colSpan={4} style={{ ...TD, fontWeight: 700, background: '#f8fafc', fontSize: 14 }}>{c}</td></tr>
                  {list.filter((d) => d.cat === c).map((d) => <tr key={d.name} className="menu-sub" onClick={() => { onPick(d); onClose(); }} style={{ cursor: 'pointer' }}><td style={{ ...TD, paddingLeft: 24 }}>{d.name}</td><td style={{ ...TD, color: '#48565f' }}>{d.account}</td><td style={{ ...NUM, fontWeight: 700 }}>{d.life} 年</td><td style={{ ...TD, textAlign: 'right' }}><span style={{ ...BTN(accent, true), padding: '3px 10px', fontSize: 12 }}>選択</span></td></tr>)}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <Notice>減価償却資産の耐用年数等に関する省令（別表）に基づくサンプルです。選択すると耐用年数と科目を入力欄にセットします。</Notice>
      </div>
    </Modal>
  );
}

/** 端数処理設定 */
function RoundingModal({ value, onClose, onSave, accent }: { value: Rounding; onClose: () => void; onSave: (r: Rounding) => void; accent: string }) {
  const [r, setR] = useState<Rounding>(value);
  const radios = (key: 'dep' | 'sub' | 'prorate') => (['切捨て', '四捨五入', '切上げ'] as RoundMode[]).map((m) => <label key={m} style={{ display: 'inline-flex', gap: 5, alignItems: 'center', fontSize: 14, marginRight: 14 }}><input type="radio" name={'rnd-' + key} checked={r[key] === m} onChange={() => setR({ ...r, [key]: m })} />{m}</label>);
  return (
    <Modal open onClose={onClose} width={560} title="端数処理設定">
      <div style={{ padding: '12px 22px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><span style={LBL}>当期減価償却額の端数</span>{radios('dep')}</div>
        <div><span style={LBL}>国庫補助金等取崩額の端数</span>{radios('sub')}</div>
        <div><span style={LBL}>月按分（除却・移管・期中取得）の端数</span>{radios('prorate')}</div>
        <div><span style={LBL}>償却率の小数桁数</span>{(['3桁', '4桁'] as const).map((d) => <label key={d} style={{ display: 'inline-flex', gap: 5, alignItems: 'center', fontSize: 14, marginRight: 14 }}><input type="radio" name="rnd-digits" checked={r.digits === d} onChange={() => setR({ ...r, digits: d })} />{d}</label>)}</div>
        <Notice>この設定は選択中の固定資産にだけ適用されます。全体の既定は「環境設定 › 端数処理その他設定」で行います。</Notice>
        <div style={FOOT}><button type="button" onClick={onClose} style={BTN()}>キャンセル</button><button type="button" className="submit-btn" onClick={() => { onSave(r); onClose(); }} style={BTN(accent, true)}>設定</button></div>
      </div>
    </Modal>
  );
}

/** 補助金設定（複数の補助金の内訳）。行は会計の国庫補助金の伝票を選んで追加する（手入力の行追加はしない。確認メモ #277） */
function SubsidyModal({ rows, cost, onClose, onSave, accent, toast }: { rows: SubsidyRow[]; cost: number; onClose: () => void; onSave: (rows: SubsidyRow[]) => void; accent: string; toast: (m: string) => void }) {
  const [rs, setRs] = useState<SubsidyRow[]>(rows);
  const [pick, setPick] = useState(false);
  const upd = (i: number, p: Partial<SubsidyRow>) => setRs((a) => a.map((r, k) => (k === i ? { ...r, ...p } : r)));
  const total = rs.reduce((s, r) => s + r.amount, 0);
  const redeem = rs.reduce((s, r) => s + r.redeem, 0);
  return (
    <Modal open onClose={onClose} width={940} title="補助金設定">
      <div style={{ padding: '12px 22px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={TH}>補助金名称</th><th style={{ ...TH, textAlign: 'right' }}>国庫補助金等の額</th><th style={{ ...TH, textAlign: 'right' }}>うち償還補助金額</th><th style={TH}>交付年月日</th><th style={{ ...TH, width: 60 }} /></tr></thead>
            <tbody>
              {rs.map((r, i) => <tr key={i}>
                <td style={{ ...TD, minWidth: 300 }}>{r.src ? <><div style={{ fontSize: 14, fontWeight: 700 }}>{r.name}</div><div data-sub-src style={{ fontSize: 12, color: '#7a8794', marginTop: 2 }}>伝票 {r.src} から（伝票の金額 {yen(r.max ?? 0)}）</div></> : <input className="field-input" value={r.name} onChange={(e) => upd(i, { name: e.target.value })} style={IN} />}</td>
                <td style={TD}><input className="field-input" data-sub-amount value={r.amount ? yen(r.amount) : ''} onChange={(e) => { const a = Math.min(numOf(e.target.value), r.max ?? Infinity); upd(i, { amount: a, redeem: Math.min(r.redeem, a) }); }} inputMode="numeric" placeholder="0" style={{ ...IN_NUM, width: 130 }} /></td>
                <td style={TD}><input className="field-input" data-sub-redeem value={r.redeem ? yen(r.redeem) : ''} onChange={(e) => upd(i, { redeem: Math.min(numOf(e.target.value), r.amount) })} inputMode="numeric" placeholder="0" title="国庫補助金等の額のうち、償還補助金にあたる額（国庫補助金等の額を超えては入力できません）" style={{ ...IN_NUM, width: 130 }} /></td>
                <td style={{ ...TD, whiteSpace: 'nowrap' }}>{r.src ? <span style={{ fontSize: 14 }}>{r.date}</span> : <WarekiDate value={r.date} onChange={(v) => upd(i, { date: v })} accent={accent} />}</td>
                <td style={TD}><button type="button" className="btn-outline" onClick={() => setRs((a) => a.filter((_, k) => k !== i))} style={{ ...BTN('#c0392b'), padding: '4px 8px', fontSize: 12 }}>削除</button></td>
              </tr>)}
              {rs.length === 0 && <tr><td colSpan={5} data-sub-empty style={{ ...TD, textAlign: 'center', color: '#7a8794', padding: '22px 10px' }}>補助金はまだありません。「国庫補助金の伝票から選ぶ」で会計の伝票を選ぶと、ここに行が追加されます。</td></tr>}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14 }}>
          <button type="button" className="btn-outline" data-subsidy-pick onClick={() => setPick(true)} style={BTN()}>国庫補助金の伝票から選ぶ</button>
          <span style={{ marginLeft: 'auto' }}>補助金総合計 <b style={{ fontSize: 14 }} data-sub-total>{yen(total)}</b>　（うち償還補助金 <b data-sub-redeem-total>{yen(redeem)}</b>）</span>
        </div>
        <div style={{ fontSize: 12, color: '#7a8794', lineHeight: 1.7 }}>補助金は会計の国庫補助金の伝票を選んで追加します。金額は伝票の金額までの範囲で一部に変えられます。補助金総合計は「国庫補助金等の額」の合計です。償還補助金は国庫補助金等の内訳のため、総合計には加算しません。</div>
        {pick && <SubsidyVoucherPicker accent={accent} toast={toast} used={rs.map((r) => r.src ?? '').filter(Boolean)} onClose={() => setPick(false)} onAdd={(add) => setRs((a) => [...a.filter((r) => r.amount > 0 || r.name || r.src), ...add])} />}
        {cost > 0 && total > cost && <Notice tone="warn">補助金の合計が取得価額（{yen(cost)}）を超えています。</Notice>}
        <div style={FOOT}><button type="button" onClick={onClose} style={BTN()}>キャンセル</button><button type="button" className="submit-btn" onClick={() => { if (cost > 0 && total > cost) return toast('補助金の合計が取得価額を超えています'); onSave(rs.filter((r) => r.amount > 0 || r.name).map((r) => ({ ...r, redeem: Math.min(r.redeem, r.amount) }))); onClose(); }} style={BTN(accent, true)}>設定</button></div>
      </div>
    </Modal>
  );
}

interface PartialDisposal { proc: string; qty: number; date: string; amount: number; /** 処分額（当期減少額）。未指定は帳簿価額を数量で按分した額 */ decrease?: number }
/** 一部 除却／売却／移管(元)（数量の一部を処分する）。処分額（当期減少額）を入れると、処分後の金額をプレビューで確かめられる（確認メモ #256） */
function PartialModal({ qty, cost, vals, value, onClose, onApply, accent, toast }: { qty: number; cost: number; vals: { A: number; B: number; C: number }; value: PartialDisposal | null; onClose: () => void; onApply: (p: PartialDisposal | null) => void; accent: string; toast: (m: string) => void }) {
  const [p, setP] = useState<PartialDisposal>(value ?? { proc: '除却', qty: qty > 1 ? 1 : qty, date: waToday(), amount: 0 });
  const ratio = qty ? p.qty / qty : 0;
  const book = vals.A + vals.B - vals.C;
  const partCost = Math.floor(cost * ratio);
  const partBook = Math.floor(book * ratio);
  const dec = p.decrease ?? partBook;
  const sale = p.proc === '売却';
  // 処分後の金額（期末取得原価は処分した数量の取得原価を除く）
  const E = book - dec;
  const G = cost - partCost;
  const F = G - E;
  const head = ['期首帳簿価額', '当期増加額', '当期減価償却額', '当期減少額', '期末帳簿価額', '減価償却累計額', '期末取得原価'];
  const vs = [vals.A, vals.B, vals.C, dec, E, F, G];
  return (
    <Modal open onClose={onClose} width={880} title="一部 除却／売却／移管(元)">
      <div style={{ padding: '12px 22px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${sale ? 5 : 4}, minmax(0,1fr))`, gap: 10 }}>
          <div><span style={LBL}>処理</span><select value={p.proc} onChange={(e) => setP({ ...p, proc: e.target.value })} style={IN}>{['除却', '売却', '移管(元)'].map((o) => <option key={o}>{o}</option>)}</select></div>
          <div><span style={LBL}>処分年月日</span><WarekiDate value={p.date} onChange={(v) => setP({ ...p, date: v })} accent={accent} /></div>
          <div><span style={LBL}>処分数量（登録数量 {qty}）</span><input className="field-input" value={p.qty || ''} onChange={(e) => setP({ ...p, qty: Math.min(qty, numOf(e.target.value)) })} inputMode="numeric" style={IN_NUM} /></div>
          <div><span style={LBL}>処分額（当期減少額）</span><input className="field-input" data-partial-decrease value={yen(dec)} onChange={(e) => setP({ ...p, decrease: numOf(e.target.value) })} onFocus={(e) => e.target.select()} inputMode="numeric" title="入力した金額が当期減少額になります。最初は帳簿価額を処分数量で按分した額が入っています" style={{ ...IN_NUM, background: p.decrease != null ? '#fffbea' : '#fff' }} /></div>
          {sale && <div><span style={LBL}>売却額</span><input className="field-input" value={p.amount ? yen(p.amount) : ''} onChange={(e) => setP({ ...p, amount: numOf(e.target.value) })} inputMode="numeric" placeholder="0" style={IN_NUM} /></div>}
        </div>
        <div data-partial-preview style={{ border: '1px solid #e2e8ee', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '6px 10px', fontSize: 12, fontWeight: 700, color: '#5b6773', background: '#fafbfc', borderBottom: '1px solid #e2e8ee' }}>処分後の金額（プレビュー）　処分割合 {(ratio * 100).toFixed(1)}%・処分する取得価額 {yen(partCost)}</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead><tr>{head.map((h) => <th key={h} style={{ ...TH, padding: '6px 6px', fontSize: 12, textAlign: 'right', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
            <tbody><tr>{vs.map((v, i) => <td key={i} style={{ ...NUM, padding: '7px 6px', fontSize: 14, fontWeight: i === 3 || i === 4 ? 700 : 400, background: i === 3 ? '#fffbea' : undefined, color: v < 0 ? '#c0392b' : undefined }}>{yen(v)}</td>)}</tr></tbody>
          </table>
        </div>
        {dec !== partBook && <div data-partial-diff style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 12, padding: '6px 10px', borderRadius: 8, background: F < 0 ? '#fdeee9' : '#fff7e6', color: F < 0 ? '#b03a2e' : '#8a5a00' }}>
          <span>帳簿価額を処分数量で按分した額は {yen(partBook)} です。{F < 0 ? '処分額がこれより少ないため、減価償却累計額がマイナスになります。' : ''}</span>
          <button type="button" onClick={() => setP({ ...p, decrease: undefined })} style={{ ...BTN(), padding: '3px 10px', fontSize: 12, marginLeft: 'auto' }}>按分した額に戻す</button>
        </div>}
        {sale && <div style={{ fontSize: 14 }}>売却損益 <b style={{ color: p.amount - dec >= 0 ? '#1f7a52' : '#c0392b' }}>{yen(p.amount - dec)}</b>（売却額 − 処分額）</div>}
        <div style={{ fontSize: 12, color: '#7a8794', lineHeight: 1.7 }}>処分額を入れると当期減少額に入り、期末帳簿価額・減価償却累計額・期末取得原価を計算し直します。残りの数量は引き続き償却します。</div>
        <div style={FOOT}>
          {value && <button type="button" className="btn-outline" onClick={() => { onApply(null); onClose(); }} style={{ ...BTN('#c0392b'), marginRight: 'auto' }}>一部処分を取消</button>}
          <button type="button" onClick={onClose} style={BTN()}>キャンセル</button>
          <button type="button" className="submit-btn" onClick={() => { if (!p.qty) return toast('処分数量を入力してください'); if (p.qty >= qty) return toast('全数量の処分は「資産処分等」で設定してください'); if (dec > book) return toast('処分額が処分前の帳簿価額を超えています'); onApply({ ...p, decrease: dec, amount: sale ? p.amount : dec }); onClose(); }} style={BTN(accent, true)}>確定</button>
        </div>
      </div>
    </Modal>
  );
}

interface CalcChange { reason: string; date: string; life: number; method: string; unit: number; note: string }
/** 計算変更（耐用年数・償却方法・取得価額の変更） */
function CalcChangeModal({ current, onClose, onApply, accent, toast }: { current: { life: number; method: string; unit: number }; onClose: () => void; onApply: (c: CalcChange) => void; accent: string; toast: (m: string) => void }) {
  const [c, setC] = useState<CalcChange>({ reason: '耐用年数の変更', date: waToday(), life: current.life, method: current.method, unit: current.unit, note: '' });
  return (
    <Modal open onClose={onClose} width={600} title="計算変更">
      <div style={{ padding: '12px 22px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><span style={LBL}>変更事由</span><select value={c.reason} onChange={(e) => setC({ ...c, reason: e.target.value })} style={IN}>{['耐用年数の変更', '償却方法の変更', '取得価額の訂正', '償却開始年月日の変更'].map((o) => <option key={o}>{o}</option>)}</select></div>
          <div><span style={LBL}>変更年月日（適用開始）</span><WarekiDate value={c.date} onChange={(v) => setC({ ...c, date: v })} accent={accent} /></div>
          <div><span style={LBL}>耐用年数（現在 {current.life || '—'} 年）</span><input className="field-input" value={c.life || ''} onChange={(e) => setC({ ...c, life: numOf(e.target.value) })} inputMode="numeric" disabled={c.reason !== '耐用年数の変更'} style={{ ...IN_NUM, background: c.reason === '耐用年数の変更' ? '#fff' : '#f5f7f9' }} /></div>
          <div><span style={LBL}>償却方法（現在 {current.method}）</span><select value={c.method} onChange={(e) => setC({ ...c, method: e.target.value })} disabled={c.reason !== '償却方法の変更'} style={{ ...IN, background: c.reason === '償却方法の変更' ? '#fff' : '#f5f7f9' }}>{METHODS.map((o) => <option key={o}>{o}</option>)}</select></div>
          <div><span style={LBL}>単価（現在 {yen(current.unit)}）</span><input className="field-input" value={c.unit ? yen(c.unit) : ''} onChange={(e) => setC({ ...c, unit: numOf(e.target.value) })} inputMode="numeric" disabled={c.reason !== '取得価額の訂正'} style={{ ...IN_NUM, background: c.reason === '取得価額の訂正' ? '#fff' : '#f5f7f9' }} /></div>
          <div style={{ gridColumn: 'span 2' }}><span style={LBL}>備考</span><input className="field-input" value={c.note} onChange={(e) => setC({ ...c, note: e.target.value })} placeholder="例：監査指摘により耐用年数を訂正" style={IN} /></div>
        </div>
        <Notice>変更後の内容で当期以降の償却額を再計算します（変更前の年度は再計算しません）。変更内容は操作ログに記録されます。</Notice>
        <div style={FOOT}><button type="button" onClick={onClose} style={BTN()}>キャンセル</button><button type="button" className="submit-btn" onClick={() => { if (c.reason === '耐用年数の変更' && !c.life) return toast('耐用年数を入力してください'); if (c.reason === '取得価額の訂正' && !c.unit) return toast('単価を入力してください'); onApply(c); onClose(); }} style={BTN(accent, true)}>変更を適用</button></div>
      </div>
    </Modal>
  );
}

/** 資本的支出の方法選択（確認メモ #279）。押したボタンでそのまま登録画面へ進む */
const CAPEX_KINDS: { kind: CapexKind; label: string; note: string }[] = [
  { kind: '新たな固定資産', label: '新たな固定資産の取得として減価償却を行う場合の資本的支出', note: '支出した金額を取得価額とする、新しい固定資産として登録します。' },
  { kind: '特例合算', label: '既存の固定資産と合算し一つの固定資産とする資本的支出', note: '元の固定資産と合算して一つの固定資産として扱います（特例合算）。' },
];
function CapexChoiceModal({ parent, onPick, onClose }: { parent: Asset; onPick: (k: CapexKind) => void; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} width={640} title="資本的支出の方法選択">
      <div data-capex-choice style={{ padding: '12px 22px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>資本的支出による減価償却の選択</span>
          <span style={{ fontSize: 13, color: '#5b6773' }}>対象：{parent.code}　{parent.name}</span>
        </div>
        {CAPEX_KINDS.map((k, i) => (
          <button key={k.kind} type="button" className="capex-kind" data-capex-kind={k.kind} onClick={() => onPick(k.kind)} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', textAlign: 'left', padding: '12px 14px', border: '1px solid #e9c46a', borderRadius: 10, background: '#fffbea', color: '#22303c', fontFamily: 'inherit', cursor: 'pointer' }}>
            <span style={{ flex: 'none', width: 26, height: 26, borderRadius: 13, background: '#b7791f', color: '#fff', fontSize: 14, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{k.label}</span>
              <span style={{ fontSize: 13, color: '#5b6773' }}>{k.note}</span>
            </span>
          </button>
        ))}
        <Notice>どちらで登録しても、固定資産台帳には元の固定資産とは別の行として表示します（現行システムと同じ）。修繕費（原状回復）は資本的支出に含めません。</Notice>
        <div style={FOOT}><button type="button" onClick={onClose} style={BTN()}>キャンセル</button></div>
      </div>
    </Modal>
  );
}

interface MethodDetail { dep: RoundMode; sub: RoundMode; memo: number; residualRate: number; prorate: '取得月から' | '取得の翌月から'; digits: '3桁' | '4桁' }
const DEFAULT_DETAIL = (m: string): MethodDetail => ({ dep: '切捨て', sub: '切捨て', memo: 1, residualRate: m.startsWith('旧定額法') ? 10 : 0, prorate: '取得月から', digits: '3桁' });
/** 償却方法ごとの詳細設定（動作環境設定） */
function MethodDetailModal({ method, value, onClose, onSave, accent }: { method: string; value: MethodDetail; onClose: () => void; onSave: (v: MethodDetail) => void; accent: string }) {
  const [v, setV] = useState<MethodDetail>(value);
  const radios = (key: 'dep' | 'sub') => (['切捨て', '四捨五入', '切上げ'] as RoundMode[]).map((m) => <label key={m} style={{ display: 'inline-flex', gap: 5, alignItems: 'center', fontSize: 14, marginRight: 14 }}><input type="radio" name={'md-' + key} checked={v[key] === m} onChange={() => setV({ ...v, [key]: m })} />{m}</label>);
  const old = method.startsWith('旧定額法');
  return (
    <Modal open onClose={onClose} width={600} title={`${method} の詳細設定`}>
      <div style={{ padding: '12px 22px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><span style={LBL}>減価償却費の端数</span>{radios('dep')}</div>
        <div><span style={LBL}>国庫補助金等取崩額の端数</span>{radios('sub')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><span style={LBL}>備忘価額（円）</span><input className="field-input" value={v.memo} onChange={(e) => setV({ ...v, memo: numOf(e.target.value) })} inputMode="numeric" style={IN_NUM} /></div>
          <div><span style={LBL}>残存価額率（%）{!old && '　※旧定額法のみ'}</span><input className="field-input" value={v.residualRate} onChange={(e) => setV({ ...v, residualRate: numOf(e.target.value) })} inputMode="numeric" disabled={!old} style={{ ...IN_NUM, background: old ? '#fff' : '#f5f7f9' }} /></div>
          <div><span style={LBL}>期中取得の月按分</span><select value={v.prorate} onChange={(e) => setV({ ...v, prorate: e.target.value as MethodDetail['prorate'] })} style={IN}><option>取得月から</option><option>取得の翌月から</option></select></div>
          <div><span style={LBL}>償却率の小数桁数</span><select value={v.digits} onChange={(e) => setV({ ...v, digits: e.target.value as MethodDetail['digits'] })} style={IN}><option>3桁</option><option>4桁</option></select></div>
        </div>
        <div style={FOOT}><button type="button" onClick={onClose} style={BTN()}>キャンセル</button><button type="button" className="submit-btn" onClick={() => { onSave(v); onClose(); }} style={BTN(accent, true)}>設定</button></div>
      </div>
    </Modal>
  );
}

/** 並び順項目マスタ（台帳・帳票の並び順に使う項目の管理） */
function SortMasterModal({ items, onClose, onSave, accent, toast }: { items: SortItem[]; onClose: () => void; onSave: (items: SortItem[]) => void; accent: string; toast: (m: string) => void }) {
  const byCode = (l: SortItem[]) => [...l].sort((x, y) => Number(x.code) - Number(y.code));
  const [list, setList] = useState<SortItem[]>(byCode(items));
  const [sel, setSel] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const pickRow = (it: SortItem) => { setSel(it.code); setCode(it.code); setName(it.name); };
  const register = () => {
    const n = Number(code);
    if (!/^\d{3}$/.test(code) || n < 100 || n > 499) return toast('並順は 100〜499 の範囲のコードを入力してください');
    if (!name.trim()) return toast('項目名称を入力してください');
    const exists = list.some((it) => it.code === code);
    setList((l) => byCode([...l.filter((it) => it.code !== code), { code, name: name.trim() }]));
    setSel(code);
    toast(exists ? `${code} の項目名称を変更しました` : `${code} ${name.trim()} を登録しました`);
  };
  const remove = () => {
    if (!sel) return toast('削除する項目を一覧で選んでください');
    setList((l) => l.filter((it) => it.code !== sel));
    toast(`${sel} を削除しました`);
    setSel(null); setCode(''); setName('');
  };
  const importStd = () => {
    if (list.length && !confirm('一覧を標準設定の並び順項目に置き換えます。よろしいですか？')) return;
    setList(byCode(DEFAULT_SORT_ITEMS)); setSel(null); setCode(''); setName('');
    toast(`標準設定の並び順項目（${DEFAULT_SORT_ITEMS.length} 件）を読み込みました`);
  };
  const importCsv = async (file: File) => {
    // 現行システムの CSV は「"コード","名称"」の 2 列（見出しなし・Shift-JIS）。UTF-8 の CSV も読める
    const buf = await file.arrayBuffer();
    let text = new TextDecoder('utf-8').decode(buf);
    if (text.includes('�')) { try { text = new TextDecoder('shift_jis').decode(buf); } catch { /* そのまま */ } }
    const rows = text.split(/\r?\n/).map((l) => l.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))).filter((c) => /^\d{3}$/.test(c[0] ?? '') && Number(c[0]) >= 100 && Number(c[0]) <= 499 && c[1]);
    if (!rows.length) return toast('読み込める並び順項目がありませんでした（「コード,名称」の CSV を選んでください）');
    const m = new Map<string, string>(); rows.forEach(([c, n]) => m.set(c, n));
    setList(byCode([...m].map(([c, n]) => ({ code: c, name: n })))); setSel(null); setCode(''); setName('');
    toast(`CSV ファイルから ${m.size} 件の並び順項目を読み込みました`);
  };
  const exportCsv = () => {
    const body = list.map((it) => `"${it.code}","${it.name}"`).join('\r\n') + '\r\n';
    const url = URL.createObjectURL(new Blob(['﻿' + body], { type: 'text/csv' }));
    const el = document.createElement('a'); el.href = url; el.download = '並び順マスタ.csv'; el.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('並び順項目を CSV ファイルに出力しました');
  };
  const big: CSSProperties = { ...BTN(), whiteSpace: 'pre', lineHeight: 1.35, padding: '6px 10px', fontSize: 13, textAlign: 'center' };
  return (
    <Modal open onClose={onClose} width={820} title="並び順項目マスタ">
      <div data-sort-master style={{ padding: '12px 22px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 14, color: '#48565f' }}>独自に並び順項目を作成しない場合は「並び順項目のインポート（標準設定を使う）」ボタンをクリックしてください</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
            <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', background: '#f6f8fa', borderBottom: '1px solid #e2e8ee', fontSize: 12, fontWeight: 700, color: '#6b7783' }}><span style={{ padding: '6px 10px' }}>並順</span><span style={{ padding: '6px 10px' }}>項目名称</span></div>
              <div style={{ maxHeight: 300, overflow: 'auto' }}>
                {list.map((it) => { const on = it.code === sel; return <button key={it.code} type="button" data-sort-row={it.code} onClick={() => pickRow(it)} style={{ display: 'grid', gridTemplateColumns: '70px 1fr', width: '100%', border: 'none', borderBottom: '1px solid #f1f4f6', background: on ? accent : '#fff', color: on ? '#fff' : '#22303c', textAlign: 'left', fontSize: 14, fontFamily: 'inherit', cursor: 'pointer', padding: 0 }}><span style={{ padding: '5px 10px', fontVariantNumeric: 'tabular-nums' }}>{it.code}</span><span style={{ padding: '5px 10px', fontWeight: 600 }}>{it.name}</span></button>; })}
                {list.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#9aa5b1', fontSize: 14 }}>項目がありません。</div>}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '90px minmax(0,1fr) auto auto', gap: 6, alignItems: 'end' }}>
              <label><span style={LBL}>並順</span><input className="field-input" data-sort-code value={code} onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))} inputMode="numeric" placeholder="100〜499" style={{ ...IN, fontVariantNumeric: 'tabular-nums' }} /></label>
              <label><span style={LBL}>項目名称</span><input className="field-input" data-sort-name value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !noIme(e)) register(); }} style={IN} /></label>
              <button type="button" className="submit-btn" data-sort-register onClick={register} style={BTN(accent, true)}>登録</button>
              <button type="button" className="btn-outline" onClick={remove} disabled={!sel} style={{ ...BTN('#c0392b'), opacity: sel ? 1 : 0.5 }}>削除</button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div data-sort-rule style={{ border: '1px solid #e2e8ee', borderRadius: 10, padding: '12px 14px', background: '#fbfcfd', fontSize: 14, lineHeight: 1.7, color: '#22303c' }}>
              <div>登録可能なコードは</div>
              <div style={{ fontWeight: 700 }}>１００～４９９</div>
              <div>で、１００のくらいの数字</div>
              <div>の意味は以下のとおりです。</div>
              <div style={{ marginTop: 8, display: 'grid', gap: 2 }}>
                {[['１＊＊', '基本財産'], ['２＊＊', '有形固定資産'], ['３＊＊', '無形固定資産'], ['４＊＊', '備品']].map(([c, n]) => <div key={c}><span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{c}</span>　{n}</div>)}
              </div>
            </div>
            <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, padding: '10px 12px', display: 'grid', gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7783' }}>並び順項目のインポート／エクスポート</div>
              <button type="button" className="btn-outline" data-sort-import-std onClick={importStd} style={big}>{'インポート１\n（標準設定を使う）'}</button>
              <button type="button" className="btn-outline" onClick={() => fileRef.current?.click()} style={big}>{'インポート２\n（CSVファイルから設定）'}</button>
              <button type="button" className="btn-outline" onClick={exportCsv} style={big}>{'エクスポート\n（CSVファイルを出力）'}</button>
              <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={(e) => { const fl = e.target.files?.[0]; if (fl) void importCsv(fl); e.target.value = ''; }} />
            </div>
          </div>
        </div>
        <Notice>固定資産・備品の「並び順項目」の選択肢になります。帳票はこのコードの順に並べて印刷します。</Notice>
        <div style={FOOT}><button type="button" onClick={onClose} style={BTN()}>キャンセル</button><button type="button" className="submit-btn" onClick={() => { onSave(list); onClose(); }} style={BTN(accent, true)}>保存して閉じる</button></div>
      </div>
    </Modal>
  );
}

/* ================= ページ本体 ================= */
export function DepreciationPage({ variant, accent }: Props) {
  const [tab, setTab] = useState<Tab>('home');
  const [assets, setAssets] = useState<Asset[]>(ASSETS);
  const [equips, setEquips] = useState<Equip[]>(EQUIPS);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'すべて' | Asset['status']>('すべて');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<Asset | null>(null);
  const [assetModal, setAssetModal] = useState<{ open: boolean; asset: Asset | null; manual: boolean }>({ open: false, asset: null, manual: false });
  const [equipModal, setEquipModal] = useState(false);
  const [envOpen, setEnvOpen] = useState(false);
  const [logOpen, setLogOpen] = useState<{ open: boolean; code?: string; kind?: LogRow['kind'] }>({ open: false });
  const [logTab, setLogTab] = useState<'資産' | '備品' | 'システム'>('資産');
  const [logs, setLogs] = useState<LogRow[]>(INITIAL_LOGS);
  const [disposals, setDisposals] = useState<Disposal[]>([]);
  const [images, setImages] = useState<Record<string, string>>({});
  const [imgTarget, setImgTarget] = useState<{ key: string; title: string } | null>(null);
  const [sortItems, setSortItems] = useState<SortItem[]>(DEFAULT_SORT_ITEMS);
  const [exportSpec, setExportSpec] = useState<ExportSpec | null>(null);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [dispCalc, setDispCalc] = useState<DispCalc>('除却月／移管月まで（月按分する）');
  const toast = useToast();
  const isSheet = variant === 'sheet';

  const btn = (color = '#5b6773', solid = false): CSSProperties => ({ padding: '8px 14px', borderRadius: 8, border: '1px solid ' + (solid ? color : '#cfd8e0'), background: solid ? color : '#fff', color: solid ? '#fff' : color, fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' });
  const card: CSSProperties = { background: '#fff', border: '1px solid #dde4ea', borderRadius: 14, boxShadow: '0 6px 26px rgba(30,50,70,.06)', overflow: 'hidden' };

  const addLog = (kind: LogRow['kind'], code: string, target: string, action: string) => setLogs((ls) => [...ls, { time: stamp(), kind, code, target, action, user: USER }]);
  // 帳票の印刷は、まず条件画面（出力先と詳細設定）を開く（確認メモ #251）
  const [printReq, setPrintReq] = useState<{ name: string; single?: Asset } | null>(null);
  const [depPreview, setDepPreview] = useState<{ title: string; meta?: string; header: string[]; rows: (string | number)[][] } | null>(null);
  const openReport = (name: string, single?: Asset) => setPrintReq({ name, single });
  const openLog = (kind: LogRow['kind'], code?: string) => { setLogTab(kind); setLogOpen({ open: true, code, kind }); };

  const list = assets.filter((a) => (statusFilter === 'すべて' || a.status === statusFilter) && (!q || a.name.includes(q) || a.code.includes(q) || a.account.includes(q)));
  const kpi = {
    count: assets.length,
    active: assets.filter((a) => a.status === '償却中').length,
    cost: assets.reduce((s, a) => s + a.cost, 0),
    opening: assets.reduce((s, a) => s + a.opening, 0),
    annual: assets.reduce((s, a) => s + annualOf(a), 0),
  };
  const toggleSel = (code: string) => setSel((s) => { const n = new Set(s); n.has(code) ? n.delete(code) : n.add(code); return n; });
  const deleteSel = () => {
    if (sel.size === 0) return;
    if (!confirm(`${sel.size} 件の固定資産を削除します。よろしいですか？（取り消せません）`)) return;
    assets.filter((a) => sel.has(a.code)).forEach((a) => addLog('資産', a.code, `${Number(a.code)}:${a.name}`, '削除'));
    setAssets((as) => as.filter((a) => !sel.has(a.code)));
    setSel(new Set());
    setDetail(null);
    toast.show('削除しました');
  };
  const [assetFormKey, setAssetFormKey] = useState(0);
  const saveAsset = (a: Asset, note?: string, next?: boolean) => {
    const exists = assets.some((x) => x.code === a.code);
    setAssets((as) => (exists ? as.map((x) => (x.code === a.code ? a : x)) : [...as, a]));
    addLog('資産', a.code, `${Number(a.code)}:${a.name}`, (exists ? '変更' : '登録') + (note ? `（${note}）` : ''));
    if (next) {
      // 登録して次を入力：画面は閉じずに入力欄を空にし、次の資産コードから続ける（確認メモ #254）
      setAssetFormKey((k) => k + 1);
      toast.show(`固定資産「${a.name}」を登録しました。続けて次の固定資産を入力できます`);
      return;
    }
    setAssetModal({ open: false, asset: null, manual: false });
    setDetail(a);
    toast.show(`固定資産「${a.name}」を保存しました`);
  };
  /** 資本的支出の登録（確認メモ #279）：元の固定資産とは別の行として台帳に加える */
  const addCapex = (a: Asset) => {
    setAssets((as) => [...as, a]);
    addLog('資産', a.code, `${Number(a.code)}:${a.name}`, `資本的支出の登録（${a.capexKind ? CAPEX_LABEL[a.capexKind] : ''}・元の固定資産 ${a.capexOf}）`);
    toast.show(`資本的支出「${a.name}」を登録しました`);
  };
  const kpiTile = (label: string, value: string, sub?: string) => (
    <div key={label} style={{ padding: '10px 14px', border: '1px solid #e2e8ee', borderRadius: 10, background: '#fbfcfd', minWidth: 150 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#8290a0' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#9aa5b1' }}>{sub}</div>}
    </div>
  );

  /** ホームの機能一覧から開く（確認メモ #244） */
  const runHome = (l: string) => {
    if (l === '固定資産台帳') setTab('assets');
    else if (l === '固定資産を登録') setAssetModal({ open: true, asset: null, manual: false });
    else if (l === '全項目手入力で登録') setAssetModal({ open: true, asset: null, manual: true });
    else if (l === '備品台帳') setTab('equips');
    else if (l === '備品を登録') setEquipModal(true);
    else if (l === '除却・売却・移管') setTab('disposal');
    else if (l === '移管取込') setTab('transfer');
    else if (l.startsWith('決算処理')) setTab('closing');
    else if (l === '環境設定') setEnvOpen(true);
    else if (l === '操作ログ') openLog('資産');
    else if (PRINT_REPORTS.includes(l)) { addLog('システム', '', l, '帳票印刷'); openReport(l); }
  };

  // 操作ログ・詳細情報（資産／備品ごと）
  const logRows = logs.filter((l) => l.kind === logTab && (!logOpen.code || logOpen.kind !== logTab || l.code === logOpen.code));
  const logTargetAsset = logOpen.code && logOpen.kind === '資産' ? assets.find((a) => a.code === logOpen.code) : undefined;
  const logTargetEquip = logOpen.code && logOpen.kind === '備品' ? equips.find((e) => e.code === logOpen.code) : undefined;
  const targetLogs = logOpen.code ? logs.filter((l) => l.kind === logOpen.kind && l.code === logOpen.code) : [];
  const infoRow = (l: string, v: string) => <div key={l} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '4px 0', borderBottom: '1px solid #f1f4f6' }}><span style={{ color: '#7a8794' }}>{l}</span><span style={{ fontWeight: 600, textAlign: 'right' }}>{v}</span></div>;

  return (
    <main style={{ flex: 1, minWidth: 0, padding: isSheet ? '20px 24px 24px' : 28, display: 'flex', justifyContent: 'center' }}>
      <ToastView msg={toast.msg} />
      <div style={{ width: '100%', maxWidth: isSheet ? 'none' : 1320, ...card, display: 'flex', flexDirection: 'column' }}>
        {/* 見出し＋主要アクション */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '18px 22px 12px', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: isSheet ? 17 : 21 }}>
              減価償却
              <span style={{ fontSize: 14, fontWeight: 500, color: '#7a8794', marginLeft: 8 }}>チャイルド保育園　令和8年度</span>
            </div>
            <div style={{ color: '#7a8794', fontSize: 14, marginTop: 4 }}>固定資産・備品の台帳管理と、減価償却の決算処理。<span style={{ color: '#b7791f' }}>（値はサンプル）</span></div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button type="button" className="submit-btn" onClick={() => setAssetModal({ open: true, asset: null, manual: false })} style={btn(accent, true)}>＋ 固定資産を登録</button>
            {/* 全項目手入力は通常の登録とは別の登録パターン。固定資産の登録と並べて別のボタンにする（確認メモ #253） */}
            <button type="button" className="btn-outline" data-manual-new onClick={() => setAssetModal({ open: true, asset: null, manual: true })} title="自動計算を行わず、償却を開始する年度からすべての年度の金額を手入力して登録します" style={{ ...btn(accent), borderColor: accent }}>＋ 全項目手入力で登録</button>
            <button type="button" className="btn-outline" onClick={() => setEquipModal(true)} style={btn()}>＋ 備品を登録</button>
            <span style={{ width: 1, background: '#e2e8ee', margin: '4px 4px' }} />
            <IconButton icon="gear" label="環境設定" onClick={() => setEnvOpen(true)} />
            <IconButton icon="log" label="操作ログ" onClick={() => openLog('資産')} />
            <ScreenPrintMenu accent={accent} actions={[{ label: '固定資産・備品の帳票', items: PRINT_REPORTS.map((r) => ({ name: r, onClick: () => { addLog('システム', '', r, '帳票印刷'); openReport(r); } })) }]} />
          </div>
        </div>

        {/* タブ */}
        <div style={{ display: 'flex', gap: 2, padding: '0 22px', borderBottom: '1px solid #eef2f5' }}>
          {TABS.map((t) => {
            const on = tab === t.key;
            return (
              <button key={t.key} type="button" role="tab" aria-selected={on} className="menu-item-h" data-tab={t.label} onClick={() => setTab(t.key)} title={t.hint} style={{ padding: '10px 14px', border: 'none', borderBottom: '2px solid ' + (on ? accent : 'transparent'), background: 'transparent', color: on ? accent : '#5b6773', fontSize: 14, fontWeight: on ? 700 : 500, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {t.label}
                {t.key === 'closing' && vouchers.length > 0 && <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 800, color: '#fff', background: accent, borderRadius: 8, padding: '1px 6px' }}>{vouchers.length}</span>}
                {t.key === 'disposal' && disposals.length > 0 && <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 800, color: '#fff', background: '#8a6d00', borderRadius: 8, padding: '1px 6px' }}>{disposals.length}</span>}
              </button>
            );
          })}
        </div>

        {/* ===== 機能一覧（旧 ホーム）：概要と機能の一覧（会計のホームと同じ形。確認メモ #244）。
             処理の 5 分類を 1 段に並べ、項目の多い帳票は下の段に横幅いっぱいで 5 列に並べる（見出しの形はほかの分類と同じ） ===== */}
        {tab === 'home' && (
          <div data-dep-home style={{ padding: '14px 22px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {kpiTile('固定資産', `${kpi.count} 件`, `償却中 ${kpi.active} 件`)}
              {kpiTile('取得価額 合計', yen(kpi.cost))}
              {kpiTile('期首帳簿価額 合計', yen(kpi.opening))}
              {kpiTile('当期償却額（見込）', yen(kpi.annual), '定額法・年額')}
              {kpiTile('備品', `${equips.length} 件`)}
              {kpiTile('決算伝票', `${vouchers.length} 件`, vouchers.length ? '作成済み' : 'まだ作成していません')}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>機能の一覧</div>
              <div style={{ border: '1px solid #e3e9ee', borderRadius: 12, overflow: 'hidden' }}>
                <FunctionDirectory groups={HOME_GROUPS} accent={accent} onNavigate={runHome} nameOf={(l) => l} cols={5} stacked wide={{ print: 5 }} />
              </div>
            </div>
          </div>
        )}

        {/* ===== 固定資産台帳 ===== */}
        {tab === 'assets' && (
          <div style={{ display: 'grid', gridTemplateColumns: detail ? 'minmax(0,1fr) 380px' : '1fr' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 10, padding: '14px 22px', flexWrap: 'wrap' }}>
                {kpiTile('固定資産', `${kpi.count} 件`, `償却中 ${kpi.active} 件`)}
                {kpiTile('取得価額 合計', yen(kpi.cost))}
                {kpiTile('期首帳簿価額 合計', yen(kpi.opening))}
                {kpiTile('当期償却額（見込）', yen(kpi.annual), '定額法・年額')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 22px 10px', flexWrap: 'wrap' }}>
                {(['すべて', '償却中', '償却終了', '対象外', '移管取込', '移管年度'] as const).map((st) => <button key={st} type="button" className="chip" onClick={() => setStatusFilter(st)} style={{ padding: '5px 12px', borderRadius: 14, border: '1px solid ' + (statusFilter === st ? accent : '#d3dbe3'), background: statusFilter === st ? accent : '#fff', color: statusFilter === st ? '#fff' : '#5b6773', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{st}</button>)}
                <input className="search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="名称・コード・科目で検索" autoComplete="off" style={{ marginLeft: 'auto', width: 240, padding: '7px 10px', border: '1px solid #cfd8e0', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
              </div>
              <SelectionBar count={sel.size} unit="件" hint="行頭のチェックで追加・解除" style={{ padding: '8px 22px', borderTop: '1px solid #f3e3a0' }} onClear={() => setSel(new Set())} actions={<><button type="button" onClick={() => { setTab('disposal'); }} style={uiBtn('#5b6773', false, true)}>除却・売却・移管へ</button><button type="button" onClick={deleteSel} style={uiBtn('#c0392b', true, true)}>削除</button></>} />
              <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 470px)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={{ ...TH, width: 36 }}><input type="checkbox" checked={list.length > 0 && list.every((a) => sel.has(a.code))} onChange={(e) => setSel(e.target.checked ? new Set(list.map((a) => a.code)) : new Set())} /></th><th style={TH}>状態</th><th style={TH}>コード</th><th style={TH}>固定資産名称</th><th style={TH}>科目</th><th style={TH}>取得年月日</th><th style={{ ...TH, textAlign: 'right' }}>耐用</th><th style={{ ...TH, textAlign: 'right' }}>取得価額</th><th style={{ ...TH, textAlign: 'right' }}>期首帳簿価額</th><th style={{ ...TH, textAlign: 'right' }}>当期償却額</th><th style={{ ...TH, textAlign: 'right' }}>期末帳簿価額</th></tr></thead>
                  <tbody>
                    {list.length === 0 && <tr><td colSpan={11} style={{ ...TD, textAlign: 'center', color: '#9aa5b1', padding: 40 }}>該当する固定資産がありません。</td></tr>}
                    {list.map((a) => {
                      const dep = annualOf(a);
                      const on = detail?.code === a.code;
                      return (
                        <tr key={a.code} onClick={() => setDetail(a)} className="menu-sub" style={{ cursor: 'pointer', background: on ? '#eef2f6' : sel.has(a.code) ? '#fff8e6' : 'transparent' }}>
                          <td style={TD} onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={sel.has(a.code)} onChange={() => toggleSel(a.code)} /></td>
                          <td style={TD}><span style={statusStyle(a.status)}>{a.status}</span></td>
                          <td style={{ ...TD, fontVariantNumeric: 'tabular-nums', color: '#7a8794' }}>{a.code}</td>
                          <td style={{ ...TD, fontWeight: 600 }}>{a.name}{a.transferIn && <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 700, padding: '1px 6px', borderRadius: 6, background: '#e8f0fb', color: '#2c5f9e' }}>移管(先)</span>}{a.capexOf && <span title={`元の固定資産：${a.capexOf}（${a.capexKind ? CAPEX_LABEL[a.capexKind] : ''}）`} style={{ marginLeft: 6, fontSize: 12, fontWeight: 700, padding: '1px 6px', borderRadius: 6, background: '#fff1b8', color: '#8a6d00' }}>資本的支出</span>}{a.manual && <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 700, padding: '1px 6px', borderRadius: 6, background: '#f1f4f6', color: '#5b6773' }}>全項目手入力</span>}{images['A:' + a.code] && <span title="画像あり" style={{ marginLeft: 6, fontSize: 12 }}>📷</span>}</td>
                          <td style={{ ...TD, color: '#48565f' }}>{a.account}</td>
                          <td style={{ ...TD, whiteSpace: 'nowrap' }}>{a.acquired}</td>
                          <td style={NUM}>{a.life || '—'}</td>
                          <td style={NUM}>{yen(a.cost)}</td>
                          <td style={NUM}>{yen(a.opening)}</td>
                          <td style={{ ...NUM, color: dep ? '#b0426a' : '#9aa5b1' }}>{dep ? yen(dep) : '—'}</td>
                          <td style={{ ...NUM, fontWeight: 700 }}>{yen(a.opening - dep)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            {detail && (
              <AssetDetail accent={accent} asset={detail} imageSrc={images['A:' + detail.code]} onClose={() => setDetail(null)} onEdit={() => setAssetModal({ open: true, asset: detail, manual: !!detail.manual })} onPrint={() => openReport('個別固定資産管理台帳', detail)} onDelete={() => { if (confirm(`「${detail.name}」を削除しますか？（取り消せません）`)) { addLog('資産', detail.code, `${Number(detail.code)}:${detail.name}`, '削除'); setAssets((as) => as.filter((a) => a.code !== detail.code)); setDetail(null); toast.show('削除しました'); } }} />
            )}
          </div>
        )}

        {/* ===== 備品台帳 ===== */}
        {tab === 'equips' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 22px 10px' }}>
              <span style={{ fontSize: 14, color: '#7a8794' }}>{equips.length} 件　取得価額合計 <b style={{ color: '#22303c' }}>{yen(equips.reduce((s, e) => s + e.cost, 0))}</b></span>
              <button type="button" className="btn-outline" onClick={() => openReport('備品一覧表（1）')} style={{ ...btn(), padding: '5px 10px', fontSize: 12 }}>備品一覧表(1)</button>
              <button type="button" className="btn-outline" onClick={() => openReport('備品一覧表（2）')} style={{ ...btn(), padding: '5px 10px', fontSize: 12 }}>備品一覧表(2)</button>
              <input className="search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="備品名で検索" autoComplete="off" style={{ marginLeft: 'auto', width: 240, padding: '7px 10px', border: '1px solid #cfd8e0', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={TH}>備品コード</th><th style={TH}>備品名称</th><th style={TH}>科目</th><th style={TH}>取得年月日</th><th style={{ ...TH, textAlign: 'right' }}>取得価額</th><th style={{ ...TH, width: 200 }} /></tr></thead>
              <tbody>
                {equips.filter((e) => !q || e.name.includes(q)).map((e) => <tr key={e.code}><td style={{ ...TD, color: '#7a8794' }}>{e.code}</td><td style={{ ...TD, fontWeight: 600 }}>{e.name}{images['E:' + e.code] && <span title="画像あり" style={{ marginLeft: 6, fontSize: 12 }}>📷</span>}</td><td style={{ ...TD, color: '#48565f' }}>{e.account ?? ''}</td><td style={TD}>{e.acquired}</td><td style={NUM}>{yen(e.cost)}</td><td style={{ ...TD, textAlign: 'right', whiteSpace: 'nowrap' }}><button type="button" className="btn-outline" onClick={() => setImgTarget({ key: 'E:' + e.code, title: `備品画像：${e.name}` })} style={{ ...btn(), padding: '4px 10px', fontSize: 12, marginRight: 4 }}>画像</button><button type="button" className="btn-outline" onClick={() => openLog('備品', e.code)} style={{ ...btn(), padding: '4px 10px', fontSize: 12, marginRight: 4 }}>ログ</button><button type="button" className="btn-outline" onClick={() => { if (confirm(`「${e.name}」を削除しますか？`)) { addLog('備品', e.code, `${Number(e.code)}:${e.name}`, '削除'); setEquips((es) => es.filter((x) => x.code !== e.code)); } }} style={{ ...btn('#c0392b'), padding: '4px 10px', fontSize: 12 }}>削除</button></td></tr>)}
                {equips.length === 0 && <tr><td colSpan={6} style={{ ...TD, textAlign: 'center', color: '#9aa5b1', padding: 40 }}>備品は登録されていません。「＋ 備品を登録」から追加してください。</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'disposal' && <BatchView accent={accent} dispCalc={dispCalc} assets={assets} preselected={sel} disposals={disposals} onExport={setExportSpec} onDone={(entries) => { setDisposals((d) => [...d, ...entries]); const moved = new Set(entries.filter((e) => e.proc === '移管(元)').map((e) => e.code)); if (moved.size) setAssets((as) => as.map((a) => (moved.has(a.code) ? { ...a, status: '移管年度' } : a))); entries.forEach((e) => addLog('資産', e.code, `${Number(e.code)}:${e.name}`, `${e.proc}${e.to ? `：${e.to}へ` : ''}（${e.date}）`)); setSel(new Set()); setTab('assets'); const to = entries[0]?.to; toast.show(to ? `${entries.length} 件の固定資産を「${to}」へ移管しました（移管先の固定資産台帳に登録されます）` : `${entries.length} 件の処理を登録しました`); }} toast={toast.show} />}
        {tab === 'closing' && <ClosingView accent={accent} vouchers={vouchers} setVouchers={setVouchers} onCreated={(name, proc, n) => addLog('システム', '', name, `決算伝票作成（${proc}・${n}科目）`)} toast={toast.show} />}
        {tab === 'transfer' && <TransferView accent={accent} assets={assets} onRegister={(rows) => { const added = rows.map((r): Asset => ({ code: r.code, name: r.name, account: '器具及び備品', acquired: r.date, life: 10, cost: r.cost, status: '移管取込', opening: r.cost, subsidy: r.subsidy, method: '定額法', qty: r.inQty, place: `移管元：${r.from}`, transferIn: true })); setAssets((as) => [...as, ...added]); added.forEach((a) => addLog('資産', a.code, `${Number(a.code)}:${a.name}`, '移管(先)取込み')); setTab('assets'); toast.show(`移管資産 ${rows.length} 件を登録しました`); }} toast={toast.show} />}
      </div>

      {/* 固定資産の登録／変更（モーダル） */}
      <Modal open={assetModal.open} onClose={() => setAssetModal({ open: false, asset: null, manual: false })} width={1540} style={{ maxHeight: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} title={<>{assetModal.asset ? '固定資産の変更' : '固定資産の登録'}{assetModal.manual && <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: '#fff1b8', color: '#8a6d00' }}>全項目手入力</span>}</>}>
        {assetModal.open && <AssetForm key={assetFormKey} accent={accent} asset={assetModal.asset} manual={assetModal.manual} dispCalc={dispCalc} onAddCapex={addCapex} sortItems={sortItems} nextCode={String(assets.reduce((m, a) => Math.max(m, Number(a.code) < 10000 ? Number(a.code) : 0), 0) + 1).padStart(5, '0')} imageSrc={images['A:' + (assetModal.asset?.code ?? '')]} onSave={saveAsset} onCancel={() => setAssetModal({ open: false, asset: null, manual: false })} onReport={openReport} onLog={(code) => openLog('資産', code)} onImage={(code, name) => setImgTarget({ key: 'A:' + code, title: `資産画像：${name || code}` })} toast={toast.show} />}
      </Modal>
      <Modal open={equipModal} onClose={() => setEquipModal(false)} width={1000} title="備品の登録">
        {equipModal && <EquipForm accent={accent} equips={equips} sortItems={sortItems} imageSrc={images} onSave={(e) => { setEquips((es) => [...es, e]); addLog('備品', e.code, `${Number(e.code)}:${e.name}`, '登録'); toast.show(`備品「${e.name}」を登録しました`); }} onCancel={() => setEquipModal(false)} onReport={openReport} onLog={(code) => openLog('備品', code)} onImage={(code, name) => setImgTarget({ key: 'E:' + code, title: `備品画像：${name || code}` })} toast={toast.show} />}
      </Modal>

      <Modal open={envOpen} onClose={() => setEnvOpen(false)} width={860} title="環境設定">
        {envOpen && <EnvSettings accent={accent} dispCalc={dispCalc} onDispCalc={setDispCalc} sortItems={sortItems} onSortItems={setSortItems} onClose={() => setEnvOpen(false)} onSaved={(desc) => addLog('システム', '', '動作環境設定', `登録（${desc}）`)} toast={toast.show} />}
      </Modal>

      {/* 操作ログ・詳細情報 */}
      <Modal open={logOpen.open} onClose={() => setLogOpen({ open: false })} width={logOpen.code ? 900 : 760} title={logOpen.code ? '操作ログ・詳細情報' : '操作ログ'}>
        <div style={{ padding: '12px 22px 18px', display: 'grid', gridTemplateColumns: logOpen.code ? 'minmax(0,1fr) 300px' : '1fr', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 14 }}>年度</span>
              <select style={{ padding: '6px 10px', border: '1px solid #cfd8e0', borderRadius: 8, fontFamily: 'inherit', fontSize: 14 }}><option>令和8年度（2026年）</option><option>令和7年度（2025年）</option></select>
              {logOpen.code && <span style={{ fontSize: 14, color: '#7a8794' }}>対象：{logOpen.kind} {logOpen.code}</span>}
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>{(['資産', '備品', 'システム'] as const).map((t) => <button key={t} type="button" onClick={() => setLogTab(t)} style={{ padding: '4px 12px', borderRadius: 7, border: 'none', background: logTab === t ? accent : '#f1f4f6', color: logTab === t ? '#fff' : '#5b6773', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{t}</button>)}</span>
            </div>
            <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, overflow: 'auto', maxHeight: 380 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={TH}>日時</th><th style={TH}>対象</th><th style={TH}>操作</th><th style={TH}>担当者</th></tr></thead>
                <tbody>
                  {logRows.length === 0 && <tr><td colSpan={4} style={{ ...TD, textAlign: 'center', color: '#9aa5b1', padding: 30 }}>{logOpen.code ? 'この項目の操作履歴はまだありません（登録後に記録されます）。' : '操作履歴はありません。'}</td></tr>}
                  {[...logRows].reverse().map((l, i) => <tr key={i}><td style={{ ...TD, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 14 }}>{l.time}</td><td style={TD}>{l.target}</td><td style={{ ...TD, fontWeight: 600 }}>{l.action}</td><td style={TD}>{l.user}</td></tr>)}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
              <PrintOutButton name={`操作ログ_${logTab}`} accent={accent} defaultDest="csv" data={() => ({ header: ['日時', '種別', 'コード', '対象', '操作', '担当者'], rows: logRows.map((l) => [l.time, l.kind, l.code, l.target, l.action, l.user]) })} />
              <button type="button" onClick={() => setLogOpen({ open: false })} style={btn()}>閉じる</button>
            </div>
          </div>
          {logOpen.code && (
            <div style={{ borderLeft: '1px solid #eef2f5', paddingLeft: 16, fontSize: 14 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>詳細情報</div>
              {logTargetAsset ? (
                <>
                  {infoRow('資産コード', logTargetAsset.code)}
                  {infoRow('名称', logTargetAsset.name)}
                  {infoRow('科目', logTargetAsset.account)}
                  {infoRow('登録日時', targetLogs[0]?.time ?? '—')}
                  {infoRow('最終更新', targetLogs[targetLogs.length - 1]?.time ?? '—')}
                  {infoRow('更新者', targetLogs[targetLogs.length - 1]?.user ?? '—')}
                  {infoRow('償却計算', `${logTargetAsset.method}／${logTargetAsset.life || '—'}年`)}
                  {infoRow('当期償却額', yen(annualOf(logTargetAsset)))}
                  {infoRow('期首→期末', `${yen(logTargetAsset.opening)} → ${yen(logTargetAsset.opening - annualOf(logTargetAsset))}`)}
                  {infoRow('画像', images['A:' + logTargetAsset.code] ? '添付あり' : 'なし')}
                </>
              ) : logTargetEquip ? (
                <>
                  {infoRow('備品コード', logTargetEquip.code)}
                  {infoRow('名称', logTargetEquip.name)}
                  {infoRow('科目', logTargetEquip.account ?? '—')}
                  {infoRow('取得年月日', logTargetEquip.acquired)}
                  {infoRow('取得価額', yen(logTargetEquip.cost))}
                  {infoRow('登録日時', targetLogs[0]?.time ?? '—')}
                  {infoRow('最終更新', targetLogs[targetLogs.length - 1]?.time ?? '—')}
                  {infoRow('画像', images['E:' + logTargetEquip.code] ? '添付あり' : 'なし')}
                </>
              ) : <div style={{ color: '#9aa5b1' }}>この項目はまだ登録されていません。「登録」後に詳細情報と操作履歴が記録されます。</div>}
            </div>
          )}
        </div>
      </Modal>

      {/* 資産画像／備品画像 */}
      <ImageModal open={!!imgTarget} title={imgTarget?.title ?? ''} src={imgTarget ? images[imgTarget.key] : undefined} accent={accent} toast={toast.show} onClose={() => setImgTarget(null)} onChange={(src) => { if (!imgTarget) return; setImages((m) => { const n = { ...m }; if (src) n[imgTarget.key] = src; else delete n[imgTarget.key]; return n; }); }} />

      {/* 印刷／ファイル出力 */}
      {printReq && <DepPrintModal key={printReq.name} name={printReq.name} accent={accent} onClose={() => setPrintReq(null)} onRun={(opts, output) => { const spec = buildReport(printReq.name, { assets, equips, disposals, logs, single: printReq.single, opts }); if (output === 'preview') { setDepPreview({ title: spec.title, meta: spec.meta, header: spec.header ?? [], rows: spec.rows ?? [] }); return; } setPrintReq(null); setExportSpec({ ...spec, kind: output }); }} />}
      {/* 印刷のプレビュー（印刷画面は閉じずに上に重ねる） */}
      <PreviewModal open={!!depPreview} onClose={() => setDepPreview(null)} title={depPreview?.title ?? ''} accent={accent} pages={1} data={depPreview ? { header: depPreview.header, rows: depPreview.rows } : undefined} />
      <ExportDialog spec={exportSpec} onClose={() => setExportSpec(null)} accent={accent} />
    </main>
  );
}

/* ================= 固定資産 詳細（右パネル） ================= */
function AssetDetail({ accent, asset, imageSrc, onClose, onEdit, onPrint, onDelete }: { accent: string; asset: Asset; imageSrc?: string; onClose: () => void; onEdit: () => void; onPrint: () => void; onDelete: () => void }) {
  const dep = annualOf(asset);
  const btn = (color = '#5b6773', solid = false): CSSProperties => ({ padding: '7px 12px', borderRadius: 7, border: '1px solid ' + (solid ? color : '#cfd8e0'), background: solid ? color : '#fff', color: solid ? '#fff' : color, fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' });
  const row = (l: string, v: string) => <div key={l} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '6px 0', borderBottom: '1px solid #f1f4f6', fontSize: 14 }}><span style={{ color: '#7a8794' }}>{l}</span><span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{v}</span></div>;
  const years: { y: number; open: number; dep: number }[] = [];
  const fy0 = Math.min(acqFy(asset), depStartFy(asset));
  let bal = asset.cost;
  if (asset.life && asset.method !== '減価償却対象外') for (let y = 0; y < depLag(asset) && years.length < 10; y++) years.push({ y: years.length + 1, open: bal, dep: 0 });
  for (let y = 1; y <= Math.min(asset.life || 0, 10) && years.length < 10; y++) { const d = Math.min(Math.floor((asset.cost - 1) / asset.life), Math.max(0, bal - 1)); years.push({ y: years.length + 1, open: bal, dep: d }); bal -= d; }
  return (
    <aside style={{ borderLeft: '1px solid #eef2f5', padding: 18, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        {imageSrc && <img src={imageSrc} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, border: '1px solid #e2e8ee', flex: 'none' }} />}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, color: '#7a8794', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>{asset.code}<span style={statusStyle(asset.status)}>{asset.status}</span>{asset.manual && <span data-manual-badge title="全項目手入力で登録した固定資産です。「変更」も全項目手入力で開きます" style={{ fontSize: 12, fontWeight: 700, padding: '1px 7px', borderRadius: 6, background: '#fff1b8', color: '#8a6d00' }}>全項目手入力</span>}{asset.capexOf && <span style={{ fontSize: 12, fontWeight: 700, padding: '1px 7px', borderRadius: 6, background: '#fff1b8', color: '#8a6d00' }}>資本的支出</span>}</div>
          <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 16, marginTop: 4 }}>{asset.name}</div>
          <div style={{ fontSize: 14, color: '#48565f' }}>{asset.account}</div>
        </div>
        <button type="button" onClick={onClose} title="閉じる" style={{ marginLeft: 'auto', border: 'none', background: 'transparent', fontSize: 20, color: '#8290a0', cursor: 'pointer', lineHeight: 1 }}>×</button>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button type="button" className="submit-btn" onClick={onEdit} style={btn(accent, true)}>変更</button>
        <button type="button" className="btn-outline" onClick={onPrint} title="この資産の台帳を印刷します" style={{ ...btn(), display: 'inline-flex', alignItems: 'center', gap: 6 }}><PrintIcon />印刷</button>
        <button type="button" className="btn-outline" onClick={onDelete} style={{ ...btn('#c0392b'), marginLeft: 'auto' }}>削除</button>
      </div>
      <div>
        {row('取得年月日', asset.acquired)}
        {asset.depStart && row('償却開始年月日', asset.depStart)}
        {asset.capexOf && row('資本的支出', `${asset.capexKind ? CAPEX_LABEL[asset.capexKind] : ''}（元の固定資産 ${asset.capexOf}）`)}
        {row('耐用年数 ／ 償却方法', `${asset.life || '—'}年 ／ ${asset.method}`)}
        {row('取得価額', yen(asset.cost))}
        {row('うち国庫補助金等', yen(asset.subsidy))}
        {row('期首帳簿価額', yen(asset.opening))}
        {row('当期減価償却額（見込）', yen(dep))}
        {row('期末帳簿価額（見込）', yen(asset.opening - dep))}
        {asset.place && row('場所・物量等', asset.place)}
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#8290a0', marginBottom: 6 }}>経年表示（取得した年度からの推移・定額法）</div>
        {years.length === 0 ? <div style={{ fontSize: 14, color: '#9aa5b1' }}>減価償却対象外の資産のため推移はありません。</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={TH}>年度</th><th style={{ ...TH, textAlign: 'right' }}>期首</th><th style={{ ...TH, textAlign: 'right' }}>償却額</th><th style={{ ...TH, textAlign: 'right' }}>期末</th></tr></thead>
            <tbody>{years.map((r) => <tr key={r.y} style={{ background: fy0 + r.y - 1 === THIS_FY ? '#fff7dc' : undefined }}><td style={{ ...TD, padding: '5px 10px', whiteSpace: 'nowrap' }}>{fyLabel(fy0 + r.y - 1)}</td><td style={{ ...NUM, padding: '5px 10px' }}>{yen(r.open)}</td><td style={{ ...NUM, padding: '5px 10px' }}>{yen(r.dep)}</td><td style={{ ...NUM, padding: '5px 10px', fontWeight: 700 }}>{yen(r.open - r.dep)}</td></tr>)}</tbody>
          </table>
        )}
      </div>
    </aside>
  );
}

/* ================= 固定資産登録 ================= */
function AssetForm({ accent, asset, manual, dispCalc, capexFor, onAddCapex, onReset, sortItems, nextCode, imageSrc, onSave, onCancel, onReport, onLog, onImage, toast }: { accent: string; asset: Asset | null; manual: boolean; dispCalc: DispCalc; /** 資本的支出の登録画面として開く */ capexFor?: { kind: CapexKind; parent: Asset }; onAddCapex?: (a: Asset) => void; /** 変更リセット（資本的支出の登録画面） */ onReset?: () => void; sortItems: SortItem[]; nextCode: string; imageSrc?: string; onSave: (a: Asset, note?: string, next?: boolean) => void; onCancel: () => void; onReport: (name: string, single?: Asset) => void; onLog: (code: string) => void; onImage: (code: string, name: string) => void; toast: (m: string) => void }) {
  const [f, setF] = useState({
    code: asset?.code ?? nextCode,
    sort: sortFor(sortItems, asset?.account ?? capexFor?.parent.account ?? '器具及び備品'),
    account: asset?.account ?? capexFor?.parent.account ?? '器具及び備品',
    name: asset?.name ?? (capexFor ? capexFor.parent.name + 'の資本的支出' : ''),
    acquired: asset?.acquired ?? (capexFor ? waToday() : '令和8年 4月 1日'),
    life: asset ? String(asset.life) : capexFor ? String(capexFor.parent.life) : '',
    method: asset?.method ?? capexFor?.parent.method ?? '定額法',
    qty: asset ? String(asset.qty) : '1',
    unit: asset ? String(Math.floor(asset.cost / Math.max(1, asset.qty))) : '',
    memo: '1',
    residual: '0',
    subsidy: asset ? String(asset.subsidy) : '0',
    /** うち償還補助金（補助金総合計の内数） */
    redeem: '0',
    disposal: '設定なし',
    disposalAmt: '',
    disposalDate: '',
    place: asset?.place ?? '',
    purpose: asset?.purpose ?? '',
    afterLife: true,
    useStart: !!asset?.depStart,
    startDate: asset?.depStart ?? '',
    transferNew: false,
  });
  const set = (k: keyof typeof f, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));
  const num = numOf;
  // ダイアログで設定する付随情報
  const [rounding, setRounding] = useState<Rounding>(DEFAULT_ROUNDING);
  const [subsidies, setSubsidies] = useState<SubsidyRow[]>([]);
  const [partial, setPartial] = useState<PartialDisposal | null>(null);
  const [calcChange, setCalcChange] = useState<CalcChange | null>(null);
  /** 資本的支出：選んだ方法と、登録画面を開き直すためのキー（変更リセット） */
  const [capexKind, setCapexKind] = useState<CapexKind | null>(null);
  const [capexKey, setCapexKey] = useState(0);
  const [dlg, setDlg] = useState<'' | 'life' | 'round' | 'subsidy' | 'partial' | 'calc' | 'capexPick'>('');
  /** 経年表示の切替（確認メモ #65） */
  const [yrTab, setYrTab] = useState<(typeof YR_TABS)[number]>('数量／減価償却');

  const qty = num(f.qty);
  const cost = qty * num(f.unit);
  const life = num(f.life);
  const rate = life ? Math.round((1 / life) * (rounding.digits === '4桁' ? 10000 : 1000)) / (rounding.digits === '4桁' ? 10000 : 1000) : 0;
  const annual = life && f.method !== '減価償却対象外' ? roundBy((cost - num(f.residual) - num(f.memo)) / life, rounding.dep) : 0;
  const opening = asset ? asset.opening : 0;
  const c = Math.min(annual, Math.max(0, opening - num(f.memo)));
  const sub = num(f.subsidy);
  const redeem = Math.min(num(f.redeem), sub);
  const totalCost = cost;
  const subOf = (v: number) => (totalCost ? roundBy((v * sub) / totalCost, rounding.sub) : 0);
  const redeemOf = (v: number) => (totalCost ? roundBy((v * redeem) / totalCost, rounding.sub) : 0);
  /* 経年表示と全項目手入力は、償却を開始する年度から年度ごとに並べる（確認メモ #62／#248）。償却開始年月日を使うときはその年度、使わないときは取得した年度 */
  //   償却開始年月日を使うときは、取得した年度に当期増加額が入り、当期減価償却額は 0 円で、開始する年度から償却する（確認メモ #259）
  const fyAcq = fiscalYearOf(f.acquired) ?? THIS_FY;
  const fyStart = (f.useStart ? fiscalYearOf(f.startDate) : null) ?? fyAcq;
  const fy0 = Math.min(fyAcq, fyStart);
  /** 取得した年度から償却を開始する年度までの年数（この間は償却しない） */
  const lag = Math.max(0, fyStart - fyAcq);
  /** 当期にあたる行（償却を開始する年度を先頭の行として数える） */
  const curIdx = Math.min(MAX_YEARS - 1, Math.max(0, THIS_FY - fy0));
  const [mRows, setMRows] = useState<Record<YrTab, MRow[]>>(() => {
    if (asset?.manualRows) return asset.manualRows;
    const r: Record<YrTab, MRow[]> = { '数量／減価償却': blankRows(), '国庫補助金': blankRows(), '償還補助金': blankRows() };
    if (asset) { r['数量／減価償却'][curIdx] = { a: opening, b: 0, c, d: 0 }; r['国庫補助金'][curIdx] = { a: subOf(opening), b: 0, c: subOf(c), d: 0 }; }
    return r;
  });
  /** 「＋ 1年追加」で足した年数 */
  const [extraYears, setExtraYears] = useState(0);
  const mCount = Math.min(MAX_YEARS, Math.max(life + lag, curIdx + 1, 1) + extraYears);
  const setCell = (tab: YrTab, y: number, k: keyof MRow, v: number) => setMRows((s) => ({ ...s, [tab]: s[tab].map((r, i) => (i === y ? { ...r, [k]: v } : r)) }));
  const accTo = (tab: YrTab, y: number) => mRows[tab].slice(0, y + 1).reduce((s, r) => s + r.c, 0);
  const cur = mRows['数量／減価償却'][curIdx];
  /* 償却計算表は「編集」で金額を直接書き換えられる。キャンセルで編集前に戻し、リセットで自動計算に戻す（確認メモ #257） */
  const [calcOv, setCalcOv] = useState<Partial<Record<CalcKey, number>>>({});
  const [calcEdit, setCalcEdit] = useState<{ before: Partial<Record<CalcKey, number>> } | null>(null);
  const pick = (k: CalcKey, auto: number) => (!manual && calcOv[k] != null ? (calcOv[k] as number) : auto);
  const A = pick('A', manual ? cur.a : opening);
  const B = pick('B', manual ? cur.b : asset ? 0 : cost);
  /* 全数量の処分（除却・売却・移管(元)）の当期減価償却額（確認メモ #282）。
     動作環境設定「除却物件および移管物件の当期減価償却額」が
       計算しない … 当期減価償却額は 0 円。期首帳簿価額がそのまま当期減少額になる
       月按分     … 4月から処分した月までの月数で按分する。当期減少額 ＝ 期首帳簿価額 − 当期減価償却額
     売却はこの設定の対象外で、常に月按分する */
  const cYear = asset && THIS_FY >= fyStart ? c : 0;
  const disposing = f.disposal !== '設定なし';
  const dispMonth = disposing && isWarekiComplete(f.disposalDate) ? Number(parseWareki(f.disposalDate).m) : 0;
  const dispMonths = dispMonth ? (dispMonth >= 4 ? dispMonth - 3 : dispMonth + 9) : 0;
  const dispNoCalc = disposing && f.disposal !== '売却' && dispCalc.startsWith('計算しない');
  const cAuto = !disposing ? cYear : dispNoCalc ? 0 : dispMonths ? Math.min(cYear, roundBy((annual * dispMonths) / 12, rounding.prorate)) : cYear;
  const C = pick('C', manual ? cur.c : cAuto);
  const dispQty = partial ? partial.qty : f.disposal !== '設定なし' ? qty : 0;
  // 一部処分は、ダイアログで入力した処分額（当期減少額）を使う（確認メモ #256）
  const D = pick('D', manual ? cur.d : partial?.decrease != null ? partial.decrease : dispQty && qty ? Math.floor(((A + B - C) * dispQty) / qty) : 0);
  const E = A + B - C - D;
  /** 一部処分で減る取得原価（数量で按分） */
  const removedCost = !manual && partial && qty ? Math.floor((totalCost * partial.qty) / qty) : 0;
  const F = manual ? accTo('数量／減価償却', curIdx) : totalCost - removedCost - E;
  const G = E + F;
  /** 経年表示の行（償却を開始する年度から、耐用年数の年度まで） */
  const yrHead = yrTab === '償還補助金' ? YR_HEAD_REDEEM : YR_HEAD_BOOK;
  /** 自動計算の年度ごとの値（償却を開始する年度から、耐用年数の年度まで） */
  const autoYears = Math.min(life + lag, MAX_YEARS);
  const autoBook = (isSub: boolean): MRow[] => {
    let book = 0; let bal = 0;
    return Array.from({ length: autoYears }, (_, y) => {
      // 固定資産そのものの当期減価償却額（国庫補助金は、これに比例して取り崩す）
      const assetOpen = book + (y === 0 ? totalCost : 0);
      const assetDep = y < lag ? 0 : Math.max(0, Math.min(annual, assetOpen - num(f.memo)));
      book = assetOpen - assetDep;
      const row: MRow = { a: bal, b: y === 0 ? (isSub ? sub : totalCost) : 0, c: isSub ? subOf(assetDep) : assetDep, d: 0 };
      bal = row.a + row.b - row.c;
      return row;
    });
  };
  const autoRedeem = (): MRow[] => { const n = Math.max(1, autoYears - lag); const per = Math.floor(redeem / n); let rest = redeem; return Array.from({ length: autoYears }, (_, y) => { const k = y - lag; const b = k < 0 ? 0 : k === n - 1 ? rest : per; const a = rest; rest -= b; return { a, b, c: 0, d: 0 }; }); };
  const yrCell = (v: number, bold = false, bg?: string) => <td style={{ ...NUM, padding: '6px 6px', fontSize: 13, fontWeight: bold ? 700 : 400, whiteSpace: 'nowrap', overflow: 'hidden', color: v < 0 ? '#c0392b' : undefined, background: bg }}>{yen(v)}</td>;
  const yrRows = () => {
    const empty = (msg: string) => <tr><td colSpan={yrHead.length} style={{ ...TD, textAlign: 'center', color: '#9aa5b1', padding: 24 }}>{msg}</td></tr>;
    if (!cost || !life || f.method === '減価償却対象外') return empty('取得価額と耐用年数を入力すると年度ごとの推移を表示します。');
    // 年度は「〇年目」ではなく、償却を開始する年度からの年度で表示する。当期の行は色を付ける（確認メモ #248）
    const curBg = (y: number) => (fy0 + y === THIS_FY ? '#fff7dc' : undefined);
    const yearTd = (y: number) => <td title={fy0 + y === THIS_FY ? '当期' : undefined} style={{ ...TD, padding: '6px 6px', fontSize: 13, whiteSpace: 'nowrap', background: curBg(y), color: fy0 + y === THIS_FY ? '#8a6d00' : undefined, fontWeight: fy0 + y === THIS_FY ? 700 : 400 }}>{fyLabel(fy0 + y)}</td>;
    if (yrTab === '償還補助金') {
      if (!redeem) return empty('償還補助金は設定されていません（「補助金設定」で、うち償還補助金額を入力します）。');
      return autoRedeem().map((r, y) => <tr key={y}>{yearTd(y)}{yrCell(r.a, false, curBg(y))}{yrCell(r.b, false, curBg(y))}{yrCell(r.a - r.b, true, curBg(y))}</tr>);
    }
    const isSub = yrTab === '国庫補助金';
    if (isSub && !sub) return empty('国庫補助金等は設定されていません（「補助金設定」で入力します）。');
    let acc = 0;
    return autoBook(isSub).map((r, y) => { acc += r.c; const bg = curBg(y); return <tr key={y}>{yearTd(y)}{yrCell(r.a, false, bg)}{yrCell(r.b, false, bg)}{yrCell(r.c, false, bg)}{yrCell(0, false, bg)}{yrCell(r.a + r.b - r.c, true, bg)}{yrCell(acc, false, bg)}{yrCell(isSub ? sub : totalCost, false, bg)}</tr>; });
  };
  /* ---- 全項目手入力の表（確認メモ #62） ---- */
  /** 選択中の表に、自動計算の値を入れる（耐用年数ぶん。それより後の年度は入力したまま残す） */
  const fillAuto = () => {
    if (!cost || !life || f.method === '減価償却対象外') return toast('取得価額と耐用年数を入力すると、自動計算の値を入れられます');
    if (yrTab === '償還補助金' && !redeem) return toast('償還補助金が設定されていません（「補助金設定」で入力します）');
    if (yrTab === '国庫補助金' && !sub) return toast('国庫補助金等が設定されていません（「補助金設定」で入力します）');
    const src = yrTab === '償還補助金' ? autoRedeem() : autoBook(yrTab === '国庫補助金');
    setMRows((s) => ({ ...s, [yrTab]: s[yrTab].map((r, i) => src[i] ?? r) }));
    toast(`「${yrTab}」の表に、自動計算の値を ${src.length} 年ぶん入れました`);
  };
  /** Enter で次の欄へ（行の最後なら次の年度の先頭へ）。変換確定の Enter は無視する */
  const mEnter = (e: KeyboardEvent<HTMLInputElement>, y: number, ki: number, n: number) => {
    if (e.key !== 'Enter' || noIme(e)) return;
    e.preventDefault();
    const [ny, nk] = ki + 1 < n ? [y, ki + 1] : [y + 1, 0];
    document.querySelector<HTMLInputElement>(`[data-m="${ny}-${nk}"]`)?.focus();
  };
  const manualRowsView = () => {
    const redeemTab = yrTab === '償還補助金';
    const keys: (keyof MRow)[] = redeemTab ? ['a', 'b'] : ['a', 'b', 'c', 'd'];
    let acc = 0;
    return mRows[yrTab].slice(0, mCount).map((r, y) => {
      const end = endOf(r, redeemTab); acc += r.c;
      const isCur = y === curIdx;
      const bg = isCur ? '#fff7dc' : '#fff';
      return (
        <tr key={y} data-m-row={y} data-m-cur={isCur ? '1' : undefined}>
          <td title={isCur ? '当期' : undefined} style={{ ...TD, padding: '4px 6px', fontSize: 13, whiteSpace: 'nowrap', background: bg, lineHeight: 1.3, color: isCur ? '#8a6d00' : undefined, fontWeight: isCur ? 700 : 400 }}>{fyLabel(fy0 + y)}{isCur && <div style={{ fontSize: 11 }}>当期</div>}</td>
          {keys.map((k, ki) => <td key={k} style={{ ...NUM, padding: '3px 3px', background: bg }}><input className="field-input" data-m={`${y}-${ki}`} value={r[k] ? yen(r[k]) : ''} placeholder="0" onChange={(e) => setCell(yrTab, y, k, num(e.target.value))} onFocus={(e) => e.target.select()} onKeyDown={(e) => mEnter(e, y, ki, keys.length)} inputMode="numeric" style={{ ...numIn, padding: '4px 5px', width: '100%', fontSize: 13 }} /></td>)}
          {yrCell(end, true, bg)}{!redeemTab && yrCell(acc, false, bg)}{!redeemTab && yrCell(end + acc, false, bg)}
        </tr>
      );
    });
  };

  const input: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '5px 8px', border: '1px solid #cfd8e0', borderRadius: 7, fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#fff' };
  const numIn: CSSProperties = { ...input, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
  const lbl: CSSProperties = { fontSize: 12, fontWeight: 700, color: '#8290a0', marginBottom: 3, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
  const sec: CSSProperties = { fontSize: 12, fontWeight: 800, color: '#b7791f', background: '#fff7dc', display: 'inline-block', padding: '2px 8px', borderRadius: 6, marginBottom: 6 };
  const box: CSSProperties = capexFor ? { border: '1px solid #e3c065', background: '#fff6d6', borderRadius: 10, padding: 10 } : { border: '1px solid #f0c8cc', background: '#fff5f6', borderRadius: 10, padding: 10 };
  const btn = (color = '#5b6773', solid = false): CSSProperties => ({ padding: '7px 12px', borderRadius: 7, border: '1px solid ' + (solid ? color : '#cfd8e0'), background: solid ? color : '#fff', color: solid ? '#fff' : color, fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' });
  const tag = (t: string) => <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: '#e8f0fb', color: '#2c5f9e', whiteSpace: 'nowrap' }}>{t}</span>;
  const current = (): Asset => ({ code: f.code, name: f.name.trim() || '（未入力）', account: f.account, acquired: f.acquired, life, cost: totalCost, status: f.disposal === '移管(元)' || asset?.status === '移管年度' ? '移管年度' : asset?.status === '移管取込' ? '移管取込' : f.method === '減価償却対象外' || !life ? '対象外' : E <= num(f.memo) ? '償却終了' : '償却中', opening: E, subsidy: sub, method: f.method, qty, place: f.place, purpose: f.purpose, transferIn: asset?.transferIn || f.transferNew, depStart: f.useStart && f.startDate.trim() ? f.startDate.trim() : undefined, manualRows: manual ? mRows : asset?.manualRows, manual: manual || asset?.manual || undefined, capexOf: capexFor?.parent.code ?? asset?.capexOf, capexKind: capexFor?.kind ?? asset?.capexKind });
  const save = (next?: boolean) => {
    if (!f.name.trim()) return toast('資産名称を入力してください');
    if (!cost) return toast('取得価額（数量×単価）を入力してください');
    if (f.method !== '減価償却対象外' && !life) return toast('耐用年数を入力してください');
    if (f.disposal !== '設定なし' && !isWarekiComplete(f.disposalDate)) return toast('処分年月日を入力してください');
    if (f.useStart && !isWarekiComplete(f.startDate)) return toast('償却開始年月日を入力してください');
    const notes = [capexFor && `資本的支出：${CAPEX_LABEL[capexFor.kind]}・元の固定資産 ${capexFor.parent.code}`, calcChange && `計算変更：${calcChange.reason}`, partial && `一部${partial.proc} ${partial.qty}/${qty}`, f.disposal !== '設定なし' && `${f.disposal} ${f.disposalDate}`].filter(Boolean).join('、');
    onSave(current(), notes || undefined, next);
  };

  /* Enter で次の入力欄へ（伝票入力と同じ。確認メモ #254）。最後の欄からは「登録して次を入力」（変更のときは「登録」）へ。
     日本語入力の変換を確定する Enter は無視する。ボタンの上の Enter はそのボタンを押す */
  const formRef = useRef<HTMLDivElement>(null);
  const inputsRef = useRef<HTMLDivElement>(null);
  const fields = () => Array.from(inputsRef.current?.querySelectorAll<HTMLElement>('input:not([type=checkbox]):not([type=radio]), select') ?? []).filter((el) => !(el as HTMLInputElement).disabled && el.getClientRects().length > 0);
  const focusEl = (el: HTMLElement | null | undefined) => { el?.focus(); if (el instanceof HTMLInputElement) el.select(); };
  const onEnterNext = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || e.nativeEvent.isComposing || e.keyCode === 229) return;
    const list = fields();
    const i = list.indexOf(e.target as HTMLElement);
    if (i < 0) return;
    e.preventDefault();
    focusEl(list[i + 1] ?? formRef.current?.querySelector<HTMLElement>(asset || capexFor ? '[data-asset-save]' : '[data-asset-next]'));
  };
  // 開いたら最初の入力欄へ（新規の登録のとき。続けて登録するときも、ここから入力できる）
  useEffect(() => {
    if (asset) return;
    const t = window.setTimeout(() => focusEl(fields()[0]), 80);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const disabledBg = (on: boolean): CSSProperties => ({ background: on ? '#fff' : '#f5f7f9' });
  // 償却計算表の 国庫補助金等／うち償還補助金。全項目手入力では、国庫補助金の表の当期の行を出す
  const sc = mRows['国庫補助金'][curIdx];
  const scE = endOf(sc, false);
  const scF = accTo('国庫補助金', curIdx);
  const redeemPart = (v: number) => (sub ? roundBy((v * redeem) / sub, rounding.sub) : 0);
  const sv = [pick('sA', subOf(A)), pick('sB', subOf(B)), pick('sC', subOf(C)), pick('sD', subOf(D))];
  const subEdited = (['sA', 'sB', 'sC', 'sD'] as const).some((k) => calcOv[k] != null);
  const sE = subEdited ? sv[0] + sv[1] - sv[2] - sv[3] : subOf(E);
  const subRow = manual ? [sc.a, sc.b, sc.c, sc.d, scE, scF, scE + scF] : [...sv, sE, subEdited ? sub - sE : subOf(F), sub];
  const calcEditing = !manual && !!calcEdit;
  const setOv = (k: CalcKey, v: number) => setCalcOv((o) => ({ ...o, [k]: v }));
  const calcInput = (k: CalcKey, v: number) => <input className="field-input" data-calc-edit={k} value={yen(v)} onChange={(e) => setOv(k, num(e.target.value))} onFocus={(e) => e.target.select()} inputMode="numeric" style={{ ...numIn, padding: '3px 5px', fontSize: 13, background: calcOv[k] != null ? '#fffbea' : '#fff' }} />;
  const calcEdited = Object.keys(calcOv).length > 0;
  const redeemRow = manual ? [sc.a, sc.b, sc.c, sc.d, scE].map(redeemPart) : [A, B, C, D, E].map(redeemOf);

  // 償却計算表の見出しは 2 行に分ける（列の幅を金額に合わせ、横にはみ出さないように）
  const calcHead = ['期首帳簿価額\n(A)', '当期増加額\n(B)', '当期減価償却額\n(C)', '当期減少額\n(D)', '期末帳簿価額\n(E=A+B-C-D)', '減価償却累計額\n(F)', '期末取得原価\n(G=E+F)'];
  const calcTd: CSSProperties = { ...NUM, padding: '6px 8px', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden' };
  const calcLbl: CSSProperties = { ...TD, padding: '6px 8px', fontSize: 13, whiteSpace: 'nowrap' };
  const fbtn: CSSProperties = { ...btn(), padding: '6px 11px' };
  const calcBtn = (color = '#5b6773'): CSSProperties => ({ padding: '2px 7px', borderRadius: 6, border: '1px solid ' + (color === '#5b6773' ? '#cfd8e0' : color), background: '#fff', color, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' });

  return (
    // 1600×768 で、画面全体が縦にも横にもスクロールしない配置にする。縦にスクロールするのは右の経年表示の表だけ（確認メモ #249／#250）
    //   左：入力欄と償却計算表、右：経年表示、下：帳票・計算変更などのボタンと「登録」
    <div data-asset-form data-capex-form={capexFor ? capexFor.kind : undefined} ref={formRef} onKeyDown={onEnterNext} style={{ background: capexFor ? '#fffdf3' : undefined, flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) min(700px, 46%)', gridTemplateRows: 'minmax(0,1fr) auto' }}>
      <div ref={inputsRef} style={{ padding: '12px 14px', borderRight: '1px solid #eef2f5', display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, minHeight: 0, overflow: 'auto' }}>
        <div style={box}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0,1fr))', gap: 8 }}>
            <div><span style={lbl}>資産コード</span><input className="field-input" value={f.code} onChange={(e) => set('code', e.target.value)} title="新規の登録では自動で採番します。手入力で変更できます" style={{ ...input, background: '#fff9c4', fontWeight: 700 }} /></div>
            <div><span style={lbl}>並び順項目</span><select value={f.sort} onChange={(e) => set('sort', e.target.value)} style={input}>{sortItems.map((o) => <option key={o.code} value={o.code}>{sortLabel(o)}</option>)}</select></div>
            <div style={{ gridColumn: 'span 2' }}><span style={lbl}>科目</span><select value={f.account} onChange={(e) => set('account', e.target.value)} style={input}>{FA_ACCOUNTS.map((o) => <option key={o}>{o}</option>)}</select></div>
            <div style={{ gridColumn: 'span 2' }}><span style={lbl}>取得年月日</span><WarekiDate value={f.acquired} onChange={(v) => set('acquired', v)} accent={accent} /></div>
            <div style={{ gridColumn: 'span 2' }}><span style={lbl}>資産名称</span><input className="field-input ring" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="例：調理室エアコン" style={input} /></div>
            {/* 「償却開始年月日を使用する」を入れると、年月日の入力欄を別枠（黄色の枠）で出す（確認メモ #64） */}
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ ...lbl, display: 'flex', gap: 5, alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={f.useStart} onChange={() => setF((s) => ({ ...s, useStart: !s.useStart, startDate: s.startDate || s.acquired }))} data-use-start style={{ margin: 0 }} />償却開始年月日を使用する</label>
              {f.useStart
                ? <WarekiDate value={f.startDate} onChange={(v) => set('startDate', v)} tone="start" dataAttr="data-dep-start" accent={accent} />
                : <div style={{ ...input, background: '#f5f7f9', color: '#9aa5b1', whiteSpace: 'nowrap', overflow: 'hidden' }}>取得年月日と同じ</div>}
            </div>
            <div><span style={lbl}>耐用年数</span><div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input className="field-input" value={f.life} onChange={(e) => set('life', e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" style={{ ...numIn, minWidth: 0, flex: 1 }} /><span style={{ fontSize: 14 }}>年</span><button type="button" className="btn-outline" onClick={() => setDlg('life')} style={{ ...btn(), padding: '5px 10px' }}>辞書</button></div></div>
            <div><span style={lbl}>償却方法</span><select value={f.method} onChange={(e) => set('method', e.target.value)} style={input}>{METHODS.map((o) => <option key={o}>{o}</option>)}</select></div>
            <div style={{ gridColumn: 'span 2' }}><span style={lbl}>償却率</span><div style={{ ...input, background: '#f5f7f9', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden' }}>{f.method} {life}年　<b>{rate}</b></div></div>
            <div style={{ gridColumn: 'span 2' }}><span style={lbl}>場所・物量等</span><input className="field-input" value={f.place} onChange={(e) => set('place', e.target.value)} style={input} /></div>
            <div style={{ gridColumn: 'span 2' }}><span style={lbl}>使用目的</span><input className="field-input" value={f.purpose} onChange={(e) => set('purpose', e.target.value)} style={input} /></div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 14, fontSize: 14, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={f.afterLife} onChange={() => set('afterLife', !f.afterLife)} />耐用年数経過後も償却する</label>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={f.transferNew} onChange={() => set('transferNew', !f.transferNew)} />移管先固定資産として新規登録</label>
              <span title={`償却額：${rounding.dep}／取崩額：${rounding.sub}／償却率 ${rounding.digits}`} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#7a8794' }}>端数 {rounding.dep}・{rounding.sub}・{rounding.digits}</span>
                <button type="button" className="btn-outline" onClick={() => setDlg('round')} style={{ ...btn(), padding: '5px 10px' }}>端数処理設定</button>
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.45fr) minmax(0,1fr)', gap: 8 }}>
          <div style={box}>
            <span style={sec}>取得価額</span>
            <div style={{ display: 'grid', gridTemplateColumns: '64px 12px minmax(0,1fr) 12px minmax(0,1fr)', gap: 6, alignItems: 'end' }}>
              <div><span style={lbl}>数量</span><input className="field-input" value={f.qty} onChange={(e) => set('qty', e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" style={numIn} /></div>
              <div style={{ textAlign: 'center', paddingBottom: 7 }}>×</div>
              <div><span style={lbl}>単価</span><input className="field-input ring" value={f.unit ? yen(num(f.unit)) : ''} onChange={(e) => set('unit', e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" placeholder="0" style={numIn} /></div>
              <div style={{ textAlign: 'center', paddingBottom: 7 }}>＝</div>
              <div><span style={lbl}>取得価額合計</span><div style={{ ...numIn, background: '#f5f7f9', whiteSpace: 'nowrap', overflow: 'hidden' }}>{yen(cost)}</div></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,0.8fr) minmax(0,0.8fr) minmax(0,1.2fr) minmax(0,1.2fr) auto', gap: 6, alignItems: 'end', marginTop: 6 }}>
              <div><span style={lbl}>備忘価額</span><input className="field-input" value={f.memo} onChange={(e) => set('memo', e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" style={numIn} /></div>
              <div><span style={lbl}>残存価額</span><input className="field-input" value={f.residual} onChange={(e) => set('residual', e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" style={numIn} /></div>
              <div><span style={lbl}>補助金総合計</span><input className="field-input" data-subsidy-total value={yen(sub)} onChange={(e) => set('subsidy', e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" style={numIn} /></div>
              <div><span style={lbl}>うち償還補助金</span><input className="field-input" data-redeem-input value={yen(num(f.redeem))} onChange={(e) => set('redeem', e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" title="補助金総合計のうち、償還補助金にあたる額（補助金総合計を超えては計算しません）" style={{ ...numIn, ...(num(f.redeem) > sub ? { border: '1px solid #c0392b', background: '#fdeee9' } : {}) }} /></div>
              <button type="button" className="btn-outline" onClick={() => setDlg('subsidy')} style={{ ...btn(), padding: '5px 10px' }}>補助金設定{subsidies.length > 0 && `（${subsidies.length}件）`}</button>
            </div>
          </div>
          {capexFor && (() => {
            // 資本的支出を行う固定資産の情報（表示のみ。現行システムと同じピンクの枠。資産処分等の枠の位置に出す）
            const p = capexFor.parent;
            const it = (l: string, v: string, span = 1) => <div key={l} style={{ minWidth: 0, gridColumn: `span ${span}` }}><span style={lbl}>{l}</span><div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontVariantNumeric: 'tabular-nums' }}>{v}</div></div>;
            return (
              <div data-capex-parent style={{ border: '2px solid #eea2ab', background: '#fff', borderRadius: 10, padding: '8px 10px' }}>
                <span style={{ ...sec, color: '#b03a48', background: '#fdecee' }}>資本的支出を行う固定資産の情報</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: '4px 8px' }}>{it('資産コード', p.code)}{it('資産名称', p.name, 2)}{it('取得年月日', p.acquired)}{it('耐用年数', `${p.life}年`)}{it('償却方法', p.method)}{it('取得価額', yen(p.cost))}{it('期首帳簿価額', yen(p.opening))}</div>
              </div>
            );
          })()}
          {!capexFor && <div style={box}>
            <span style={sec}>資産処分等</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 6 }}>
              <select value={f.disposal} onChange={(e) => { set('disposal', e.target.value); if (e.target.value !== '設定なし') setPartial(null); }} style={input}>{['設定なし', '除却', '売却', '移管(元)'].map((o) => <option key={o}>{o}</option>)}</select>
              {/* 除却・移管(元)は当期減少額を自動で入れる。売却は売却額を入力する（確認メモ #287） */}
              {f.disposal === '除却' || f.disposal === '移管(元)'
                ? <div data-disp-amt title={`${f.disposal}額：当期減少額（D）を自動で表示します`} style={{ ...numIn, background: '#f5f7f9', whiteSpace: 'nowrap', overflow: 'hidden' }}><span style={{ float: 'left', fontSize: 12, color: '#7a8794' }}>{f.disposal}額</span>{yen(D)}</div>
                : <input className="field-input" data-disp-amt value={f.disposalAmt ? yen(num(f.disposalAmt)) : ''} onChange={(e) => set('disposalAmt', e.target.value.replace(/[^0-9]/g, ''))} placeholder={f.disposal === '売却' ? '売却額を入力' : '除却／売却／移管(元)額'} title={f.disposal === '売却' ? '売却額を入力します' : undefined} disabled={f.disposal === '設定なし'} inputMode="numeric" style={{ ...numIn, ...disabledBg(f.disposal !== '設定なし') }} />}
              <div style={{ gridColumn: '1 / -1' }}><WarekiDate value={f.disposalDate} onChange={(v) => set('disposalDate', v)} disabled={f.disposal === '設定なし'} title="処分年月日" accent={accent} /></div>
              <button type="button" className="btn-outline" title="一部 除却／売却／移管(元)（数量の一部を処分する）" onClick={() => { const replay = isMemoReplaying(); if (!cost && !replay) return toast('先に取得価額を入力してください'); if (f.disposal !== '設定なし' && !replay) return toast('全数量の処分が設定されています。一部処分は「設定なし」に戻してから行ってください'); setDlg('partial'); }} style={{ ...btn(), padding: '5px 10px' }}>一部処分</button>
            </div>
            {partial && <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: '#48565f', flexWrap: 'wrap' }}>{tag(`一部${partial.proc}`)}{partial.qty}／{qty} 個・{partial.date}・処分額（当期減少額） {yen(D)}</div>}
            {disposing && !manual && <div data-disp-note style={{ marginTop: 6, fontSize: 12, color: '#7a5c00', lineHeight: 1.5 }}>
              {dispNoCalc
                ? '動作環境設定「計算しない」：当期減価償却額は 0 円、期首帳簿価額をそのまま当期減少額にします'
                : dispMonths
                  ? `${f.disposal === '売却' ? '売却' : '動作環境設定「月按分」'}：4月〜${dispMonth}月の ${dispMonths} か月分を当期減価償却額にし、残りを当期減少額にします`
                  : `${f.disposal === '売却' ? '売却' : '動作環境設定「月按分」'}：処分年月日を入れると、4月から処分した月までの月数で当期減価償却額を計算します`}
            </div>}
          </div>}
        </div>

        {/* 償却計算表 */}
        <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, overflow: 'hidden', flex: 'none' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup><col style={{ width: 132 }} />{calcHead.map((h) => <col key={h} />)}</colgroup>
            <thead><tr><th style={{ ...TH, padding: '4px 6px', verticalAlign: 'bottom' }}>
              {!manual && <div data-calc-tools style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {calcEditing
                  ? <button type="button" data-calc-cancel onClick={() => { setCalcOv(calcEdit?.before ?? {}); setCalcEdit(null); toast('編集前の金額に戻しました'); }} title="編集を取り消して、編集前の金額に戻します" style={calcBtn()}>キャンセル</button>
                  : <button type="button" data-calc-edit-start onClick={() => setCalcEdit({ before: { ...calcOv } })} title="この表の金額を直接書き換えます" style={calcBtn(accent)}>編集</button>}
                <button type="button" data-calc-reset disabled={!calcEdited} onClick={() => { setCalcOv({}); setCalcEdit(null); toast('自動計算の金額に戻しました'); }} title="手で書き換えた金額をやめ、自動計算の金額に戻します" style={{ ...calcBtn(), opacity: calcEdited ? 1 : 0.45, cursor: calcEdited ? 'pointer' : 'default' }}>リセット</button>
              </div>}
            </th>{calcHead.map((h) => <th key={h} style={{ ...TH, padding: '6px 5px', fontSize: 12, textAlign: 'right', whiteSpace: 'pre', lineHeight: 1.35, verticalAlign: 'bottom', overflow: 'hidden' }}>{h}</th>)}</tr></thead>
            <tbody>
              <tr>
                <td style={{ ...calcLbl, fontWeight: 700 }}>取得価額</td>
                {(['A', 'B', 'C', 'D'] as const).map((k) => <td key={k} style={calcTd}>{calcEditing ? calcInput(k, { A, B, C, D }[k]) : manual ? <input className="field-input" data-cur={k} value={yen({ A, B, C, D }[k])} onChange={(e) => setCell('数量／減価償却', curIdx, ({ A: 'a', B: 'b', C: 'c', D: 'd' } as const)[k], num(e.target.value))} inputMode="numeric" style={{ ...numIn, padding: '3px 5px', fontSize: 13 }} /> : yen({ A, B, C, D }[k])}</td>)}
                <td style={{ ...calcTd, fontWeight: 700 }}>{yen(E)}</td><td style={calcTd}>{yen(F)}</td><td style={calcTd}>{yen(G)}</td>
              </tr>
              <tr><td style={calcLbl}>国庫補助金等の額</td>{subRow.map((v, k) => <td key={k} style={calcTd}>{calcEditing && k < 4 ? calcInput((['sA', 'sB', 'sC', 'sD'] as const)[k], v) : yen(v)}</td>)}</tr>
              <tr><td style={{ ...calcLbl, color: '#7a8794', borderBottom: 'none' }}>（うち償還補助金）</td>{redeemRow.map((v, k) => <td key={k} style={{ ...calcTd, borderBottom: 'none' }}>{yen(v)}</td>)}<td style={{ ...calcTd, borderBottom: 'none' }} /><td style={{ ...calcTd, borderBottom: 'none' }} /></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 右：経年表示。減価償却・国庫補助金は 期首帳簿価額〜期末取得原価、償還補助金は 未入金額の推移（確認メモ #65）。全項目手入力では、年度ごとの入力表になる（確認メモ #62）。
           年度は償却を開始する年度から表示する（確認メモ #248）。縦にスクロールするのはこの表だけ（確認メモ #250） */}
      <div data-yr-view style={{ padding: '12px 14px', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{manual ? '全項目手入力　年度ごとの入力' : '選択中の固定資産　経年表示'}</span>
          <span style={{ fontSize: 12, color: '#7a8794' }}>{fyLabel(fy0)}（償却開始）から{manual ? `　${mCount} 年ぶんを表示（最大 ${MAX_YEARS} 年）` : ''}</span>
        </div>
        {manual && <div style={{ padding: '6px 10px', background: '#fff1b8', borderRadius: 8, fontSize: 12, color: '#8a6d00', fontWeight: 700, lineHeight: 1.6 }}>自動計算を行わず、償却を開始する年度からすべての年度（最大 {MAX_YEARS} 年）の金額を、この表に直接入力します。色のついた行が当期（{fyLabel(THIS_FY)}）で、左の償却計算表と同じ値です。</div>}
        <div style={{ display: 'flex', gap: 10, fontSize: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          {YR_TABS.map((t) => <label key={t} style={{ display: 'flex', gap: 4, alignItems: 'center' }}><input type="radio" name="yr" checked={yrTab === t} onChange={() => setYrTab(t)} data-yr-tab={t} />{t}</label>)}
          {manual && <button type="button" className="btn-outline" onClick={fillAuto} style={{ ...btn(), marginLeft: 'auto', padding: '4px 10px' }}>自動計算の値を入れる</button>}
        </div>
        <div data-yr-scroll style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', border: '1px solid #e2e8ee', borderRadius: 8 }}>
          <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <colgroup>{yrHead.map((h, k) => <col key={h} style={k ? undefined : { width: 92 }} />)}</colgroup>
            <thead><tr>{yrHead.map((h, k) => <th key={h} style={{ ...TH, padding: '6px 6px', fontSize: 12, textAlign: k ? 'right' : 'left', whiteSpace: 'pre', lineHeight: 1.35, verticalAlign: 'bottom', position: 'sticky', top: 0, zIndex: 1 }}>{h}</th>)}</tr></thead>
            <tbody>{manual ? manualRowsView() : yrRows()}</tbody>
          </table>
        </div>
        {manual && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="btn-outline" disabled={mCount >= MAX_YEARS} onClick={() => setExtraYears((n) => n + 1)} style={{ ...btn(), padding: '4px 10px', opacity: mCount >= MAX_YEARS ? 0.5 : 1 }}>＋ 1年追加</button>
            <button type="button" className="btn-outline" disabled={mCount >= MAX_YEARS} onClick={() => setExtraYears(MAX_YEARS)} style={{ ...btn(), padding: '4px 10px', opacity: mCount >= MAX_YEARS ? 0.5 : 1 }}>{MAX_YEARS}年まで表示</button>
            <span style={{ fontSize: 12, color: '#7a8794' }}>Enter で次の欄へ進みます。</span>
          </div>
        )}
        <div style={{ fontSize: 12, color: '#9aa5b1', lineHeight: 1.6 }}>
          {manual
            ? `${yrTab === '償還補助金' ? '期末未入金額' : '期末帳簿価額・減価償却累計額・期末取得原価'}は、入力した金額から表示します。「自動計算の値を入れる」は、選択中の表の耐用年数ぶんを上書きします。`
            : yrTab === '償還補助金' ? '償還補助金の入金額は、耐用年数で均等に入金する見込みとして表示しています（プロトタイプのサンプル）。' : yrTab === '国庫補助金' ? '国庫補助金等の取崩額は、固定資産の当期減価償却額に比例して計算しています。' : '償却を開始する年度から耐用年数の年度までを表示します。色のついた行が当期です。'}
        </div>
      </div>

      {/* 下：帳票・計算変更などと「登録」（画面の幅いっぱいに 1 行で並べる） */}
      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '10px 14px', borderTop: '1px solid #eef2f5', background: capexFor ? '#fff6d6' : '#fbfcfd' }}>
        {!capexFor && <>
        <span style={{ ...sec, marginBottom: 0 }}>帳票</span>
        {['個別固定資産管理台帳', '別紙３(⑧)', '固定資産管理台帳'].map((r) => <button key={r} type="button" className="btn-outline" onClick={() => { if (r !== '固定資産管理台帳' && !cost) return toast('取得価額を入力すると帳票を出力できます'); onReport(r, r === '固定資産管理台帳' ? undefined : current()); }} style={fbtn}>{r}</button>)}
        <span style={{ width: 1, height: 22, background: '#dde4ea', margin: '0 4px' }} />
        <button type="button" className="btn-outline" onClick={() => setDlg('calc')} title={calcChange ? `${calcChange.reason}（${calcChange.date}）${calcChange.note ? `：${calcChange.note}` : ''}` : '耐用年数・償却方法・取得価額などの変更'} style={fbtn}>計算変更{calcChange && '（適用済み）'}</button>
        {/* 資本的支出は登録済みの固定資産だけで使える。使えない新規の登録ではボタンを出さない */}
        {asset && <button type="button" className="btn-outline" data-capex-open onClick={() => setDlg('capexPick')} title="改良・増設などの資本的支出を登録します" style={fbtn}>資本的支出</button>}
        </>}
        <button type="button" className="btn-outline" onClick={() => onLog(f.code)} style={fbtn}>操作ログ・詳細情報</button>
        <button type="button" className="btn-outline" onClick={() => onImage(f.code, f.name)} style={{ ...fbtn, display: 'inline-flex', alignItems: 'center', gap: 6 }}>{imageSrc && <img src={imageSrc} alt="" style={{ width: 18, height: 18, objectFit: 'cover', borderRadius: 3 }} />}資産画像</button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#7a8794' }}>Enter で次の項目へ</span>
          {!asset && !capexFor && <button type="button" className="btn-outline" data-asset-next onClick={() => save(true)} title="登録して、続けて次の固定資産を入力します" style={{ ...btn(accent), padding: '8px 18px', fontSize: 14 }}>登録して次を入力</button>}
          {capexFor && onReset && <button type="button" className="btn-outline" data-capex-reset onClick={() => { onReset(); toast('開いたときの内容に戻しました'); }} title="入力した内容を、開いたときの状態に戻します" style={{ ...btn(), padding: '8px 18px', fontSize: 14 }}>変更リセット</button>}
          <button type="button" className="submit-btn" data-asset-save onClick={() => save()} style={{ ...btn(accent, true), padding: '8px 26px', fontSize: 14 }}>登録</button>
          <button type="button" onClick={onCancel} style={{ ...btn(), padding: '8px 20px', fontSize: 14 }}>キャンセル</button>
        </div>
      </div>

      {dlg === 'life' && <LifeDictModal accent={accent} onClose={() => setDlg('')} onPick={(d) => { setF((s) => ({ ...s, life: String(d.life), account: d.account })); toast(`耐用年数 ${d.life} 年をセットしました`); }} />}
      {dlg === 'round' && <RoundingModal accent={accent} value={rounding} onClose={() => setDlg('')} onSave={(r) => { setRounding(r); toast('端数処理を設定しました'); }} />}
      {dlg === 'subsidy' && <SubsidyModal accent={accent} rows={subsidies} cost={totalCost} toast={toast} onClose={() => setDlg('')} onSave={(rows) => { setSubsidies(rows); setF((x) => ({ ...x, subsidy: String(rows.reduce((s, r) => s + r.amount, 0)), redeem: String(rows.reduce((s, r) => s + r.redeem, 0)) })); toast('補助金を設定しました'); }} />}
      {dlg === 'partial' && <PartialModal accent={accent} qty={qty} cost={totalCost} vals={{ A, B, C }} value={partial} toast={toast} onClose={() => setDlg('')} onApply={(p) => { setPartial(p); if (p) { set('disposalAmt', String(p.amount)); set('disposalDate', p.date); toast(`一部${p.proc}（${p.qty}／${qty}）を設定しました`); } else toast('一部処分を取り消しました'); }} />}
      {dlg === 'calc' && <CalcChangeModal accent={accent} current={{ life, method: f.method, unit: num(f.unit) }} toast={toast} onClose={() => setDlg('')} onApply={(ch) => { setCalcChange(ch); setF((s) => ({ ...s, life: ch.reason === '耐用年数の変更' ? String(ch.life) : s.life, method: ch.reason === '償却方法の変更' ? ch.method : s.method, unit: ch.reason === '取得価額の訂正' ? String(ch.unit) : s.unit })); toast(`計算変更（${ch.reason}）を適用しました`); }} />}
      {dlg === 'capexPick' && asset && <CapexChoiceModal parent={asset} onClose={() => setDlg('')} onPick={(k) => { setDlg(''); setCapexKey((n) => n + 1); setCapexKind(k); }} />}
      {capexKind && asset && (
        <Modal open onClose={() => setCapexKind(null)} width={1540} style={{ maxHeight: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} title={<>資本的支出の登録<span style={{ marginLeft: 8, fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: '#b7791f', color: '#fff' }}>{CAPEX_LABEL[capexKind]}</span></>}>
          <AssetForm key={capexKey} accent={accent} asset={null} manual={false} dispCalc={dispCalc} capexFor={{ kind: capexKind, parent: asset }} sortItems={sortItems} nextCode={nextCode} onSave={(a) => { onAddCapex?.(a); setCapexKind(null); }} onReset={() => setCapexKey((n) => n + 1)} onCancel={() => setCapexKind(null)} onReport={onReport} onLog={onLog} onImage={onImage} toast={toast} />
        </Modal>
      )}
    </div>
  );
}

/* ================= 備品登録 ================= */
function EquipForm({ accent, equips, sortItems, imageSrc, onSave, onCancel, onReport, onLog, onImage, toast }: { accent: string; equips: Equip[]; sortItems: SortItem[]; imageSrc: Record<string, string>; onSave: (e: Equip) => void; onCancel: () => void; onReport: (name: string) => void; onLog: (code: string) => void; onImage: (code: string, name: string) => void; toast: (m: string) => void }) {
  const [f, setF] = useState({ code: String(equips.reduce((m, e) => Math.max(m, Number(e.code)), 0) + 1).padStart(5, '0'), sort: '', account: '', name: '', acquired: '令和8年 4月 1日', qty: '1', unit: '', subsidy: '0', disposal: '設定なし', disposalAmt: '', disposalDate: '' });
  const [subsidies, setSubsidies] = useState<SubsidyRow[]>([]);
  const [subOpen, setSubOpen] = useState(false);
  const num = numOf;
  const total = num(f.qty) * num(f.unit);
  const input: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '6px 9px', border: '1px solid #cfd8e0', borderRadius: 7, fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#fff' };
  const lbl: CSSProperties = { fontSize: 12, fontWeight: 700, color: '#8290a0', marginBottom: 4, display: 'block' };
  const btn = (color = '#5b6773', solid = false): CSSProperties => ({ padding: '7px 12px', borderRadius: 7, border: '1px solid ' + (solid ? color : '#cfd8e0'), background: solid ? color : '#fff', color: solid ? '#fff' : color, fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' });
  const img = imageSrc['E:' + f.code];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(300px,1fr)' }}>
      <div style={{ padding: 18, borderRight: '1px solid #eef2f5', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ border: '1px solid #f0c8cc', background: '#fff5f6', borderRadius: 10, padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div><span style={lbl}>備品コード</span><input className="field-input" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} style={{ ...input, fontWeight: 700 }} /></div>
          <div><span style={lbl}>並び順項目</span><select value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value })} style={input}><option value="">（なし）</option>{sortItems.map((o) => <option key={o.code} value={o.code}>{sortLabel(o)}</option>)}</select></div>
          <div><span style={lbl}>科目</span><select value={f.account} onChange={(e) => setF({ ...f, account: e.target.value })} style={input}><option value="">選択</option><option>消耗器具備品費</option><option>器具及び備品</option></select></div>
          <div style={{ gridColumn: 'span 2' }}><span style={lbl}>備品名称</span><input className="field-input ring" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="例：ノートパソコン" style={input} /></div>
          <div><span style={lbl}>取得年月日</span><WarekiDate value={f.acquired} onChange={(v) => setF({ ...f, acquired: v })} accent={accent} /></div>
          <div><span style={lbl}>備品処分等</span><select value={f.disposal} onChange={(e) => setF({ ...f, disposal: e.target.value })} style={input}>{['設定なし', '除却', '売却', '移管(元)'].map((o) => <option key={o}>{o}</option>)}</select></div>
          <div><span style={lbl}>除却／売却／移管元額</span><input className="field-input" value={f.disposalAmt ? yen(num(f.disposalAmt)) : ''} onChange={(e) => setF({ ...f, disposalAmt: e.target.value.replace(/[^0-9]/g, '') })} disabled={f.disposal === '設定なし'} inputMode="numeric" style={{ ...input, textAlign: 'right', background: f.disposal === '設定なし' ? '#f5f7f9' : '#fff' }} /></div>
          <div><span style={lbl}>処分年月日</span><WarekiDate value={f.disposalDate} onChange={(v) => setF({ ...f, disposalDate: v })} disabled={f.disposal === '設定なし'} accent={accent} /></div>
        </div>
        <div style={{ border: '1px solid #f0c8cc', background: '#fff5f6', borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#b7791f', background: '#fff7dc', display: 'inline-block', padding: '2px 8px', borderRadius: 6, marginBottom: 8 }}>取得価額</div>
          <div style={{ display: 'grid', gridTemplateColumns: '70px 20px 160px 40px 160px 1fr', gap: 6, alignItems: 'end' }}>
            <div><span style={lbl}>数量</span><input className="field-input" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value.replace(/[^0-9]/g, '') })} inputMode="numeric" style={{ ...input, textAlign: 'right' }} /></div>
            <div style={{ textAlign: 'center', paddingBottom: 8 }}>×</div>
            <div><span style={lbl}>単価</span><input className="field-input ring" value={f.unit ? yen(num(f.unit)) : ''} onChange={(e) => setF({ ...f, unit: e.target.value.replace(/[^0-9]/g, '') })} inputMode="numeric" placeholder="0" style={{ ...input, textAlign: 'right' }} /></div>
            <div style={{ textAlign: 'center', paddingBottom: 8 }}>＝</div>
            <div><span style={lbl}>合計額</span><div style={{ ...input, textAlign: 'right', background: '#f5f7f9' }}>{yen(total)}</div></div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'end' }}><div style={{ flex: 1 }}><span style={lbl}>うち補助金</span><input className="field-input" value={yen(num(f.subsidy))} onChange={(e) => setF({ ...f, subsidy: e.target.value.replace(/[^0-9]/g, '') })} inputMode="numeric" style={{ ...input, textAlign: 'right' }} /></div><button type="button" className="btn-outline" onClick={() => setSubOpen(true)} style={btn()}>補助金設定{subsidies.length > 0 && `（${subsidies.length}件）`}</button></div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#b7791f', background: '#fff7dc', padding: '2px 8px', borderRadius: 6 }}>帳票</span>
          {['備品一覧表(1)', '備品一覧表(2)'].map((r) => <button key={r} type="button" className="btn-outline" onClick={() => onReport(r)} style={btn()}>{r}</button>)}
          <button type="button" className="btn-outline" onClick={() => onLog(f.code)} style={btn()}>操作ログ・詳細情報</button>
          <button type="button" className="btn-outline" onClick={() => onImage(f.code, f.name)} style={{ ...btn(), display: 'inline-flex', alignItems: 'center', gap: 6 }}>{img && <img src={img} alt="" style={{ width: 18, height: 18, objectFit: 'cover', borderRadius: 3 }} />}備品画像</button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button type="button" className="submit-btn" onClick={() => { if (!f.name.trim()) return toast('備品名称を入力してください'); if (!total) return toast('取得価額を入力してください'); onSave({ code: f.code, name: f.name.trim(), acquired: f.acquired, cost: total, account: f.account || undefined, qty: num(f.qty), subsidy: num(f.subsidy) }); setF({ ...f, code: String(num(f.code) + 1).padStart(5, '0'), name: '', unit: '', subsidy: '0' }); setSubsidies([]); }} style={{ ...btn(accent, true), padding: '9px 26px', fontSize: 14 }}>登録</button>
            <button type="button" onClick={onCancel} style={{ ...btn(), padding: '9px 20px', fontSize: 14 }}>キャンセル</button>
          </div>
        </div>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>備品一覧</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={TH}>備品コード</th><th style={TH}>備品名称</th><th style={TH}>取得年月日</th><th style={{ ...TH, textAlign: 'right' }}>取得価額</th></tr></thead>
          <tbody>{equips.map((e) => <tr key={e.code}><td style={TD}>{e.code}</td><td style={TD}>{e.name}</td><td style={TD}>{e.acquired}</td><td style={NUM}>{yen(e.cost)}</td></tr>)}</tbody>
        </table>
      </div>
      {subOpen && <SubsidyModal accent={accent} rows={subsidies} cost={total} toast={toast} onClose={() => setSubOpen(false)} onSave={(rows) => { setSubsidies(rows); setF((s) => ({ ...s, subsidy: String(rows.reduce((a, r) => a + r.amount, 0)) })); toast('補助金を設定しました'); }} />}
    </div>
  );
}

/* ================= 一括処理 ================= */
function BatchView({ accent, dispCalc, assets, preselected, disposals, onExport, onDone, toast }: { accent: string; dispCalc: DispCalc; assets: Asset[]; preselected: Set<string>; disposals: Disposal[]; onExport: (s: ExportSpec) => void; onDone: (entries: Disposal[]) => void; toast: (m: string) => void }) {
  const sess = useSession();
  const [sel, setSel] = useState<Set<string>>(new Set(preselected));
  const [proc, setProc] = useState<Record<string, string>>({});
  const [amt, setAmt] = useState<Record<string, string>>({});
  /** 処分年月日は固定資産ごとに持つ。一括セットで選んだ行にまとめて入れ、あとから行ごとに変えられる（確認メモ #246） */
  const [dates, setDates] = useState<Record<string, string>>({});
  const [bulk, setBulk] = useState('設定なし');
  const [date, setDate] = useState('');
  const [history, setHistory] = useState<HistoryRow[]>([{ time: '2026/03/31 17:20:11', file: 'ikan_moto_20260331.csv', count: 1, user: USER, result: '正常終了' }]);
  const [histOpen, setHistOpen] = useState(false);
  /** 移管先の区分を選んで、その場で移管する（確認メモ #247） */
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTo, setMoveTo] = useState('');
  const [moveView, setMoveView] = useState<'ツリー' | '一覧'>('ツリー');
  const num = numOf;
  const btn = (color = '#5b6773', solid = false): CSSProperties => ({ padding: '8px 14px', borderRadius: 8, border: '1px solid ' + (solid ? color : '#cfd8e0'), background: solid ? color : '#fff', color: solid ? '#fff' : color, fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' });
  const input: CSSProperties = { padding: '5px 8px', border: '1px solid #cfd8e0', borderRadius: 6, fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#fff' };
  const dateOf = (code: string) => (isWarekiComplete(dates[code] ?? '') ? (dates[code] ?? '').trim() : '');
  const dateInput = (code: string) => {
    const ok = !!dateOf(code);
    return <span data-dispose-date={code} title={ok ? undefined : '処分年月日を入力してください'} style={{ display: 'inline-flex', padding: ok ? 0 : 2, borderRadius: 8, background: ok ? undefined : '#fde9c8' }}><WarekiDate value={dates[code] ?? ''} onChange={(v) => setDates((m) => ({ ...m, [code]: v }))} accent={accent} /></span>;;
  };
  const applyBulk = () => {
    if (sel.size === 0) return toast('固定資産を選択してください');
    const d = date.trim();
    setProc((p) => { const n = { ...p }; sel.forEach((c) => (n[c] = bulk)); return n; });
    if (d) setDates((m) => { const n = { ...m }; sel.forEach((c) => (n[c] = d)); return n; });
    toast(`${sel.size} 件に「${bulk}」${d ? `と処分年月日（${d}）` : ''}をセットしました`);
  };
  const targets = assets.filter((a) => (proc[a.code] ?? '設定なし') !== '設定なし');
  const done = new Map(disposals.map((d) => [d.code, d]));
  const exportTransfer = () => {
    const rows = [...targets.filter((a) => proc[a.code] === '移管(元)'), ...disposals.filter((d) => d.proc === '移管(元)' && !targets.some((t) => t.code === d.code)).map((d) => assets.find((a) => a.code === d.code)).filter((a): a is Asset => !!a)];
    if (rows.length === 0) return toast('移管(元)を設定した固定資産がありません');
    const d = new Date();
    const file = `ikan_moto_${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
    setHistory((h) => [...h, { time: stamp(), file: file + '.csv', count: rows.length, user: USER, result: '正常終了' }]);
    onExport({ kind: 'csv', title: '移管(元)ファイル', fileName: file, meta: `移管先で「移管取込」に読み込むファイル（${rows.length} 件）`, header: ['資産コード', '移管元名称', '固定資産名称', '科目', '移管年月日', '数量', '単価', '取得移管価額', '期首帳簿価額', 'うち国庫補助金等', '耐用年数', '償却方法'], rows: rows.map((a) => [a.code, 'チャイルド保育園', a.name, a.account, done.get(a.code)?.date ?? dateOf(a.code), a.qty, Math.floor(a.cost / Math.max(1, a.qty)), a.cost, a.opening, a.subsidy, a.life, a.method]) });
  };
  const register = () => {
    if (targets.length === 0) return toast('処理を設定した固定資産がありません');
    const noDate = targets.filter((a) => !dateOf(a.code));
    if (noDate.length) return toast(`処分年月日が入っていない固定資産が ${noDate.length} 件あります。一括セットするか、行ごとに入力してください`);
    if (targets.some((a) => proc[a.code] === '売却' && !num(amt[a.code]))) return toast('売却する固定資産の売却額を入力してください');
    if (!confirm(`${targets.length} 件の固定資産に処理（除却・売却・移管）を登録します。よろしいですか？`)) return;
    onDone(targets.map((a) => ({ code: a.code, name: a.name, account: a.account, proc: proc[a.code], date: dateOf(a.code), amount: proc[a.code] === '売却' ? num(amt[a.code]) : 0, opening: a.opening, cost: a.cost, subsidy: a.subsidy })));
  };
  // 移管する固定資産：処理を「移管(元)」にしたもの。なければ、チェックしたもの（登録済みは除く）
  const moveMarked = assets.filter((a) => proc[a.code] === '移管(元)');
  const moveList = moveMarked.length ? moveMarked : assets.filter((a) => sel.has(a.code) && !done.has(a.code));
  const allDiv = flattenDivisions(sess.tree);
  /** 移管先に選べる区分：伝票を入力する区分（園など）のうち、使用中で、いま開いている区分以外 */
  const canMoveTo = (n: DivisionNode) => n.use !== false && !!n.entry && divisionLabel(n) !== sess.division;
  const openMove = () => {
    if (moveList.length === 0) return toast('移管する固定資産を選んでください（行頭のチェック、または処理を「移管(元)」にします）');
    // 処分年月日が空の行には、一括セットの処分年月日を入れておく
    const d = date.trim();
    if (d) setDates((m) => { const n = { ...m }; moveList.forEach((a) => { if (!(n[a.code] ?? '').trim()) n[a.code] = d; }); return n; });
    setMoveTo('');
    setMoveOpen(true);
  };
  const runMove = () => {
    if (!moveTo) return toast('移管先の区分を選んでください');
    if (moveList.some((a) => !dateOf(a.code))) return toast('処分年月日（移管する日）を入力してください');
    if (!confirm(`${moveList.length} 件の固定資産を「${moveTo}」へ移管します。よろしいですか？`)) return;
    onDone(moveList.map((a) => ({ code: a.code, name: a.name, account: a.account, proc: '移管(元)', date: dateOf(a.code), amount: 0, opening: a.opening, cost: a.cost, subsidy: a.subsidy, to: moveTo })));
    setMoveOpen(false);
  };
  const tdS: CSSProperties = { ...TD, padding: '7px 12px' };
  return (
    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 1fr', gap: 12 }}>
        <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, padding: 12, fontSize: 14, lineHeight: 1.8 }}><b>処理の手順</b><br />①固定資産の選択<br />②一括セット<br />③固定資産ごとの調整（処分年月日・売却額）<br />④登録で完了</div>
        <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>登録前の一括セット</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 14 }}>
            処理の選択 <select value={bulk} onChange={(e) => setBulk(e.target.value)} style={input}>{['設定なし', '除却', '売却', '移管(元)'].map((o) => <option key={o}>{o}</option>)}</select>
            処分年月日 <WarekiDate value={date} onChange={setDate} accent={accent} />
            <button type="button" className="btn-outline" onClick={applyBulk} style={btn(accent, true)}>一括セット</button>
          </div>
          <div style={{ fontSize: 12, color: '#7a8794', marginTop: 8 }}>処分年月日は、一括セットのあとに一覧の行ごとに入力・変更できます。</div>
        </div>
        <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, padding: 12, fontSize: 14, lineHeight: 1.7 }}>
          <div><b>除却・売却・移管 固定資産当期減価償却額の設定状態</b></div>
          <div data-disp-calc>{dispCalc}</div>
          <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button type="button" className="btn-outline" onClick={() => { setProc({}); setDates({}); setSel(new Set()); toast('処理を取り消しました'); }} style={btn()}>処理取消</button>
            <button type="button" className="btn-outline" data-move-open onClick={openMove} title="移管先の区分（園など）を選んで、その場で移管します" style={{ ...btn(accent), borderColor: accent }}>移管先を選んで移管</button>
            <button type="button" className="btn-outline" onClick={exportTransfer} style={btn()}>移管(元)ファイル出力</button>
            <button type="button" className="btn-outline" onClick={() => setHistOpen(true)} style={btn()}>出力履歴{history.length > 0 && `（${history.length}）`}</button>
          </div>
        </div>
      </div>
      <div style={{ overflow: 'auto', maxHeight: 460, border: '1px solid #e2e8ee', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={{ ...TH, width: 36 }}><input type="checkbox" checked={sel.size === assets.length} onChange={(e) => setSel(e.target.checked ? new Set(assets.map((a) => a.code)) : new Set())} /></th><th style={TH}>処理</th><th style={TH}>資産コード</th><th style={TH}>固定資産名称</th><th style={{ ...TH, textAlign: 'right' }}>取得価額</th><th style={{ ...TH, textAlign: 'right' }}>耐用年数</th><th style={TH}>処分年月日</th><th style={{ ...TH, textAlign: 'right' }}>期首帳簿価額</th><th style={{ ...TH, textAlign: 'right' }}>うち国庫補助金等</th><th style={{ ...TH, textAlign: 'right' }}>処分額または売却額</th></tr></thead>
          <tbody>
            {assets.map((a) => {
              const p = proc[a.code] ?? '設定なし';
              const dn = done.get(a.code);
              return (
                <tr key={a.code} style={{ background: p !== '設定なし' ? '#fff8c4' : dn ? '#f5f7f9' : 'transparent', opacity: dn && p === '設定なし' ? 0.7 : 1 }}>
                  <td style={TD}><input type="checkbox" checked={sel.has(a.code)} onChange={() => setSel((s) => { const n = new Set(s); n.has(a.code) ? n.delete(a.code) : n.add(a.code); return n; })} /></td>
                  <td style={TD}>{dn && p === '設定なし' ? <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: '#fff1b8', color: '#8a6d00' }}>{dn.proc} 登録済</span> : <select value={p} onChange={(e) => setProc({ ...proc, [a.code]: e.target.value })} style={input}>{['設定なし', '除却', '売却', '移管(元)'].map((o) => <option key={o}>{o}</option>)}</select>}</td>
                  <td style={TD}>{a.code}</td><td style={{ ...TD, fontWeight: 500 }}>{a.name}</td><td style={NUM}>{yen(a.cost)}</td><td style={NUM}>{a.life}</td>
                  {/* 処分年月日は行ごとに入力できる（確認メモ #246） */}
                  <td style={{ ...TD, padding: '6px 10px', whiteSpace: 'nowrap' }}>{p !== '設定なし' ? dateInput(a.code) : dn ? <>{dn.date}{dn.to && <div style={{ fontSize: 12, color: '#2c5f9e' }}>移管先：{dn.to}</div>}</> : ''}</td>
                  <td style={NUM}>{yen(a.opening)}</td><td style={NUM}>{yen(a.subsidy)}</td>
                  <td style={NUM}>{dn && p === '設定なし' ? yen(dn.amount) : <input className="field-input" value={amt[a.code] ? yen(num(amt[a.code])) : ''} onChange={(e) => setAmt({ ...amt, [a.code]: e.target.value.replace(/[^0-9]/g, '') })} disabled={p !== '売却'} placeholder="0" inputMode="numeric" style={{ ...input, width: 110, textAlign: 'right', background: p === '売却' ? '#fff' : '#f5f7f9' }} />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <span style={{ fontSize: 14, color: '#7a8794', alignSelf: 'center' }}>処理対象 {targets.length} 件{disposals.length > 0 && `　／　登録済 ${disposals.length} 件`}</span>
        <button type="button" className="submit-btn" onClick={register} style={btn(accent, true)}>登録</button>
      </div>
      <HistoryModal open={histOpen} title="移管(元)ファイル 出力履歴" rows={history} onClose={() => setHistOpen(false)} />

      {/* 移管先の区分を選んで移管（会計の区分の選択と同じ組織図・一覧。確認メモ #247） */}
      <Modal open={moveOpen} onClose={() => setMoveOpen(false)} width={1000} title="移管先の区分を選んで移管">
        <div data-move-dialog style={{ padding: '12px 22px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 14, color: '#5b6773', lineHeight: 1.7 }}>移管先の区分（園など）を選んで「移管する」を押すと、この区分（{sess.division}）では移管(元)として処理し、移管先の区分の固定資産台帳に登録します。移管(元)ファイルの出力と取込みは要りません。</div>
          <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, overflow: 'auto', maxHeight: 150 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={{ ...TH, padding: '7px 12px' }}>資産コード</th><th style={{ ...TH, padding: '7px 12px' }}>固定資産名称</th><th style={{ ...TH, padding: '7px 12px' }}>科目</th><th style={{ ...TH, padding: '7px 12px', textAlign: 'right' }}>期首帳簿価額</th><th style={{ ...TH, padding: '7px 12px', textAlign: 'right' }}>うち国庫補助金等</th><th style={{ ...TH, padding: '7px 12px' }}>処分年月日（移管する日）</th></tr></thead>
              <tbody>{moveList.map((a) => <tr key={a.code}><td style={tdS}>{a.code}</td><td style={{ ...tdS, fontWeight: 600 }}>{a.name}</td><td style={{ ...tdS, color: '#48565f' }}>{a.account}</td><td style={{ ...NUM, padding: '7px 12px' }}>{yen(a.opening)}</td><td style={{ ...NUM, padding: '7px 12px' }}>{yen(a.subsidy)}</td><td style={{ ...tdS, padding: '5px 12px' }}>{dateInput(a.code)}</td></tr>)}</tbody>
            </table>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>移管先の区分</span>
            <span role="radiogroup" aria-label="区分の表示方法" style={{ display: 'inline-flex', border: '1px solid #cfd8e0', borderRadius: 8, overflow: 'hidden' }}>
              {(['ツリー', '一覧'] as const).map((v) => <button key={v} type="button" role="radio" aria-checked={moveView === v} onClick={() => setMoveView(v)} style={{ padding: '4px 12px', border: 'none', background: moveView === v ? accent : '#fff', color: moveView === v ? '#fff' : '#5b6773', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{v}</button>)}
            </span>
            <span style={{ marginLeft: 'auto' }}>{moveView === 'ツリー' && <OrgChartLegend />}</span>
          </div>
          {moveView === 'ツリー'
            ? <DivisionOrgChart tree={sess.tree} accent={accent} isSelected={(n) => moveTo === divisionLabel(n)} onSelect={(n) => setMoveTo(divisionLabel(n))} onConfirm={(n) => setMoveTo(divisionLabel(n))} canSelect={canMoveTo} hint="クリックで移管先に選びます" maxHeight="32vh" />
            : <DivisionList items={allDiv} accent={accent} selected={moveTo} onSelect={setMoveTo} onConfirm={setMoveTo} canSelect={canMoveTo} maxHeight="32vh" />}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14 }}>移管先：<b data-move-to style={{ color: moveTo ? accent : '#9aa5b1' }}>{moveTo || '（未選択）'}</b></span>
            <span style={{ fontSize: 12, color: '#9aa5b1' }}>伝票を入力する区分だけを選べます（いま開いている区分は選べません）。</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setMoveOpen(false)} style={btn()}>キャンセル</button>
              <button type="button" className="submit-btn" data-move-run disabled={!moveTo} onClick={runMove} style={{ ...btn(accent, true), opacity: moveTo ? 1 : 0.5 }}>移管する（{moveList.length} 件）</button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ================= 決算機能 ================= */
/** 伝票形式 → 会計の仕訳の種別（確認メモ #239／#245） */
const KIND_OF_FORMAT: Record<string, JVoucher['kind']> = { 仕訳伝票形式: '伝票', 単一式形式: '単一', 振替伝票形式: '振替', 振替単一形式: '振単' };
/** 決算伝票を登録する伝票入力区分（サンプル） */
const CLOSING_SERVICE = '002 保育事業';
function ClosingView({ accent, vouchers, setVouchers, onCreated, toast }: { accent: string; vouchers: Voucher[]; setVouchers: (f: (v: Voucher[]) => Voucher[]) => void; onCreated: (name: string, proc: string, n: number) => void; toast: (m: string) => void }) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [v, setV] = useState({ name: '', format: '仕訳伝票形式', proc: '減価償却', acc: false, one: false, date: '令和9年 3月31日' });
  const [add, setAdd] = useState<Set<string>>(new Set(['土地', '建物', '構築物', '器具及び備品', 'ソフト等']));
  const [kari, setKari] = useState<Record<string, string>>({});
  const [kashi, setKashi] = useState<Record<string, string>>({});
  const [summ, setSumm] = useState<Record<string, string>>({});
  const [pick, setPick] = useState<{ col: 'kari' | 'kashi' | 'summ'; name: string } | null>(null);
  /** 作成した伝票のプレビュー（確認メモ #245）：表示する決算伝票（vouchers の番号）と、会計の伝票画面で開いている仕訳の id */
  const [doneIdx, setDoneIdx] = useState<number | null>(null);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const journal = useVouchers(true);
  const btn = (color = '#5b6773', solid = false): CSSProperties => ({ padding: '9px 22px', borderRadius: 8, border: '1px solid ' + (solid ? color : '#cfd8e0'), background: solid ? color : '#eef0fa', color: solid ? '#fff' : '#22303c', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' });
  const input: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '7px 10px', border: '1px solid #cfd8e0', borderRadius: 7, fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#fff' };
  const ROWS: { g?: string; name: string; account: string; A: number; As: number; B: number; Bs: number; C: number; Cs: number }[] = [
    { g: '基本財産', name: '土地', account: '土地　－基本財産－', A: 5803427, As: 0, B: 0, Bs: 0, C: 0, Cs: 0 },
    { name: '建物', account: '建物　－基本財産－', A: 4349772, As: 2934626, B: 0, Bs: 0, C: 546084, Cs: 391018 },
    { g: 'その他固定資産財産(有形)', name: '構築物', account: '構築物', A: 613666, As: 0, B: 1667600, Bs: 0, C: 114918, Cs: 0 },
    { name: '器具及び備品', account: '器具及び備品', A: 2408668, As: 0, B: 628670, Bs: 0, C: 726229, Cs: 0 },
    { g: 'その他固定資産財産(無形)', name: 'ソフト等', account: 'ソフトウェア', A: 0, As: 0, B: 440000, Bs: 299200, C: 14666, Cs: 9973 },
  ];
  const defKari = v.proc === '国庫補助金取崩' ? '国庫補助金等特別積立金' : v.proc === '売却損益' ? '固定資産売却損・処分損' : v.proc.startsWith('処分') ? '固定資産除却・廃棄損' : '減価償却費';
  const defKashi = (r: (typeof ROWS)[number]) => (v.proc === '国庫補助金取崩' ? '国庫補助金等特別積立金取崩額' : r.account);
  const defSumm = v.proc === '国庫補助金取崩' ? '国庫補助金等特別積立金取崩' : v.proc === '売却損益' ? '固定資産売却' : v.proc.startsWith('処分') ? '固定資産除却' : '当期減価償却';
  const kariOf = (n: string) => kari[n] ?? defKari;
  const kashiOf = (r: (typeof ROWS)[number]) => kashi[r.name] ?? defKashi(r);
  const summOf = (n: string) => summ[n] ?? defSumm;
  /** 伝票を作成する：会計の仕訳伝票に登録し、最後に会計の伝票画面と同じ画面で表示する（確認メモ #245） */
  const finish = () => {
    const name = v.name.trim() || '決算伝票';
    const kind = KIND_OF_FORMAT[v.format] ?? '伝票';
    const lines = ROWS.filter((r) => add.has(r.name)).map((r) => ({ r, amount: v.proc === '国庫補助金取崩' ? r.Cs : r.C })).filter((x) => x.amount > 0);
    if (lines.length === 0) return toast('伝票にする金額がありません（伝票へ追加する科目を確認してください）');
    const m = v.date.match(/(\d+)\s*月\s*(\d+)\s*日/);
    const date = m ? `${Number(m[1])}/${Number(m[2])}` : '3/31';
    const no = `決${vouchers.length + 1}`;
    // 「一枚伝票に登録」：科目ごとの行を 1 枚の伝票にまとめる。単一式形式は 1 伝票 1 行のため、科目ごとに伝票を分ける
    const oneSlip = v.one && kind !== '単一';
    const batch = `imp-dep-${Date.now()}`;
    const ids = lines.map((x, i) => addVoucher({ kind, date, no: oneSlip ? no : `${no}-${i + 1}`, kari: kariOf(x.r.name), kashi: kashiOf(x.r), tekiyo: summOf(x.r.name), amount: x.amount, ...(kind === '振替' ? { kariAmount: x.amount, kashiAmount: x.amount } : {}), service: CLOSING_SERVICE, shohyo: false, source: 'インポート', from: '減価償却', batch }).id);
    setVouchers((vs) => [...vs, { name, date: v.date, format: v.format, proc: v.proc, ids }]);
    onCreated(name, v.proc, lines.length);
    toast(`「${name}」を作成し、会計の仕訳伝票に登録しました（${lines.length} 行）`);
    setV({ ...v, name: '' });
    setDoneIdx(vouchers.length);
    setStep(4);
    setPreviewId(ids[0]);
  };
  const removeVoucher = (i: number) => {
    const x = vouchers[i];
    if (!confirm(`「${x.name}」を削除します。会計の仕訳伝票からも削除されます。よろしいですか？`)) return;
    if (x.ids?.length) deleteVouchers(x.ids);
    setVouchers((vs) => vs.filter((_, k) => k !== i));
    toast(`「${x.name}」を削除しました`);
  };
  // 科目・摘要のボタン：列の幅いっぱいに広げ、文字は 2 行まで。はみ出す分は「…」にしてツールチップで全文を出す（確認メモ #284）
  const cellBtn = (label: string, changed: boolean, onClick: () => void) => <button type="button" className="btn-outline" data-closing-cell onClick={onClick} title={label} style={{ ...btn(), width: '100%', padding: '4px 8px', fontSize: 12, lineHeight: 1.35, textAlign: 'left', whiteSpace: 'normal', wordBreak: 'break-all', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', background: changed ? '#fff7dc' : '#eef0fa', borderColor: changed ? '#e6c76a' : '#cfd8e0' }}>{label}</button>;

  /* ---- 作成した伝票のプレビュー（確認メモ #245）。伝票を押すと、会計の伝票画面（伝票の訂正）で同じ内容を表示する ---- */
  if (step === 4 && doneIdx != null && vouchers[doneIdx]) {
    const x = vouchers[doneIdx];
    const rows = journal.filter((r) => x.ids?.includes(r.id));
    const groups = groupVouchers(rows);
    const total = rows.reduce((a, r) => a + r.amount, 0);
    const previewV = journal.find((r) => r.id === previewId) ?? null;
    const tdS: CSSProperties = { ...TD, padding: '8px 12px' };
    return (
      <div data-closing-preview style={{ padding: 18 }}>
        <div style={{ padding: '8px 14px', background: '#eaf5ef', borderRadius: 10, fontSize: 14, fontWeight: 700, color: '#1f7a52' }}>「{x.name}」を会計の仕訳伝票に登録しました。伝票の「会計の伝票画面で表示」を押すと、会計の伝票の画面で内容を確認・訂正できます。</div>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 14, color: '#5b6773', margin: '12px 0 10px' }}>
          <span>伝票年月日 <b style={{ color: '#22303c' }}>{x.date}</b></span>
          <span>伝票形式 <b style={{ color: '#22303c' }}>{x.format}</b></span>
          <span>決算処理 <b style={{ color: '#22303c' }}>{x.proc}</b></span>
          <span>伝票 <b style={{ color: '#22303c' }}>{groups.length} 件</b>（明細 {rows.length} 行）</span>
          <span>金額の合計 <b style={{ color: '#22303c', fontVariantNumeric: 'tabular-nums' }}>{yen(total)} 円</b></span>
        </div>
        <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, overflow: 'auto', maxHeight: 'calc(100vh - 430px)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={TH}>伝票No</th><th style={{ ...TH, width: 40 }}>行</th><th style={TH}>借方科目</th><th style={TH}>貸方科目</th><th style={TH}>摘要</th><th style={{ ...TH, textAlign: 'right' }}>金額</th><th style={{ ...TH, width: 200 }} /></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={7} style={{ ...TD, textAlign: 'center', color: '#9aa5b1', padding: 30 }}>この決算伝票の仕訳は、会計側で削除されています。</td></tr>}
              {groups.map((g) => g.rows.map((r, i) => (
                <tr key={r.id} data-preview-row style={{ background: g.rows.some((y) => y.id === previewId) ? '#fff8c4' : undefined }}>
                  <td style={{ ...tdS, fontWeight: 700 }}>{i === 0 ? g.head.no : ''}</td>
                  <td style={{ ...tdS, color: '#7a8794' }}>{i + 1}</td>
                  <td style={tdS}>{r.kari}</td><td style={tdS}>{r.kashi}</td><td style={tdS}>{r.tekiyo}</td>
                  <td style={{ ...NUM, padding: '8px 12px', fontWeight: 700 }}>{yen(r.amount)}</td>
                  <td style={{ ...tdS, textAlign: 'right' }}>{i === 0 && <button type="button" className="btn-outline" data-open-slip onClick={() => setPreviewId(g.head.id)} style={{ ...btn(accent), padding: '4px 12px', fontSize: 12, background: '#fff', borderColor: accent, color: accent }}>会計の伝票画面で表示</button>}</td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button type="button" className="submit-btn" onClick={() => { setStep(1); setDoneIdx(null); setPreviewId(null); }} style={btn(accent, true)}>作成済みの決算伝票の一覧へ</button>
        </div>
        {/* 会計の伝票画面（仕訳一覧・元帳から開く「伝票の訂正」と同じ画面） */}
        <EditVoucherModal voucher={previewV} onClose={() => setPreviewId(null)} accent={accent} returnTo="減価償却の決算処理" />
      </div>
    );
  }
  if (step === 1 || step === 4) return (
    <div style={{ padding: 18 }}>
      <div style={{ fontSize: 14, fontWeight: 700 }}>作成済みの決算伝票</div>
      <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, marginTop: 8, minHeight: 220 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={TH}>伝票の名称</th><th style={TH}>伝票年月日</th><th style={TH}>伝票形式</th><th style={TH}>決算処理</th><th style={{ ...TH, width: 140 }}>伝票</th><th style={{ ...TH, width: 80 }}>削除</th></tr></thead>
          <tbody>
            {vouchers.length === 0 && <tr><td colSpan={6} style={{ ...TD, textAlign: 'center', color: '#9aa5b1', padding: 40 }}>登録済みの決算伝票はありません。「新しい伝票を作成」から作成してください。</td></tr>}
            {vouchers.map((x, i) => <tr key={i}><td style={{ ...TD, fontWeight: 600 }}>{x.name}</td><td style={TD}>{x.date}</td><td style={TD}>{x.format}</td><td style={TD}>{x.proc}</td><td style={TD}><button type="button" className="btn-outline" onClick={() => { setDoneIdx(i); setPreviewId(null); setStep(4); }} style={{ ...btn(), padding: '4px 10px', fontSize: 12, background: '#fff' }}>伝票を見る</button></td><td style={TD}><button type="button" className="btn-outline" onClick={() => removeVoucher(i)} style={{ ...btn('#c0392b'), padding: '4px 10px', fontSize: 12, background: '#fff' }}>削除</button></td></tr>)}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
        <button type="button" className="submit-btn" onClick={() => setStep(2)} style={btn(accent, true)}>＋ 新しい伝票を作成</button>
        <label style={{ fontSize: 14, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" />集計期間設定</label>
        <div style={{ marginLeft: 'auto', fontSize: 14, color: '#7a8794' }}>作成した伝票は会計の仕訳伝票に登録され、作成のあとに会計の伝票画面と同じ画面で内容を確認できます</div>
      </div>
    </div>
  );
  if (step === 2) return (
    <div style={{ padding: 18 }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>【決算処理】伝票の登録編集</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><div style={{ fontSize: 12, fontWeight: 700, color: '#8290a0', marginBottom: 4 }}>伝票の名称</div><input className="field-input ring" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="例：令和8年度 減価償却" style={input} /></div>
          <div><div style={{ fontSize: 12, fontWeight: 700, color: '#8290a0', marginBottom: 4 }}>【伝票形式】</div><select value={v.format} onChange={(e) => setV({ ...v, format: e.target.value })} style={input}>{/* 会計と同じ 4 種類（確認メモ #239） */}{['仕訳伝票形式', '単一式形式', '振替伝票形式', '振替単一形式'].map((f) => <option key={f}>{f}</option>)}</select></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>伝票年月日 <WarekiDate value={v.date} onChange={(d) => setV({ ...v, date: d })} accent={accent} /></div>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#8290a0', marginBottom: 4 }}>【処理選択】</div>
          {['減価償却', '国庫補助金取崩', '処分(除却・売却・移管元)', '売却損益'].map((p) => <label key={p} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 0', fontSize: 14, cursor: 'pointer' }}><input type="radio" name="proc" checked={v.proc === p} onChange={() => { setV({ ...v, proc: p }); setKari({}); setKashi({}); setSumm({}); }} />{p}</label>)}
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 0', fontSize: 14 }}><input type="checkbox" checked={v.acc} onChange={() => setV({ ...v, acc: !v.acc })} />減価償却累計額を出力</label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 0', fontSize: 14 }}><input type="checkbox" checked={v.one} onChange={() => setV({ ...v, one: !v.one })} />一枚伝票に登録</label>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
        <button type="button" onClick={() => setStep(1)} style={btn()}>キャンセル</button>
        <button type="button" className="submit-btn" disabled={!v.name.trim()} onClick={() => setStep(3)} style={{ ...btn(accent, true), opacity: v.name.trim() ? 1 : 0.5 }}>次へ</button>
      </div>
    </div>
  );
  return (
    <div style={{ padding: 18 }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>【決算処理】{v.name}　—　{v.proc}</div>
      <div style={{ overflow: 'auto', border: '1px solid #e2e8ee', borderRadius: 10 }}>
        <table data-closing-table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100, tableLayout: 'fixed' }}>
          <colgroup><col style={{ width: 150 }} /><col style={{ width: 64 }} /><col style={{ width: 150 }} /><col style={{ width: 150 }} /><col style={{ width: 150 }} /><col /><col /><col /><col /><col /><col /></colgroup>
          <thead><tr>{['資産の種類\nまたは名称', '伝票へ\n追加', '借方科目の設定', '貸方科目の設定', '摘要', '期首帳簿価額\n(A)', 'うち国庫\n補助金等', '当期増加額\n(B)', 'うち国庫\n補助金等', '当期減価償却額\n(C)', 'うち国庫\n補助金等'].map((h, k) => <th key={k} style={{ ...TH, textAlign: k === 1 ? 'center' : k >= 5 ? 'right' : 'left', whiteSpace: 'pre', lineHeight: 1.35, verticalAlign: 'bottom', padding: '8px 10px' }}>{h}</th>)}</tr></thead>
          <tbody>
            {ROWS.map((r) => (
              <Fragment key={r.name}>
                {r.g && <tr><td colSpan={11} style={{ ...TD, fontWeight: 700, background: '#f8fafc' }}>{r.g}</td></tr>}
                <tr style={{ background: add.has(r.name) ? '#fff' : '#fafbfc', opacity: add.has(r.name) ? 1 : 0.6 }}>
                  <td style={{ ...TD, paddingLeft: 26 }}>{r.name}</td>
                  <td style={{ ...TD, textAlign: 'center' }}><input type="checkbox" checked={add.has(r.name)} onChange={() => setAdd((s) => { const n = new Set(s); n.has(r.name) ? n.delete(r.name) : n.add(r.name); return n; })} /></td>
                  <td style={{ ...TD, padding: '5px 8px' }}>{cellBtn(kariOf(r.name), r.name in kari, () => setPick({ col: 'kari', name: r.name }))}</td>
                  <td style={{ ...TD, padding: '5px 8px' }}>{cellBtn(kashiOf(r), r.name in kashi, () => setPick({ col: 'kashi', name: r.name }))}</td>
                  <td style={{ ...TD, padding: '5px 8px' }}>{cellBtn(summOf(r.name), r.name in summ, () => setPick({ col: 'summ', name: r.name }))}</td>
                  {[r.A, r.As, r.B, r.Bs, r.C, r.Cs].map((n, k) => <td key={k} style={{ ...NUM, whiteSpace: 'nowrap', fontWeight: k === 4 ? 700 : undefined }}>{yen(n)}</td>)}
                </tr>
              </Fragment>
            ))}
            <tr style={{ background: '#e9eef3' }}><td style={{ ...TD, fontWeight: 700 }} colSpan={5}>合計（伝票へ追加する科目）</td>
              {(['A', 'As', 'B', 'Bs', 'C', 'Cs'] as const).map((k) => <td key={k} style={{ ...NUM, fontWeight: 700 }}>{yen(ROWS.filter((r) => add.has(r.name)).reduce((a, r) => a + r[k], 0))}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 12, color: '#7a8794', marginTop: 6 }}>借方・貸方・摘要はクリックで変更できます（黄色は既定から変更した項目）。「伝票を作成する」を押すと、会計の仕訳伝票に登録し、最後に会計の伝票画面と同じ画面で内容を表示します。</div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button type="button" onClick={() => setStep(2)} style={btn()}>戻る</button>
        <button type="button" className="submit-btn" onClick={finish} style={btn(accent, true)}>伝票を作成する</button>
      </div>
      {pick && pick.col !== 'summ' && <PickerModal accent={accent} title={`${pick.col === 'kari' ? '借方' : '貸方'}科目の選択：${pick.name}`} items={PICK_ACCOUNTS} current={pick.col === 'kari' ? kariOf(pick.name) : kashiOf(ROWS.find((r) => r.name === pick.name)!)} matcher={(n, q) => accountMatches(n, q) || n.includes(q.trim())} placeholder="科目名・コード・フリガナで検索" onClose={() => setPick(null)} onPick={(val) => { (pick.col === 'kari' ? setKari : setKashi)((m) => ({ ...m, [pick.name]: val })); toast(`${pick.col === 'kari' ? '借方' : '貸方'}科目を「${val}」にしました`); }} />}
      {pick && pick.col === 'summ' && <PickerModal accent={accent} title={`摘要の選択：${pick.name}`} items={CLOSING_SUMMARIES} current={summOf(pick.name)} allowFree placeholder="摘要を検索、または直接入力" onClose={() => setPick(null)} onPick={(val) => { setSumm((m) => ({ ...m, [pick.name]: val })); toast(`摘要を「${val}」にしました`); }} />}
    </div>
  );
}

/* ================= 移管取込 ================= */
interface TransferRow { code: string; from: string; name: string; date: string; qty: number; inQty: number; unit: number; cost: number; subsidy: number }
function TransferView({ accent, assets, onRegister, toast }: { accent: string; assets: Asset[]; onRegister: (rows: TransferRow[]) => void; toast: (m: string) => void }) {
  const [rows, setRows] = useState<TransferRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([{ time: '2026/04/02 10:05:33', file: 'ikan_moto_20260331.csv', count: 1, user: USER, result: '正常終了' }, { time: '2026/04/02 10:01:12', file: 'ikan_moto_20260331.csv', count: 0, user: USER, result: 'エラー（形式不正）' }]);
  const [histOpen, setHistOpen] = useState(false);
  const btn = (color = '#5b6773', solid = false): CSSProperties => ({ padding: '8px 16px', borderRadius: 8, border: '1px solid ' + (solid ? color : '#cfd8e0'), background: solid ? color : '#eef0fa', color: solid ? '#fff' : '#22303c', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' });
  /** 資産コードは読込のときに自動で採番する（使われていない 30001 からの番号）。「コード自動採番」のボタンはなくし、一覧で手入力して変えられるようにする（確認メモ #252） */
  const autoCodes = (n: number) => {
    const used = new Set(assets.map((a) => a.code));
    const codes: string[] = [];
    for (let c = 30001; codes.length < n; c++) { const s = String(c).padStart(5, '0'); if (!used.has(s)) codes.push(s); }
    return codes;
  };
  const load = () => {
    const file = 'ikan_moto_20260401.csv';
    const codes = autoCodes(2);
    setRows([{ code: codes[0], from: 'ひまわり保育園', name: '遊具（複合滑り台）', date: '令和8年 4月 1日', qty: 1, inQty: 1, unit: 1250000, cost: 1250000, subsidy: 600000 }, { code: codes[1], from: 'ひまわり保育園', name: '業務用冷蔵庫', date: '令和8年 4月 1日', qty: 1, inQty: 1, unit: 380000, cost: 380000, subsidy: 0 }]);
    setHistory((h) => [...h, { time: stamp(), file, count: 2, user: USER, result: '正常終了' }]);
    toast(`${file} を読み込み、資産コードを自動で採番しました（サンプル2件）`);
  };
  const setCode = (i: number, code: string) => setRows((rs) => rs.map((x, k) => (k === i ? { ...x, code } : x)));
  const codeIssue = (r: TransferRow, i: number) => (!r.code ? '資産コードを入力してください' : rows.some((x, k) => k !== i && x.code === r.code) ? '同じ資産コードが一覧にあります' : assets.some((a) => a.code === r.code) ? 'この資産コードは既に使われています' : '');
  const register = () => {
    if (rows.length === 0) return toast('移管データを読み込んでください');
    const bad = rows.findIndex((r, i) => !!codeIssue(r, i));
    if (bad >= 0) return toast(`${bad + 1} 行目：${codeIssue(rows[bad], bad)}`);
    onRegister(rows);
    setRows([]);
  };
  return (
    <div style={{ padding: 18 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        <button type="button" className="btn-outline" onClick={load} style={btn()}>移管データ読込</button>
        <button type="button" className="btn-outline" onClick={() => setRows([])} style={btn()}>処理の取消</button>
        <button type="button" className="btn-outline" onClick={() => setHistOpen(true)} style={btn()}>取込み履歴{history.length > 0 && `（${history.length}）`}</button>
        <span style={{ fontSize: 12, color: '#7a8794' }}>資産コードは読込のときに自動で採番します。一覧で直接変更できます。</span>
        <div style={{ marginLeft: 'auto' }}><button type="button" className="submit-btn" onClick={register} style={btn(accent, true)}>登録</button></div>
      </div>
      <div style={{ border: '1px solid #e2e8ee', borderRadius: 10, minHeight: 260 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['資産コード', '移管元名称', '固定資産名称', '移管年月日', '数量', '取込み数量', '単価', '取得移管価額', 'うち国庫補助金等'].map((h, i) => <th key={h} style={{ ...TH, textAlign: i >= 4 ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={9} style={{ ...TD, textAlign: 'center', color: '#9aa5b1', padding: 60 }}>「移管データ読込」で移管（元）ファイルを読み込みます。</td></tr>}
            {rows.map((r, i) => {
              const issue = codeIssue(r, i);
              return (
                <tr key={i}>
                  <td style={{ ...TD, padding: '6px 14px' }}><input className="field-input" data-transfer-code={i} value={r.code} onChange={(e) => setCode(i, e.target.value.replace(/[^0-9]/g, '').slice(0, 5))} onBlur={() => { if (r.code) setCode(i, r.code.padStart(5, '0')); }} inputMode="numeric" title={issue || '自動で採番した資産コード。手入力で変更できます'} style={{ width: 96, boxSizing: 'border-box', padding: '5px 8px', border: '1px solid ' + (issue ? '#c0392b' : '#cfd8e0'), borderRadius: 6, fontSize: 14, fontFamily: 'inherit', fontWeight: 700, fontVariantNumeric: 'tabular-nums', outline: 'none', background: issue ? '#fdeee9' : '#fff9c4' }} />{issue && <div style={{ fontSize: 12, color: '#c0392b', marginTop: 2 }}>{issue}</div>}</td>
                  <td style={TD}>{r.from}</td><td style={{ ...TD, fontWeight: 500 }}>{r.name}</td><td style={TD}>{r.date}</td><td style={NUM}>{r.qty}</td><td style={NUM}>{r.inQty}</td><td style={NUM}>{yen(r.unit)}</td><td style={NUM}>{yen(r.cost)}</td><td style={NUM}>{yen(r.subsidy)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <HistoryModal open={histOpen} title="移管（元）ファイル 取込み履歴" rows={history} onClose={() => setHistOpen(false)} />
    </div>
  );
}

/* ================= 動作環境設定 ================= */
function EnvSettings({ accent, dispCalc, onDispCalc, sortItems, onSortItems, onClose, onSaved, toast }: { accent: string; dispCalc: DispCalc; onDispCalc: (v: DispCalc) => void; sortItems: SortItem[]; onSortItems: (items: SortItem[]) => void; onClose: () => void; onSaved: (desc: string) => void; toast: (m: string) => void }) {
  const METHODS = ['定額法', '旧定額法(備忘価額まで)', '旧定額法(残存価額まで)', 'リース定額法'];
  const [s, setS] = useState({ method: '定額法', dep: '償却率を乗ずる方法', sub: '償却率を乗ずる方法', byDate: false, disposal: dispCalc as string, zero: true, gengo: true, shade: '#eef9fb', line: '#ff7a00' });
  const [details, setDetails] = useState<Record<string, MethodDetail>>(() => Object.fromEntries(METHODS.map((m) => [m, DEFAULT_DETAIL(m)])));
  const [detailFor, setDetailFor] = useState<string | null>(null);
  const [sortOpen, setSortOpen] = useState(false);
  const shadeRef = useRef<HTMLInputElement>(null);
  const lineRef = useRef<HTMLInputElement>(null);
  const btn = (color = '#5b6773', solid = false): CSSProperties => ({ padding: '7px 12px', borderRadius: 7, border: '1px solid ' + (solid ? color : '#cfd8e0'), background: solid ? color : '#eef0fa', color: solid ? '#fff' : '#22303c', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' });
  const box: CSSProperties = { border: '1px solid #e2e8ee', borderRadius: 10, padding: 12 };
  const radio = (name: string, opts: string[], val: string, set: (v: string) => void) => opts.map((o) => <label key={o} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14, padding: '2px 0' }}><input type="radio" name={name} checked={val === o} onChange={() => set(o)} />{o}</label>);
  return (
    <div style={{ padding: '14px 22px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={box}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>主とする計算</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, marginBottom: 8 }}>①償却方法 <select value={s.method} onChange={(e) => setS({ ...s, method: e.target.value })} style={{ padding: '6px 10px', border: '1px solid #cfd8e0', borderRadius: 7, fontFamily: 'inherit', fontSize: 14, width: 260 }}>{['定額法', '旧定額法', 'リース定額法'].map((o) => <option key={o}>{o}</option>)}</select></div>
        <div style={{ fontSize: 14, marginBottom: 6 }}>②端数処理その他設定</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 14 }}>
          {METHODS.map((m) => { const d = details[m]; return <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ flex: 1 }}>{m}<span style={{ display: 'block', fontSize: 12, color: '#7a8794' }}>償却額 {d.dep}／取崩額 {d.sub}／備忘価額 {d.memo}円{d.residualRate ? `／残存 ${d.residualRate}%` : ''}／{d.prorate}</span></span><button type="button" className="btn-outline" onClick={() => setDetailFor(m)} style={btn()}>詳細設定</button></div>; })}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
        <div style={box}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>定額法の計算方法</div>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14, marginBottom: 8 }}><input type="checkbox" checked={s.byDate} onChange={() => setS({ ...s, byDate: !s.byDate })} />取得年月日で指定する <button type="button" className="btn-outline" disabled={!s.byDate} onClick={() => toast('平成19年4月1日以降に取得した資産は「償却率を乗ずる方法」、それ以前は「旧償却率を乗ずる方法」で計算します')} style={{ ...btn(), opacity: s.byDate ? 1 : 0.4 }}>取得年月日指定</button></label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>減価償却費</div>{radio('dep', ['旧償却率を乗ずる方法', '耐用年数で除算する方法', '償却率を乗ずる方法'], s.dep, (v) => setS({ ...s, dep: v }))}</div>
            <div><div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>国庫補助金等取崩</div>{radio('sub', ['旧償却率を乗ずる方法', '耐用年数で除算する方法', '償却率を乗ずる方法'], s.sub, (v) => setS({ ...s, sub: v }))}</div>
          </div>
        </div>
        <div style={box}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>諸設定</div>
          <button type="button" className="btn-outline" onClick={() => setSortOpen(true)} style={btn()}>並び順項目マスタ</button>
          <div style={{ fontSize: 12, color: '#7a8794', marginTop: 6, lineHeight: 1.6 }}>{sortItems.length} 項目：{sortItems.map(sortLabel).join('、')}</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={box}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>除却物件および移管物件の当期減価償却額</div>
          {radio('disp', ['計算しない（期首価額を除却損／移管損とする）', '除却月／移管月まで（月按分する）'], s.disposal, (v) => setS({ ...s, disposal: v }))}
          <label style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 14, marginTop: 8, borderTop: '1px solid #eef2f5', paddingTop: 8 }}><input type="checkbox" checked={s.zero} onChange={() => setS({ ...s, zero: !s.zero })} />除却及び、移管（元）固定資産の当期減価償却累計額を「０」円にする</label>
        </div>
        <div style={box}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>印刷関係</div>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14 }}><input type="checkbox" checked={s.gengo} onChange={() => setS({ ...s, gengo: !s.gengo })} />和暦の１年を元年と表記する</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
            <input ref={shadeRef} type="color" value={s.shade} onChange={(e) => setS({ ...s, shade: e.target.value })} style={{ width: 0, height: 0, opacity: 0, position: 'absolute' }} />
            <input ref={lineRef} type="color" value={s.line} onChange={(e) => setS({ ...s, line: e.target.value })} style={{ width: 0, height: 0, opacity: 0, position: 'absolute' }} />
            <span onClick={() => shadeRef.current?.click()} title={s.shade} style={{ width: 36, height: 20, background: s.shade, border: '1px solid #cfd8e0', cursor: 'pointer' }} /><button type="button" className="btn-outline" onClick={() => shadeRef.current?.click()} style={btn()}>帳票の網掛色</button>
            <span onClick={() => lineRef.current?.click()} title={s.line} style={{ width: 36, height: 20, background: s.line, border: '1px solid #cfd8e0', cursor: 'pointer' }} /><button type="button" className="btn-outline" onClick={() => lineRef.current?.click()} style={btn()}>帳票の罫線色</button>
            <button type="button" className="btn-outline" onClick={() => setS({ ...s, shade: '#eef9fb', line: '#ff7a00' })} style={{ ...btn(), padding: '4px 8px', fontSize: 12 }}>標準に戻す</button>
          </div>
          <div style={{ marginTop: 8, border: `1px solid ${s.line}`, borderRadius: 6, overflow: 'hidden', fontSize: 12 }}>
            <div style={{ background: s.shade, padding: '3px 8px', borderBottom: `1px solid ${s.line}`, fontWeight: 700 }}>見出し行（網掛け）のプレビュー</div>
            <div style={{ padding: '3px 8px', borderBottom: `1px solid ${s.line}` }}>明細行</div>
            <div style={{ padding: '3px 8px' }}>明細行</div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" className="submit-btn" onClick={() => { onDispCalc(s.disposal as DispCalc); onSaved(`償却方法：${s.method}／${s.disposal}`); onClose(); toast('動作環境設定を登録しました'); }} style={{ ...btn(accent, true), padding: '9px 26px', fontSize: 14 }}>登録</button>
        <button type="button" onClick={onClose} style={{ ...btn(), padding: '9px 20px', fontSize: 14 }}>キャンセル</button>
      </div>
      {detailFor && <MethodDetailModal accent={accent} method={detailFor} value={details[detailFor]} onClose={() => setDetailFor(null)} onSave={(v) => { setDetails((d) => ({ ...d, [detailFor]: v })); toast(`${detailFor} の詳細設定を保存しました`); }} />}
      {sortOpen && <SortMasterModal accent={accent} items={sortItems} toast={toast} onClose={() => setSortOpen(false)} onSave={(items) => { onSortItems(items); toast('並び順項目マスタを登録しました'); }} />}
    </div>
  );
}
