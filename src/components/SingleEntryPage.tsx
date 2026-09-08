// 単一入力（既存「単一式入力」の再現）
//   上部 … 入力した伝票が積み上がる一覧（会計月タブで絞り込み。既存の右側「当年仕訳」一覧を統合）
//   下部 … 1行分の入力欄。Enterで次の項目へ、金額でEnterすると登録して次の伝票へ。
//   既存Fキー：F2伝票訂正/F3伝票削除 → 一覧の行ごとの「訂正」「削除」。F4科目別残/F5現預金残/F8カレンダ/F9連続定型 → 機能ボタン。
// フォーム型（緑）・スプレッドシート型（青）のどちらのシェルからも同じ部品を使う。

import { useCallback, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { AssistField } from './AssistField';
import { AssistPanel } from './AssistPanel';
import { Chips } from './Chips';
import { FiscalMonthTabs } from './FiscalMonthTabs';
import { NOT_IMPL, ToastView, useToast } from './Toast';
import { PrevYearJournal } from './PrevYearJournal';
import { makeSingleSeed } from '../data';
import { useEntryForm } from '../hooks/useEntryForm';
import { applyMonth } from '../lib/format';
import type { FormState, JournalEntry } from '../types';

const PINK = '#b0426a';
const PINK_RGB = '176,66,106';
const BLUE = '#2c5f9e';
const BLUE_RGB = '44,95,158';

/** 一覧・入力行で共通の列構成（最後は操作列） */
const COLS = '52px 88px 44px minmax(0,1.15fr) minmax(0,1.15fr) minmax(0,1.35fr) 118px 96px';

const initialForm: FormState = {
  service: '001 本部',
  month: '8',
  day: '5',
  torihiki: '資金',
  kariKamoku: '',
  kashiKamoku: '',
  tekiyo: '',
  gyosha: '',
  amount: '',
};

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
/** 令和8年＝2026年として曜日を求める（月/日が不正なら空） */
function weekdayOf(month: string, day: string): string {
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);
  if (!m || !d) return '';
  const dt = new Date(2026, m - 1, d);
  if (dt.getMonth() !== m - 1) return '';
  return WEEKDAYS[dt.getDay()];
}
function weekdayOfDate(date: string): string {
  const [m, d] = date.split('/');
  return weekdayOf(m ?? '', d ?? '');
}

/** IME変換確定のEnterを無視して fn を実行 */
function onEnter(fn: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    if (e.nativeEvent.isComposing || (e.nativeEvent as unknown as { keyCode: number }).keyCode === 229) return;
    e.preventDefault();
    fn();
  };
}
const focusId = (id: string) => setTimeout(() => document.getElementById(id)?.focus(), 0);

/** 既存Fキーのうち、単一入力で使う機能（プロトタイプではボタン化） */
const TOOLS = ['科目別残', '現預金残', 'カレンダー', '連続定型'];

interface Props {
  variant: 'form' | 'sheet';
  accent: string;
  accentRgb: string;
  /** ヘッダーで「前年仕訳」を選んだとき：一覧を前年仕訳（閲覧のみ）に差し替え、入力行は隠す */
  prevYear?: boolean;
}

export function SingleEntryPage({ variant, accent, accentRgb, prevYear }: Props) {
  const [shohyo, setShohyo] = useState(true);
  const [cheque, setCheque] = useState('');
  const toast = useToast();

  // 登録後：小切手Noをクリアし、借方科目へフォーカス（証憑・日付・区分は保持して連続入力）
  const afterSubmit = useCallback(() => {
    setCheque('');
    focusId('se-kari');
  }, []);
  const v = useEntryForm({ initialForm, seed: makeSingleSeed(), afterSubmit, initialMonth: '8' });
  const f = v.form;

  const doSubmit = () => v.submit({ shohyo, cheque: cheque.trim() || undefined });

  // 訂正：行を入力欄に戻す（既存 F2 伝票訂正）
  const edit = (e: JournalEntry) => {
    const [m, d] = e.date.split('/');
    v.setFields({ month: m ?? '', day: d ?? '', kariKamoku: e.kari, kashiKamoku: e.kashi, tekiyo: e.tekiyo, gyosha: e.gyosha ?? '', amount: String(e.amount) });
    setShohyo(!!e.shohyo);
    setCheque(e.cheque ?? '');
    v.removeEntry(e.id);
    focusId('se-kari');
    toast.show('伝票を入力欄に戻しました。修正して登録してください');
  };
  // 削除（既存 F3 伝票削除）
  const del = (e: JournalEntry) => {
    if (confirm(`${e.date} ${e.kari}／${e.kashi} ${e.amount.toLocaleString('ja-JP')}円 を削除しますか？`)) v.removeEntry(e.id);
  };

  // 補助ドロップダウンで選択したら次の項目へフォーカス
  const NEXT: Record<string, string> = {
    service: 'se-month',
    kariKamoku: 'se-kashi',
    kashiKamoku: 'se-tekiyo',
    tekiyo: 'se-gyosha',
    gyosha: 'se-amount',
  };
  const pickAndAdvance = (val: string) => {
    const next = NEXT[v.assist.field];
    v.pick(val);
    if (next) focusId(next);
  };

  const wd = weekdayOf(f.month, f.day);
  const rows = applyMonth(v.journal, v.monthFilter);
  const isSheet = variant === 'sheet';

  const fieldBtn: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    width: '100%',
    boxSizing: 'border-box',
    padding: '9px 10px',
    background: '#fff',
    border: '1px solid #cfd8e0',
    borderRadius: 8,
    fontSize: 13.5,
    fontFamily: 'inherit',
    cursor: 'pointer',
    textAlign: 'left',
    color: 'inherit',
  };
  const textInput: CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '9px 10px',
    border: '1px solid #cfd8e0',
    borderRadius: 8,
    fontSize: 13.5,
    fontFamily: 'inherit',
    outline: 'none',
    color: '#22303c',
    background: '#fff',
    minWidth: 0,
  };
  const dateInput: CSSProperties = { ...textInput, width: 40, padding: '9px 2px', textAlign: 'center' };
  const colLabel: CSSProperties = { fontSize: 10.5, fontWeight: 700, color: '#8290a0', marginBottom: 6, display: 'block' };
  const panel = (w: number): CSSProperties => ({ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, width: '100%', minWidth: w, zIndex: 60 });
  const rowBtn = (color: string): CSSProperties => ({
    padding: '4px 9px',
    borderRadius: 6,
    border: '1px solid #d3dbe3',
    background: '#fff',
    color,
    fontSize: 11.5,
    fontWeight: 700,
    fontFamily: 'inherit',
    cursor: 'pointer',
  });

  return (
    <main style={{ flex: 1, minWidth: 0, padding: isSheet ? '20px 24px 24px' : 28, display: 'flex', justifyContent: 'center' }}>
      <ToastView msg={toast.msg} />
      <div
        style={{
          width: '100%',
          maxWidth: isSheet ? 'none' : 1280,
          background: '#fff',
          border: '1px solid #dde4ea',
          borderRadius: isSheet ? 14 : 16,
          boxShadow: '0 6px 26px rgba(30,50,70,.07)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* 見出し */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, padding: '18px 22px 14px', borderBottom: '1px solid #eef2f5' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: isSheet ? 17 : 21, letterSpacing: '.02em' }}>
              単一入力 <span style={{ fontSize: 12.5, fontWeight: 500, color: '#7a8794', marginLeft: 8 }}>チャイルド保育園　拠点区分</span>
            </div>
            <div style={{ color: '#7a8794', fontSize: 12, marginTop: 4 }}>
              1行＝1伝票を連続入力。<b style={{ color: '#5b6773', fontWeight: 600 }}>Enter</b>で次の項目へ、金額で<b style={{ color: '#5b6773', fontWeight: 600 }}>Enter</b>すると登録して次の伝票へ進みます。
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              {TOOLS.map((t) => (
                <button key={t} type="button" className="btn-outline" onClick={() => toast.show(NOT_IMPL)} style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid #cfd8e0', background: '#fff', color: '#5b6773', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, flex: 'none' }}>
            <div style={{ width: 170 }}>
              <span style={colLabel}>サービス区分</span>
              <AssistField
                value={f.service}
                placeholder="選択"
                open={v.isActive('service')}
                onOpen={() => v.openAssist('service', 'service')}
                accent={accent}
                accentRgb={accentRgb}
                buttonStyle={fieldBtn}
                panelStyle={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: '100%', minWidth: 220, zIndex: 60 }}
                groups={v.assistGroups}
                query={v.assist.query}
                empty={v.assistEmpty}
                onInput={v.onQueryInput}
                onPick={pickAndAdvance}
              />
            </div>
            <div>
              <span style={colLabel}>取引区分</span>
              <Chips current={f.torihiki} accent={accent} onToggle={v.setTorihiki} />
            </div>
            <div style={{ fontSize: 12.5, color: '#68757f', paddingBottom: 9, whiteSpace: 'nowrap' }}>
              会計期間　<b style={{ color: '#22303c', fontWeight: 600 }}>令和8年度</b>
            </div>
          </div>
        </div>

        {prevYear ? (
          <PrevYearJournal accent={accent} />
        ) : (
        <>
        {/* 会計月タブ（既存の 4〜3・決 ボタン） */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 22px', borderBottom: '1px solid #eef2f5' }}>
          <span style={{ fontSize: 11, color: '#8895a3', fontWeight: 700, flex: 'none' }}>表示月</span>
          <FiscalMonthTabs current={v.monthFilter} accent={accent} onSelect={v.setMonth} withAll />
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#8895a3', flex: 'none' }}>
            <b style={{ color: '#22303c', fontWeight: 700 }}>{rows.length}</b> 件
          </span>
        </div>

        {/* 入力済み一覧（既存画面の上部スペース＋右側「当年仕訳」を統合） */}
        <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 12, padding: '9px 22px', background: '#f6f8fa', fontSize: 10.5, fontWeight: 700, color: '#8290a0', borderBottom: '1px solid #eef2f5' }}>
          <div>伝票No</div>
          <div>日（曜日）</div>
          <div>証憑</div>
          <div style={{ color: BLUE }}>借方 勘定科目 <span style={{ color: '#b3bcc5', fontWeight: 500 }}>／ 資金科目</span></div>
          <div style={{ color: PINK }}>貸方 勘定科目 <span style={{ color: '#b3bcc5', fontWeight: 500 }}>／ 資金科目</span></div>
          <div>摘要 <span style={{ color: '#b3bcc5', fontWeight: 500 }}>／ 業者</span></div>
          <div style={{ textAlign: 'right' }}>金額</div>
          <div style={{ textAlign: 'right' }}>操作</div>
        </div>
        <div id="journal-scroll" style={{ overflowY: 'auto', minHeight: 180, maxHeight: 'calc(100vh - 470px)' }}>
          {rows.length === 0 && (
            <div style={{ padding: '40px 22px', textAlign: 'center', color: '#9aa5b1', fontSize: 13 }}>この月の伝票はありません。下の入力行から登録してください。</div>
          )}
          {rows.map((e, i) => {
            const isNew = e.id === v.lastAdded;
            return (
              <div
                key={e.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: COLS,
                  gap: 12,
                  padding: '10px 22px',
                  borderBottom: '1px solid #f1f4f6',
                  fontSize: 12.5,
                  alignItems: 'center',
                  background: isNew ? '#fff2c9' : 'transparent',
                  animation: isNew ? 'rowin 1.8s ease' : 'none',
                }}
              >
                <div style={{ color: '#8895a3', fontVariantNumeric: 'tabular-nums' }}>{String(i + 1).padStart(3, '0')}</div>
                <div style={{ color: '#48565f' }}>
                  {e.date}
                  <span style={{ color: '#9aa5b1', fontSize: 11 }}>（{weekdayOfDate(e.date) || '－'}）</span>
                </div>
                <div>
                  <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: e.shohyo ? '#eaf5ef' : '#f1f4f6', color: e.shohyo ? '#1f7a52' : '#9aa5b1' }}>
                    {e.shohyo ? '有' : '無'}
                  </span>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.kari}</div>
                  <div style={{ fontSize: 10.5, color: '#b3bcc5' }}>資金科目：自動</div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: '#48565f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.kashi}</div>
                  <div style={{ fontSize: 10.5, color: '#b3bcc5' }}>資金科目：自動</div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: '#48565f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.tekiyo || '—'}</div>
                  <div style={{ fontSize: 10.5, color: '#9aa5b1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.gyosha || '業者なし'}
                    {e.cheque ? `　小切手 ${e.cheque}` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{e.amount.toLocaleString('ja-JP')}</div>
                <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn-outline" onClick={() => edit(e)} style={rowBtn('#2c5f9e')}>訂正</button>
                  <button type="button" className="btn-outline" onClick={() => del(e)} style={rowBtn('#c0392b')}>削除</button>
                </div>
              </div>
            );
          })}
        </div>

        {/* 入力行（既存画面の下部に相当） */}
        <div style={{ borderTop: `2px solid ${accent}`, background: '#fbfcfd', padding: '14px 22px 12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 12, alignItems: 'end' }}>
            <div>
              <span style={colLabel}>伝票No</span>
              <div style={{ height: 38, display: 'flex', alignItems: 'center', fontSize: 12, color: '#9aa5b1' }}>自動採番</div>
            </div>
            <div>
              <span style={colLabel}>日（曜日）</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <input id="se-month" className="field-input" value={f.month} onChange={(e) => v.setField('month', e.target.value)} onKeyDown={onEnter(() => focusId('se-day'))} inputMode="numeric" style={dateInput} />
                <span style={{ color: '#9aa5b1' }}>/</span>
                <input id="se-day" className="field-input" value={f.day} onChange={(e) => v.setField('day', e.target.value)} onKeyDown={onEnter(() => focusId('se-kari'))} inputMode="numeric" style={dateInput} />
                <span style={{ fontSize: 12, color: wd ? '#48565f' : '#c3ccd4', width: 26, textAlign: 'center' }}>{wd || '－'}</span>
              </div>
            </div>
            <div>
              <span style={colLabel}>証憑</span>
              <button
                type="button"
                className="chip"
                onClick={() => setShohyo((s) => !s)}
                title="クリックで 有／無 を切替"
                style={{ height: 38, width: '100%', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, background: shohyo ? '#eaf5ef' : '#fff', color: shohyo ? '#1f7a52' : '#9aa5b1', border: '1px solid ' + (shohyo ? '#bfe0cf' : '#cfd8e0') }}
              >
                {shohyo ? '有' : '無'}
              </button>
            </div>
            <div>
              <span style={{ ...colLabel, color: BLUE }}>借方科目</span>
              <AssistField
                buttonId="se-kari"
                value={f.kariKamoku}
                placeholder="科目を選択"
                open={v.isActive('kariKamoku')}
                onOpen={() => v.openAssist('kariKamoku', 'account')}
                accent={BLUE}
                accentRgb={BLUE_RGB}
                buttonStyle={fieldBtn}
                panelStyle={panel(260)}
                groups={v.assistGroups}
                query={v.assist.query}
                empty={v.assistEmpty}
                onInput={v.onQueryInput}
                onPick={pickAndAdvance}
              />
            </div>
            <div>
              <span style={{ ...colLabel, color: PINK }}>貸方科目</span>
              <AssistField
                buttonId="se-kashi"
                value={f.kashiKamoku}
                placeholder="科目を選択"
                open={v.isActive('kashiKamoku')}
                onOpen={() => v.openAssist('kashiKamoku', 'account')}
                accent={PINK}
                accentRgb={PINK_RGB}
                buttonStyle={fieldBtn}
                panelStyle={panel(260)}
                groups={v.assistGroups}
                query={v.assist.query}
                empty={v.assistEmpty}
                onInput={v.onQueryInput}
                onPick={pickAndAdvance}
              />
            </div>
            <div>
              <span style={colLabel}>摘要 ／ 業者</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <div style={{ position: 'relative', display: 'flex', gap: 4, flex: 1.2, minWidth: 0 }} data-assist>
                  <input
                    id="se-tekiyo"
                    className="field-input ring"
                    value={f.tekiyo}
                    onChange={(e) => v.setField('tekiyo', e.target.value)}
                    onKeyDown={onEnter(() => focusId('se-gyosha'))}
                    placeholder="摘要"
                    autoComplete="off"
                    style={{ ...textInput, flex: 1 }}
                  />
                  <button type="button" className="tekiyo-toggle" onClick={() => v.openAssist('tekiyo', 'summary')} style={{ flex: 'none', width: 30, border: '1px solid #cfd8e0', borderRadius: 8, background: '#eef2f5', cursor: 'pointer', color: '#7a8794', fontSize: 9 }}>
                    ▼
                  </button>
                  {v.isActive('tekiyo') && (
                    <AssistPanel groups={v.assistGroups} query={v.assist.query} empty={v.assistEmpty} onInput={v.onQueryInput} onPick={pickAndAdvance} style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, width: 250, zIndex: 60 }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <AssistField
                    buttonId="se-gyosha"
                    value={f.gyosha}
                    placeholder="業者"
                    open={v.isActive('gyosha')}
                    onOpen={() => v.openAssist('gyosha', 'vendor')}
                    accent={accent}
                    accentRgb={accentRgb}
                    buttonStyle={fieldBtn}
                    panelStyle={panel(200)}
                    groups={v.assistGroups}
                    query={v.assist.query}
                    empty={v.assistEmpty}
                    onInput={v.onQueryInput}
                    onPick={pickAndAdvance}
                  />
                </div>
              </div>
            </div>
            <div>
              <span style={{ ...colLabel, textAlign: 'right' }}>金額</span>
              <input
                id="se-amount"
                className="field-input ring"
                value={v.amountFmt}
                onChange={(e) => v.setField('amount', e.target.value)}
                onKeyDown={onEnter(doSubmit)}
                inputMode="numeric"
                placeholder="0"
                style={{ ...textInput, textAlign: 'right', fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
              />
            </div>
            <div>
              <button
                type="button"
                className="submit-btn"
                onClick={doSubmit}
                style={{ height: 38, width: '100%', background: accent, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13.5, fontFamily: 'inherit', cursor: 'pointer', boxShadow: `0 3px 12px rgba(${accentRgb},.24)`, whiteSpace: 'nowrap' }}
              >
                登録 ↵
              </button>
            </div>
          </div>

          {/* 2行目：補助情報・小切手No */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 10, fontSize: 11.5, color: '#9aa5b1' }}>
            <span>資金科目：<b style={{ color: '#7a8794', fontWeight: 600 }}>勘定科目から自動判定</b></span>
            <span>資金-予算残 <b style={{ color: '#7a8794', fontWeight: 600 }}>—</b>　達成率 <b style={{ color: '#7a8794', fontWeight: 600 }}>—</b></span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              小切手No
              <input id="se-cheque" className="field-input" value={cheque} onChange={(e) => setCheque(e.target.value)} onKeyDown={onEnter(() => focusId('se-kari'))} placeholder="任意" autoComplete="off" style={{ ...textInput, width: 110, padding: '5px 8px', fontSize: 12 }} />
            </label>
            <span style={{ marginLeft: 'auto', color: '#c0392b', fontSize: 12.5, fontWeight: 500 }}>{v.err}</span>
          </div>
        </div>
        </>
        )}
      </div>
    </main>
  );
}
