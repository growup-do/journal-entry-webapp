// Screen 1: フォーム型（`仕訳伝票_フォーム型.dc.html`）
// アプリバー + 横スクロールナビ + 中央フォームカード + 右端固定・折りたたみ仕訳帳。
// アクセント = 緑 #1f7a52。

import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { AssistField } from './AssistField';
import { AssistPanel } from './AssistPanel';
import { Chips } from './Chips';
import { Menu } from './Menu';
import { MonthChips } from './MonthChips';
import { makeFormSeed } from '../data';
import { applyMonth } from '../lib/format';
import { useEntryForm } from '../hooks/useEntryForm';
import type { FormState } from '../types';

const GREEN = '#1f7a52';
const GREEN_RGB = '31,122,82';
const BLUE = '#2c5f9e';
const BLUE_RGB = '44,95,158';
const PINK = '#b0426a';
const PINK_RGB = '176,66,106';

const JOURNAL_W = 392;

const initialForm: FormState = {
  service: '001 本部',
  month: '8',
  day: '1',
  torihiki: '資金',
  kariKamoku: '',
  kashiKamoku: '',
  tekiyo: '',
  gyosha: '',
  amount: '',
};

const fieldBtnBase: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  width: '100%',
  boxSizing: 'border-box',
  background: '#fff',
  border: '1px solid #cfd8e0',
  fontFamily: 'inherit',
  cursor: 'pointer',
  textAlign: 'left',
  color: 'inherit',
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: '#8290a0',
  marginBottom: 7,
  letterSpacing: '.03em',
};

const dateInput: CSSProperties = {
  width: 44,
  padding: '8px 4px',
  textAlign: 'center',
  border: '1px solid #cfd8e0',
  borderRadius: 8,
  fontSize: 14,
  fontFamily: 'inherit',
  outline: 'none',
  color: '#22303c',
};

export function FormScreen() {
  const v = useEntryForm({ initialForm, seed: makeFormSeed() });
  const [collapsed, setCollapsed] = useState(false);
  const [topOffset, setTopOffset] = useState(102);
  const headerRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);

  // アプリバー＋ナビの合計高さを実測（ナビ折返しに追従）
  useLayoutEffect(() => {
    const measure = () => {
      const h = headerRef.current?.offsetHeight ?? 0;
      const n = navRef.current?.offsetHeight ?? 0;
      const o = h + n;
      if (o) setTopOffset((prev) => (o !== prev ? o : prev));
    };
    measure();
    const t1 = setTimeout(measure, 60);
    const t2 = setTimeout(measure, 300);
    window.addEventListener('resize', measure);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', measure);
    };
  }, []);

  const rows = applyMonth(v.journal, v.monthFilter);
  const f = v.form;

  const submitStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    background: GREEN,
    color: '#fff',
    border: 'none',
    borderRadius: 11,
    padding: '13px 24px',
    fontWeight: 700,
    fontSize: 15,
    fontFamily: 'inherit',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    boxShadow: '0 3px 12px rgba(31,122,82,.24)',
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* アプリバー */}
      <header
        ref={headerRef}
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: '#fff',
          borderBottom: '1px solid #dde4ea',
          height: 58,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 26px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={logoStyle(GREEN, 28, 15)}>会</span>
            <span style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 15.5 }}>
              会計基準システム
            </span>
          </div>
          <span style={{ color: '#c3ccd4' }}>｜</span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              fontSize: 13,
              color: '#68757f',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}
          >
            <span>社会福祉法人</span>
            <span style={{ color: '#c3ccd4' }}>›</span>
            <span>チャイルド保育園</span>
            <span style={{ color: '#c3ccd4' }}>›</span>
            <span style={{ color: '#22303c', fontWeight: 500 }}>拠点区分</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 13, color: '#68757f' }}>
          <span>
            会計期間　<b style={{ color: '#22303c', fontWeight: 600 }}>令和8年度</b>
          </span>
          <span style={avatarStyle('#eef4f0', GREEN)}>経</span>
        </div>
      </header>

      {/* ナビ（横スクロール） */}
      <nav
        ref={navRef}
        style={{
          background: '#fff',
          borderBottom: '1px solid #eef2f5',
          padding: '3px 24px',
          display: 'flex',
          flexWrap: 'nowrap',
          overflowX: 'auto',
          alignItems: 'stretch',
        }}
      >
        <Menu orientation="h" accent={GREEN} />
      </nav>

      {/* メイン（フォームカード） */}
      <main
        style={{
          flex: 1,
          padding: 28,
          paddingRight: collapsed ? 28 : JOURNAL_W + 28,
          display: 'flex',
          gap: 24,
          alignItems: 'flex-start',
          justifyContent: 'center',
          overflowX: 'auto',
          transition: 'padding-right .28s ease',
        }}
      >
        <div
          style={{
            flex: 'none',
            width: 720,
            background: '#fff',
            border: '1px solid #dde4ea',
            borderRadius: 16,
            boxShadow: '0 6px 26px rgba(30,50,70,.07)',
            padding: '26px 28px 22px',
          }}
        >
          {/* 見出し行 */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              borderBottom: '2px solid #28323c',
              paddingBottom: 15,
              marginBottom: 20,
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "'Zen Kaku Gothic New', sans-serif",
                  fontWeight: 700,
                  fontSize: 25,
                  letterSpacing: '.03em',
                }}
              >
                仕訳伝票
              </div>
              <div style={{ color: '#5b6773', fontSize: 13, marginTop: 4 }}>チャイルド保育園　拠点区分</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: '#8895a3', marginBottom: 7 }}>取引区分</div>
              <Chips current={f.torihiki} accent={GREEN} onToggle={v.setTorihiki} />
            </div>
          </div>

          {/* メタ行 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr .95fr', gap: 16, marginBottom: 20 }}>
            <div>
              <label style={labelStyle}>サービス区分</label>
              <AssistField
                value={f.service}
                placeholder="選択"
                open={v.isActive('service')}
                onOpen={() => v.openAssist('service', 'service')}
                accent={GREEN}
                accentRgb={GREEN_RGB}
                buttonStyle={{ ...fieldBtnBase, padding: '9px 12px', borderRadius: 9, fontSize: 14 }}
                panelStyle={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: '100%', minWidth: 230, zIndex: 60 }}
                groups={v.assistGroups}
                query={v.assist.query}
                empty={v.assistEmpty}
                onInput={v.onQueryInput}
                onPick={v.pick}
              />
            </div>
            <div>
              <label style={labelStyle}>伝票日付</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38, fontSize: 14, color: '#5b6773' }}>
                <span>令和8年</span>
                <input
                  className="field-input"
                  value={f.month}
                  onChange={(e) => v.setField('month', e.target.value)}
                  inputMode="numeric"
                  style={dateInput}
                />
                <span>月</span>
                <input
                  className="field-input"
                  value={f.day}
                  onChange={(e) => v.setField('day', e.target.value)}
                  inputMode="numeric"
                  style={dateInput}
                />
                <span>日</span>
              </div>
            </div>
            <div>
              <label style={labelStyle}>伝票No</label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  height: 38,
                  padding: '0 12px',
                  background: '#f5f7f9',
                  border: '1px solid #e2e8ee',
                  borderRadius: 9,
                  fontSize: 13.5,
                  color: '#9aa5b1',
                }}
              >
                自動採番
              </div>
            </div>
          </div>

          {/* 借方 / 貸方 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
            <div style={{ border: '1px solid #cfe0f2', borderRadius: 12 }}>
              <div style={boxHeader('#eaf2fb', BLUE)}>
                借方
                <span style={{ fontSize: 10, fontWeight: 600, color: '#87a6cc' }}>BS / PL</span>
              </div>
              <div style={{ padding: 14 }}>
                <AssistField
                  value={f.kariKamoku}
                  placeholder="科目を選択"
                  open={v.isActive('kariKamoku')}
                  onOpen={() => v.openAssist('kariKamoku', 'account')}
                  accent={BLUE}
                  accentRgb={BLUE_RGB}
                  buttonStyle={{ ...fieldBtnBase, padding: '11px 12px', borderRadius: 9, fontSize: 14.5 }}
                  panelStyle={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: '100%', minWidth: 270, zIndex: 60 }}
                  groups={v.assistGroups}
                  query={v.assist.query}
                  empty={v.assistEmpty}
                  onInput={v.onQueryInput}
                  onPick={v.pick}
                />
                <BudgetHint />
              </div>
            </div>
            <div style={{ border: '1px solid #f2d0dc', borderRadius: 12 }}>
              <div style={boxHeader('#fdeef3', PINK)}>
                貸方
                <span style={{ fontSize: 10, fontWeight: 600, color: '#d18aa5' }}>BS / PL</span>
              </div>
              <div style={{ padding: 14 }}>
                <AssistField
                  value={f.kashiKamoku}
                  placeholder="科目を選択"
                  open={v.isActive('kashiKamoku')}
                  onOpen={() => v.openAssist('kashiKamoku', 'account')}
                  accent={PINK}
                  accentRgb={PINK_RGB}
                  buttonStyle={{ ...fieldBtnBase, padding: '11px 12px', borderRadius: 9, fontSize: 14.5 }}
                  panelStyle={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: '100%', minWidth: 270, zIndex: 60 }}
                  groups={v.assistGroups}
                  query={v.assist.query}
                  empty={v.assistEmpty}
                  onInput={v.onQueryInput}
                  onPick={v.pick}
                />
                <BudgetHint />
              </div>
            </div>
          </div>

          {/* 摘要・業者・金額 */}
          <div style={{ border: '1px solid #e2e8ee', borderRadius: 12, marginBottom: 22 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 216px' }}>
              <div
                style={{
                  padding: '15px 16px',
                  borderRight: '1px solid #eef2f5',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 13,
                  borderRadius: '11px 0 0 11px',
                }}
              >
                <div>
                  <label style={labelStyle}>摘要</label>
                  <div style={{ position: 'relative', display: 'flex', gap: 6 }} data-assist>
                    <input
                      className="field-input ring"
                      value={f.tekiyo}
                      onChange={(e) => v.setField('tekiyo', e.target.value)}
                      placeholder="摘要を入力"
                      autoComplete="off"
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        border: '1px solid #cfd8e0',
                        borderRadius: 9,
                        fontSize: 14,
                        fontFamily: 'inherit',
                        outline: 'none',
                        color: '#22303c',
                        minWidth: 0,
                      }}
                    />
                    <button
                      type="button"
                      className="tekiyo-toggle"
                      onClick={() => v.openAssist('tekiyo', 'summary')}
                      style={{
                        flex: 'none',
                        width: 40,
                        border: '1px solid #cfd8e0',
                        borderRadius: 9,
                        background: '#f4f7f9',
                        cursor: 'pointer',
                        color: '#7a8794',
                        fontSize: 9,
                      }}
                    >
                      ▼
                    </button>
                    {v.isActive('tekiyo') && (
                      <AssistPanel
                        groups={v.assistGroups}
                        query={v.assist.query}
                        empty={v.assistEmpty}
                        onInput={v.onQueryInput}
                        onPick={v.pick}
                        style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: 250, zIndex: 60 }}
                      />
                    )}
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>業者</label>
                  <AssistField
                    value={f.gyosha}
                    placeholder="業者を選択"
                    open={v.isActive('gyosha')}
                    onOpen={() => v.openAssist('gyosha', 'vendor')}
                    accent={GREEN}
                    accentRgb={GREEN_RGB}
                    buttonStyle={{ ...fieldBtnBase, padding: '10px 12px', borderRadius: 9, fontSize: 14 }}
                    panelStyle={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: '100%', minWidth: 210, zIndex: 60 }}
                    groups={v.assistGroups}
                    query={v.assist.query}
                    empty={v.assistEmpty}
                    onInput={v.onQueryInput}
                    onPick={v.pick}
                  />
                </div>
              </div>
              <div
                style={{
                  padding: '15px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  gap: 9,
                  background: '#fbfcfd',
                  borderRadius: '0 11px 11px 0',
                }}
              >
                <label style={{ ...labelStyle, marginBottom: 0 }}>金額</label>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 17, color: '#8290a0' }}>¥</span>
                  <input
                    className="field-input"
                    value={v.amountFmt}
                    onChange={(e) => v.setField('amount', e.target.value)}
                    inputMode="numeric"
                    placeholder="0"
                    style={{
                      width: '100%',
                      minWidth: 0,
                      textAlign: 'right',
                      fontSize: 23,
                      fontWeight: 700,
                      padding: '5px 2px',
                      border: 'none',
                      borderBottom: '2px solid #cfd8e0',
                      outline: 'none',
                      fontFamily: 'inherit',
                      background: 'transparent',
                      color: '#22303c',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* フッター */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
            <div style={{ minHeight: 22 }}>
              {v.err && <span style={{ color: '#c0392b', fontSize: 12.5, fontWeight: 500 }}>{v.err}</span>}
            </div>
            <button type="button" className="submit-btn" onClick={v.submit} style={submitStyle}>
              処理終了　→　仕訳帳へ登録
            </button>
          </div>
        </div>
      </main>

      {/* 折りたたみトグル */}
      <button
        type="button"
        className="collapse-toggle"
        onClick={() => setCollapsed((c) => !c)}
        title="仕訳帳の表示切替"
        style={{
          position: 'fixed',
          top: topOffset + 10,
          right: collapsed ? 12 : JOURNAL_W + 12,
          zIndex: 95,
          width: 30,
          height: 38,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#fff',
          border: '1px solid #dde4ea',
          borderRadius: 9,
          boxShadow: '0 3px 12px rgba(30,50,70,.14)',
          cursor: 'pointer',
          color: '#5b6773',
          fontSize: 12,
        }}
      >
        {collapsed ? '◀' : '▶'}
      </button>

      {/* 仕訳帳（右端固定） */}
      <aside
        style={{
          position: 'fixed',
          top: topOffset,
          right: 0,
          bottom: 0,
          width: JOURNAL_W,
          background: '#fff',
          borderLeft: '1px solid #dde4ea',
          boxShadow: '-8px 0 28px rgba(30,50,70,.07)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 90,
          transition: 'transform .28s ease',
          transform: collapsed ? `translateX(${JOURNAL_W}px)` : 'translateX(0)',
        }}
      >
        <div style={{ padding: '15px 18px 13px', borderBottom: '1px solid #eef2f5', flex: 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 11 }}>
            <span style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 16.5 }}>
              仕訳帳
            </span>
            <span style={{ fontSize: 12, color: '#8895a3' }}>{rows.length} 件</span>
          </div>
          <MonthChips months={v.months} current={v.monthFilter} accent={GREEN} onSelect={v.setMonth} />
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '46px minmax(0,1fr) minmax(0,1fr) 82px',
            gap: 8,
            padding: '9px 14px',
            background: '#f6f8fa',
            fontSize: 10.5,
            fontWeight: 700,
            color: '#8290a0',
            borderBottom: '1px solid #eef2f5',
          }}
        >
          <div>月日</div>
          <div>借方科目</div>
          <div>貸方科目</div>
          <div style={{ textAlign: 'right' }}>金額</div>
        </div>
        <div id="journal-scroll" style={{ overflowY: 'auto', flex: 1 }}>
          {rows.map((e) => {
            const isNew = e.id === v.lastAdded;
            return (
              <div
                key={e.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '46px minmax(0,1fr) minmax(0,1fr) 82px',
                  gap: 8,
                  padding: '11px 14px',
                  borderBottom: '1px solid #f1f4f6',
                  fontSize: 12.5,
                  alignItems: 'center',
                  background: isNew ? '#fff2c9' : 'transparent',
                  animation: isNew ? 'rowin 1.8s ease' : 'none',
                }}
              >
                <div style={{ color: '#8895a3', fontSize: 11 }}>{e.date}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.kari}
                  </div>
                  {e.tekiyo && (
                    <div
                      style={{
                        fontSize: 10.5,
                        color: '#9aa5b1',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        marginTop: 1,
                      }}
                    >
                      {e.tekiyo}
                    </div>
                  )}
                </div>
                <div style={{ color: '#48565f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e.kashi}
                </div>
                <div style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {e.amount.toLocaleString('ja-JP')}
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}

function logoStyle(bg: string, size: number, font: number): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: size,
    height: size,
    background: bg,
    color: '#fff',
    borderRadius: 8,
    fontFamily: "'Zen Kaku Gothic New', sans-serif",
    fontWeight: 700,
    fontSize: font,
  };
}

function avatarStyle(bg: string, color: string): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: bg,
    color,
    fontSize: 13,
    fontWeight: 700,
  };
}

function boxHeader(bg: string, color: string): CSSProperties {
  return {
    background: bg,
    padding: '9px 14px',
    fontWeight: 700,
    fontSize: 13,
    color,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    borderRadius: '11px 11px 0 0',
  };
}

function BudgetHint() {
  return (
    <div style={{ display: 'flex', gap: 16, marginTop: 11, fontSize: 11, color: '#9aa5b1' }}>
      <span>
        予算残 <b style={{ color: '#7a8794', fontWeight: 600 }}>—</b>
      </span>
      <span>
        達成率 <b style={{ color: '#7a8794', fontWeight: 600 }}>—</b>
      </span>
    </div>
  );
}
