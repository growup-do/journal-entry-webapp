// WAMNET連携出力（確認事項「【帳票・印刷】現行との差分について」）
//   現行の印刷メニュー「WAMNET連携出力」の 7 項目（連携設定／科目チェック／ファイル出力／注記出力 PDF・Excel／附属明細書出力 PDF・Excel）を、
//   1 つのダイアログで扱う。月次決算の「印刷 ▾」と「帳票の印刷」から開く。
//   WAMNET（財務諸表等電子開示システム）に取り込むファイルを作るには、法人で追加した独自の科目を WAMNET の科目に対応づけておく必要がある。
//   対応づけ（連携設定）はブラウザに保存する（プロトタイプ。本番では法人の設定として保存）。科目と金額はプロトタイプのサンプル。
//   入力のあるダイアログなので、Esc・背景のクリックでは閉じない（×・キャンセル・保存などで閉じる）。

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { Modal } from './Modal';
import { ToastView, useToast } from './Toast';
import { Notice, btn, input } from './ui';
import { runExport, type ExportKind } from './ExportDialog';
import { FORM_GROUPS, formEnabled } from './PrintCenter';
import { APPENDIX_SHEET_NAMES } from './AppendixPrintPage';
import { useSession } from '../store/session';

export type WamnetMode = '設定' | '科目チェック' | 'ファイル出力' | '注記出力' | '附属明細書出力';
export interface WamnetItem { name: string; mode: WamnetMode; format?: 'PDF' | 'Excel' }
/** 現行の印刷メニュー「WAMNET連携出力」の項目 */
export const WAMNET_ITEMS: WamnetItem[] = [
  { name: 'WAMNET連携設定', mode: '設定' },
  { name: 'WAMNET連携科目チェック', mode: '科目チェック' },
  { name: 'WAMNET連携ファイル出力', mode: 'ファイル出力' },
  { name: 'WAMNET連携注記出力（PDF）', mode: '注記出力', format: 'PDF' },
  { name: 'WAMNET連携注記出力（Excel）', mode: '注記出力', format: 'Excel' },
  { name: 'WAMNET連携附属明細書出力（PDF）', mode: '附属明細書出力', format: 'PDF' },
  { name: 'WAMNET連携附属明細書出力（Excel）', mode: '附属明細書出力', format: 'Excel' },
];

/** WAMNET の科目（対応づけの候補。プロトタイプのサンプル） */
const WAM_ACCOUNTS = ['現金預金', '事業未収金', '未収補助金', '事業未払金', '職員預り金', '保育事業収益', '職員給料', '非常勤職員給与', '事務消耗品費', '保育材料費', '業務委託費', '雑支出'];
/** 法人の科目（サンプル）。独自の科目は既定では未設定 */
const OWN_ACCOUNTS: { name: string; own?: boolean; def: string }[] = [
  { name: '現金預金', def: '現金預金' },
  { name: '事業未収金', def: '事業未収金' },
  { name: '未収補助金', def: '未収補助金' },
  { name: '事業未払金', def: '事業未払金' },
  { name: '職員預り金', def: '職員預り金' },
  { name: '保育事業収益', def: '保育事業収益' },
  { name: '職員給料', def: '職員給料' },
  { name: '事務消耗品費', def: '事務消耗品費' },
  { name: '行事費', own: true, def: '' },
  { name: '園児用教材費', own: true, def: '' },
];
const KEY = 'proto-wamnet';
interface Saved { corpNo: string; office: string; map: Record<string, string> }
const DEFAULT_SAVED: Saved = { corpNo: '', office: '', map: Object.fromEntries(OWN_ACCOUNTS.map((a) => [a.name, a.def])) };
const load = (): Saved => { try { const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Saved> | null; return s ? { ...DEFAULT_SAVED, ...s, map: { ...DEFAULT_SAVED.map, ...(s.map ?? {}) } } : DEFAULT_SAVED; } catch { return DEFAULT_SAVED; } };
const save = (s: Saved) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } };
const unmappedOf = (s: Saved) => OWN_ACCOUNTS.filter((a) => !s.map[a.name]);

const TITLE: Record<WamnetMode, string> = { 設定: 'WAMNET連携設定', 科目チェック: 'WAMNET連携科目チェック', ファイル出力: 'WAMNET連携ファイル出力', 注記出力: 'WAMNET連携注記出力', 附属明細書出力: 'WAMNET連携附属明細書出力' };

/** WAMNET連携のダイアログ。item が null のとき非表示 */
export function WamnetDialog({ item, onClose, accent }: { item: WamnetItem | null; onClose: () => void; accent: string }) {
  const s = useSession();
  const toast = useToast();
  // 科目チェックから連携設定へ切り替えられるよう、表示中の項目は中で持つ
  const [cur, setCur] = useState<WamnetItem | null>(item);
  const [saved, setSaved] = useState<Saved>(load);
  const [draft, setDraft] = useState<Saved>(load);
  const [picks, setPicks] = useState<Set<string>>(new Set());
  useEffect(() => {
    setCur(item);
    if (item) { const v = load(); setSaved(v); setDraft(v); setPicks(new Set()); }
  }, [item]);
  if (!cur) return <Modal open={false} onClose={onClose} title=""><span /></Modal>;

  const mode = cur.mode;
  const unmapped = unmappedOf(saved);
  // WAMNET に取り込むのは決算書（第一〜第三号様式）。準決算書は対象外
  const forms = FORM_GROUPS.filter((g) => g.title !== '準決算書').flatMap((g) => g.items.map((it) => ({ key: it.key, name: `${g.title.replace(/（.*$/, '')} ${it.name}` }))).filter((it) => formEnabled(s.print.forms, it.key, s.tree));
  const noteNames = ['計算書類に対する注記（法人全体用）', '計算書類に対する注記（拠点区分用）'];
  const listFor = mode === 'ファイル出力' ? forms.map((f) => f.name) : mode === '注記出力' ? noteNames : mode === '附属明細書出力' ? APPENDIX_SHEET_NAMES : [];
  const isOn = (n: string) => !picks.has(n);
  const flip = (n: string) => setPicks((p) => { const x = new Set(p); if (x.has(n)) x.delete(n); else x.add(n); return x; });
  const chosen = listFor.filter(isOn);

  const th: CSSProperties = { textAlign: 'left', padding: '7px 10px', fontSize: 12, fontWeight: 700, color: '#8290a0', borderBottom: '1px solid #dde4ea', background: '#f7f9fa', position: 'sticky', top: 0 };
  const td: CSSProperties = { padding: '6px 10px', borderBottom: '1px solid #f1f4f6', fontSize: 14 };
  const lbl: CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: '#8290a0', marginBottom: 5 };

  const output = () => {
    if (!chosen.length) return toast.show('出力する帳票を選んでください');
    const kind: ExportKind = mode === 'ファイル出力' ? 'csv' : cur.format === 'Excel' ? 'excel' : 'pdf';
    const msg = runExport({
      kind,
      title: TITLE[mode],
      fileName: `${TITLE[mode]}_${s.fiscalYear}`,
      meta: `${s.fiscalYear}　${chosen.join('、')}`,
      header: ['帳票', 'WAMNET の科目', '金額'],
      rows: chosen.flatMap((n, i) => WAM_ACCOUNTS.slice(0, 5).map((a, k) => [n, a, ((i + 3) * 104729 + k * 7919) % 900000 + 10000])),
    });
    toast.show(msg);
  };

  const body = (() => {
    if (mode === '設定') {
      return (
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ fontSize: 14, color: '#5b6773', lineHeight: 1.7 }}>WAMNET（財務諸表等電子開示システム）に取り込むファイルを作るための設定です。法人で追加した独自の科目は、WAMNET の科目に対応づけてください。</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><span style={lbl}>法人番号（13桁）</span><input className="field-input ring" value={draft.corpNo} inputMode="numeric" onChange={(e) => setDraft({ ...draft, corpNo: e.target.value.replace(/[^0-9]/g, '').slice(0, 13) })} placeholder="例：1234567890123" style={input} /></div>
            <div><span style={lbl}>所轄庁</span><input className="field-input ring" value={draft.office} onChange={(e) => setDraft({ ...draft, office: e.target.value })} placeholder="例：〇〇市" style={input} /></div>
          </div>
          <div>
            <span style={lbl}>科目の対応づけ</span>
            <div style={{ maxHeight: 300, overflow: 'auto', border: '1px solid #dde4ea', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}>法人の科目</th><th style={th}>WAMNET の科目</th></tr></thead>
                <tbody>
                  {OWN_ACCOUNTS.map((a) => (
                    <tr key={a.name} data-wamnet-row={a.name} style={{ background: draft.map[a.name] ? undefined : '#fff8e6' }}>
                      <td style={td}>{a.name}{a.own && <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 700, color: '#8a5a00' }}>法人独自</span>}</td>
                      <td style={td}><select value={draft.map[a.name] ?? ''} onChange={(e) => setDraft({ ...draft, map: { ...draft.map, [a.name]: e.target.value } })} style={{ ...input, padding: '6px 8px' }}><option value="">（未設定）</option>{WAM_ACCOUNTS.map((w) => <option key={w}>{w}</option>)}</select></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }
    if (mode === '科目チェック') {
      return (
        <div style={{ display: 'grid', gap: 12 }}>
          {unmapped.length
            ? <Notice tone="warn">WAMNET の科目に対応づけていない科目が <b>{unmapped.length} 件</b>あります。このままではファイルを出力できません。「連携設定を開く」から対応づけてください。</Notice>
            : <Notice tone="ok">すべての科目が WAMNET の科目に対応づけられています。ファイルを出力できます。</Notice>}
          <div style={{ maxHeight: 320, overflow: 'auto', border: '1px solid #dde4ea', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>法人の科目</th><th style={th}>WAMNET の科目</th><th style={th}>結果</th></tr></thead>
              <tbody>
                {OWN_ACCOUNTS.map((a) => { const m = saved.map[a.name]; return (
                  <tr key={a.name} data-wamnet-check={m ? 'ok' : 'ng'}>
                    <td style={td}>{a.name}</td><td style={{ ...td, color: m ? '#22303c' : '#9aa5b1' }}>{m || '（未設定）'}</td>
                    <td style={{ ...td, fontWeight: 700, color: m ? '#1f7a52' : '#c0392b' }}>{m ? '対応済み' : '未設定'}</td>
                  </tr>
                ); })}
              </tbody>
            </table>
          </div>
        </div>
      );
    }
    // ファイル出力／注記出力／附属明細書出力
    const desc = mode === 'ファイル出力' ? '決算書の各様式を、WAMNET に取り込むファイル（CSV）として出力します。出力する様式は、共通の印刷設定の「様式設定」で使用にしているものです。'
      : mode === '注記出力' ? `計算書類に対する注記を、WAMNET に添付する形式（${cur.format}）で出力します。注記の内容は「別紙（注記・明細書・財産目録）」で編集します。`
        : `附属明細書を、WAMNET に添付する形式（${cur.format}）で出力します。明細の内容は「別紙（注記・明細書・財産目録）」で入力します。`;
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 14, color: '#5b6773', lineHeight: 1.7 }}>{desc}</div>
        {mode === 'ファイル出力' && unmapped.length > 0 && <Notice tone="warn">WAMNET の科目に対応づけていない科目が {unmapped.length} 件あります（{unmapped.map((a) => a.name).join('、')}）。連携設定で対応づけてから出力してください。</Notice>}
        <div style={{ display: 'flex', gap: 12, fontSize: 14, color: '#3d4a56' }}><span>対象年度：<b>{s.fiscalYear}</b></span><span>出力形式：<b>{mode === 'ファイル出力' ? 'CSV' : cur.format}</b></span><span style={{ marginLeft: 'auto' }}>選択中 <b>{chosen.length}</b> / {listFor.length}</span></div>
        <div style={{ maxHeight: 300, overflow: 'auto', border: '1px solid #dde4ea', borderRadius: 8, padding: 6, display: 'grid', gap: 2 }}>
          {listFor.map((n) => (
            <label key={n} data-wamnet-pick={n} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 6, fontSize: 14, cursor: 'pointer', background: isOn(n) ? 'transparent' : '#f6f8fa', color: isOn(n) ? '#22303c' : '#8290a0' }}>
              <input type="checkbox" checked={isOn(n)} onChange={() => flip(n)} />{n}
            </label>
          ))}
        </div>
      </div>
    );
  })();

  const blocked = mode === 'ファイル出力' && unmapped.length > 0;
  return (
    <Modal open={!!item} onClose={onClose} width={640} title={cur.name}>
      <ToastView msg={toast.msg} />
      <div data-wamnet={mode} style={{ padding: '16px 22px 18px', display: 'grid', gap: 16 }}>
        {body}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {(mode === '科目チェック' || blocked) && <button type="button" className="btn-outline" onClick={() => setCur(WAMNET_ITEMS[0])} style={{ ...btn(accent), marginRight: 'auto' }}>連携設定を開く</button>}
          <button type="button" onClick={onClose} style={btn()}>{mode === '科目チェック' ? '閉じる' : 'キャンセル'}</button>
          {mode === '設定' && <button type="button" className="submit-btn" onClick={() => { save(draft); setSaved(draft); toast.show('WAMNET連携設定を保存しました'); }} style={btn(accent, true)}>保存</button>}
          {(mode === 'ファイル出力' || mode === '注記出力' || mode === '附属明細書出力') && <button type="button" className="submit-btn" data-wamnet-run disabled={blocked} onClick={output} style={{ ...btn(accent, true), opacity: blocked ? 0.5 : 1, cursor: blocked ? 'not-allowed' : 'pointer' }}>出力</button>}
        </div>
      </div>
    </Modal>
  );
}
