// Screen 2: スプレッドシート型（`仕訳伝票_スプレッドシート型.dc.html`）
// 左サイドバー + トップバー + 検索パネル + 仕訳帳カード（入力バー / 月フィルタ / テーブル）。
// アクセント = 青 #2c5f9e。

import { useCallback, useState } from 'react';
import type { CSSProperties } from 'react';
import { AssistField } from './AssistField';
import { AssistPanel } from './AssistPanel';
import { Chips } from './Chips';
import { CorpMenu } from './CorpMenu';
import { VersionBadge } from './VersionBadge';
import { Menu } from './Menu';
import { MonthChips } from './MonthChips';
import { renderPage } from './pages';
import { accountFlat, makeSheetSeed } from '../data';
import { applyMonth, rgba } from '../lib/format';
import { useEntryForm } from '../hooks/useEntryForm';
import type { FormState, JournalEntry, SearchState } from '../types';

const BLUE = '#2c5f9e';
const BLUE_RGB = '44,95,158';
const PINK = '#b0426a';
const PINK_RGB = '176,66,106';

const LEDGER_COLS = '70px minmax(0,1.1fr) minmax(0,1.1fr) minmax(0,1.4fr) 118px';
const ACCOUNT_OPTIONS = accountFlat();

const emptySearch: SearchState = { keyword: '', kari: '', kashi: '', amountMin: '', amountMax: '' };

const initialForm: FormState = {
  service: '001 本部',
  month: '8',
  day: '5',
  torihiki: '事業',
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
  gap: 6,
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 11px',
  background: '#fff',
  border: '1px solid #cfd8e0',
  borderRadius: 8,
  fontSize: 14,
  fontFamily: 'inherit',
  cursor: 'pointer',
  textAlign: 'left',
  color: 'inherit',
};

const barLabel: CSSProperties = {
  display: 'block',
  fontSize: 10.5,
  fontWeight: 600,
  color: '#8290a0',
  marginBottom: 6,
};

const searchLabel: CSSProperties = { display: 'block', fontSize: 10.5, fontWeight: 600, color: '#8290a0', marginBottom: 5 };
const dateInput: CSSProperties = {
  width: 46,
  padding: '9px 4px',
  textAlign: 'center',
  border: '1px solid #cfd8e0',
  borderRadius: 8,
  fontSize: 14,
  fontFamily: 'inherit',
  outline: 'none',
  background: '#fff',
  color: '#22303c',
};

/** applied 検索条件で絞り込み。 */
function applySearch(list: JournalEntry[], ap: SearchState | null): JournalEntry[] {
  if (!ap) return list;
  let out = list;
  const kw = (ap.keyword || '').trim();
  if (kw) out = out.filter((e) => [e.kari, e.kashi, e.tekiyo].some((x) => String(x || '').indexOf(kw) >= 0));
  if (ap.kari) out = out.filter((e) => e.kari === ap.kari);
  if (ap.kashi) out = out.filter((e) => e.kashi === ap.kashi);
  const mn = parseInt(ap.amountMin, 10);
  const mx = parseInt(ap.amountMax, 10);
  if (!isNaN(mn)) out = out.filter((e) => e.amount >= mn);
  if (!isNaN(mx)) out = out.filter((e) => e.amount <= mx);
  return out;
}

interface Props {
  /** 表示中のメニュー項目（例 '伝票入力'） */
  page: string;
  onNavigate: (label: string) => void;
}

export function SheetScreen({ page, onNavigate }: Props) {
  const [search, setSearch] = useState<SearchState>(emptySearch);
  const [applied, setApplied] = useState<SearchState | null>(null);

  // 登録時は検索条件をクリア（追加行が検索で隠れないように）
  const afterSubmit = useCallback(() => {
    setSearch(emptySearch);
    setApplied(null);
  }, []);

  const v = useEntryForm({ initialForm, seed: makeSheetSeed(), afterSubmit });
  const f = v.form;

  const setSearchField = (field: keyof SearchState, raw: string) => {
    let val = raw;
    if (field === 'amountMin' || field === 'amountMax') val = val.replace(/[^0-9]/g, '');
    setSearch((s) => ({ ...s, [field]: val }));
  };
  const doSearch = () => setApplied({ ...search });
  const onSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') doSearch();
  };
  const clearSearch = () => {
    setSearch(emptySearch);
    setApplied(null);
    v.setMonth(null);
  };

  const rows = applySearch(applyMonth(v.journal, v.monthFilter), applied);

  const submitStyle: CSSProperties = {
    height: 40,
    background: BLUE,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 14,
    fontFamily: 'inherit',
    cursor: 'pointer',
  };
  const searchBtnStyle: CSSProperties = {
    padding: '9px 26px',
    background: BLUE,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 13,
    fontFamily: 'inherit',
    cursor: 'pointer',
    boxShadow: '0 2px 8px ' + rgba(BLUE, 0.28),
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* サイドバー */}
      <aside
        style={{
          flex: 'none',
          width: 210,
          background: '#fff',
          borderRight: '1px solid #dde4ea',
          display: 'flex',
          flexDirection: 'column',
          position: 'sticky',
          top: 0,
          height: '100vh',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '16px 16px 14px', borderBottom: '1px solid #eef2f5' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 30,
              height: 30,
              background: BLUE,
              color: '#fff',
              borderRadius: 8,
              fontFamily: "'Zen Kaku Gothic New', sans-serif",
              fontWeight: 700,
              fontSize: 16,
            }}
          >
            会
          </span>
          <span style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>
            会計基準
            <br />
            システム
          </span>
        </div>
        <div style={{ padding: '8px 16px 0' }}>
          <VersionBadge accent={BLUE} />
        </div>
        <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 6px', display: 'flex', flexDirection: 'column' }}>
          <Menu orientation="v" accent={BLUE} active={page} onSelect={onNavigate} />
        </nav>
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid #eef2f5',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12.5,
            color: '#8895a3',
            cursor: 'pointer',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <span>閉じる</span>
        </div>
      </aside>

      {/* メイン列 */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* トップバー */}
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 100,
            background: '#fff',
            borderBottom: '1px solid #dde4ea',
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            flex: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: '#8895a3' }}>
            <span>ホーム</span>
            <span style={{ color: '#c3ccd4' }}>›</span>
            <span>会計帳簿</span>
            <span style={{ color: '#c3ccd4' }}>›</span>
            <span style={{ color: '#22303c', fontWeight: 700, fontFamily: "'Zen Kaku Gothic New', sans-serif" }}>{page === '伝票入力' ? '仕訳帳' : page}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 13, color: '#68757f' }}>
            <CorpMenu accent={BLUE} active={page} onSelect={onNavigate} />
            <span>令和8年度（1/1〜12/31）</span>
            <span style={{ color: '#c3ccd4' }}>｜</span>
            <span>チャイルド保育園　拠点区分</span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: '#eaf0f7',
                color: BLUE,
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              経
            </span>
          </div>
        </header>

        {page !== '伝票入力' ? (
          renderPage(page, 'sheet', BLUE, BLUE_RGB, onNavigate)
        ) : (
          <>
        {/* 検索パネル */}
        <div style={{ background: '#fff', borderBottom: '1px solid #dde4ea', padding: '16px 24px 18px', flex: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 13 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <span style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 14 }}>仕訳を検索</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <label style={searchLabel}>キーワード</label>
              <input
                className="search-input"
                value={search.keyword}
                onChange={(e) => setSearchField('keyword', e.target.value)}
                onKeyDown={onSearchKey}
                placeholder="勘定科目・摘要で検索"
                autoComplete="off"
                style={searchInputStyle}
              />
            </div>
            <div style={{ width: 190 }}>
              <label style={{ ...searchLabel, color: BLUE }}>借方勘定科目</label>
              <select
                className="search-select"
                value={search.kari}
                onChange={(e) => setSearchField('kari', e.target.value)}
                style={searchSelectStyle}
              >
                <option value="">全て</option>
                {ACCOUNT_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ width: 190 }}>
              <label style={{ ...searchLabel, color: PINK }}>貸方勘定科目</label>
              <select
                className="search-select"
                value={search.kashi}
                onChange={(e) => setSearchField('kashi', e.target.value)}
                style={searchSelectStyle}
              >
                <option value="">全て</option>
                {ACCOUNT_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={searchLabel}>金額</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  className="search-input no-ring"
                  value={search.amountMin}
                  onChange={(e) => setSearchField('amountMin', e.target.value)}
                  onKeyDown={onSearchKey}
                  inputMode="numeric"
                  placeholder="下限"
                  style={{ ...searchInputStyle, width: 104, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                />
                <span style={{ color: '#9aa5b1' }}>〜</span>
                <input
                  className="search-input no-ring"
                  value={search.amountMax}
                  onChange={(e) => setSearchField('amountMax', e.target.value)}
                  onKeyDown={onSearchKey}
                  inputMode="numeric"
                  placeholder="上限"
                  style={{ ...searchInputStyle, width: 104, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 9 }}>
              <button
                type="button"
                className="btn-outline"
                onClick={clearSearch}
                style={{
                  padding: '9px 18px',
                  border: '1px solid #cfd8e0',
                  borderRadius: 8,
                  background: '#fff',
                  color: '#5b6773',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                クリア
              </button>
              <button type="button" className="submit-btn" onClick={doSearch} style={searchBtnStyle}>
                検索
              </button>
            </div>
          </div>
        </div>

        {/* コンテンツ */}
        <main style={{ flex: 1, minHeight: 0, padding: '20px 24px 24px', display: 'flex' }}>
          <div
            style={{
              width: '100%',
              background: '#fff',
              border: '1px solid #dde4ea',
              borderRadius: 14,
              boxShadow: '0 6px 26px rgba(30,50,70,.06)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* 入力バー */}
            <div style={{ padding: '16px 22px 18px', borderBottom: '1px solid #eef2f5', flex: 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, marginBottom: 13 }}>
                <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 16 }}>新規仕訳の入力</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 11, color: '#8895a3' }}>取引区分</span>
                  <Chips current={f.torihiki} accent={BLUE} onToggle={v.setTorihiki} />
                </div>
              </div>
              {/* flex-wrap で横スクロールを避ける（補助ドロップダウンが切れないため） */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'end' }}>
                <div style={{ width: 130, flex: 'none' }}>
                  <label style={barLabel}>日付（月/日）</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input className="field-input" value={f.month} onChange={(e) => v.setField('month', e.target.value)} inputMode="numeric" style={dateInput} />
                    <span style={{ color: '#9aa5b1' }}>/</span>
                    <input className="field-input" value={f.day} onChange={(e) => v.setField('day', e.target.value)} inputMode="numeric" style={dateInput} />
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 190 }}>
                  <label style={{ ...barLabel, color: BLUE }}>借方科目</label>
                  <AssistField
                    value={f.kariKamoku}
                    placeholder="科目を選択"
                    open={v.isActive('kariKamoku')}
                    onOpen={() => v.openAssist('kariKamoku', 'account')}
                    accent={BLUE}
                    accentRgb={BLUE_RGB}
                    buttonStyle={fieldBtnBase}
                    panelStyle={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: '100%', minWidth: 260, zIndex: 60 }}
                    groups={v.assistGroups}
                    query={v.assist.query}
                    empty={v.assistEmpty}
                    onInput={v.onQueryInput}
                    onPick={v.pick}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 190 }}>
                  <label style={{ ...barLabel, color: PINK }}>貸方科目</label>
                  <AssistField
                    value={f.kashiKamoku}
                    placeholder="科目を選択"
                    open={v.isActive('kashiKamoku')}
                    onOpen={() => v.openAssist('kashiKamoku', 'account')}
                    accent={PINK}
                    accentRgb={PINK_RGB}
                    buttonStyle={fieldBtnBase}
                    panelStyle={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: '100%', minWidth: 260, zIndex: 60 }}
                    groups={v.assistGroups}
                    query={v.assist.query}
                    empty={v.assistEmpty}
                    onInput={v.onQueryInput}
                    onPick={v.pick}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label style={barLabel}>摘要</label>
                  <div style={{ position: 'relative', display: 'flex', gap: 5 }} data-assist>
                    <input
                      className="field-input ring"
                      value={f.tekiyo}
                      onChange={(e) => v.setField('tekiyo', e.target.value)}
                      placeholder="摘要を入力"
                      autoComplete="off"
                      style={{
                        flex: 1,
                        padding: '10px 11px',
                        border: '1px solid #cfd8e0',
                        borderRadius: 8,
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
                      style={{ flex: 'none', width: 38, border: '1px solid #cfd8e0', borderRadius: 8, background: '#eef2f5', cursor: 'pointer', color: '#7a8794', fontSize: 9 }}
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
                        style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: 250, zIndex: 60 }}
                      />
                    )}
                  </div>
                </div>
                <div style={{ width: 150, flex: 'none' }}>
                  <label style={barLabel}>業者</label>
                  <AssistField
                    value={f.gyosha}
                    placeholder="業者を選択"
                    open={v.isActive('gyosha')}
                    onOpen={() => v.openAssist('gyosha', 'vendor')}
                    accent={BLUE}
                    accentRgb={BLUE_RGB}
                    buttonStyle={{ ...fieldBtnBase, fontSize: 13.5 }}
                    panelStyle={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: '100%', minWidth: 200, zIndex: 60 }}
                    groups={v.assistGroups}
                    query={v.assist.query}
                    empty={v.assistEmpty}
                    onInput={v.onQueryInput}
                    onPick={v.pick}
                  />
                </div>
                <div style={{ width: 150, flex: 'none' }}>
                  <label style={{ ...barLabel, textAlign: 'right' }}>金額</label>
                  <input
                    className="field-input ring"
                    value={v.amountFmt}
                    onChange={(e) => v.setField('amount', e.target.value)}
                    inputMode="numeric"
                    placeholder="0"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      textAlign: 'right',
                      fontSize: 16,
                      fontWeight: 700,
                      padding: '9px 11px',
                      border: '1px solid #cfd8e0',
                      borderRadius: 8,
                      outline: 'none',
                      fontFamily: 'inherit',
                      background: '#fff',
                      color: '#22303c',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  />
                </div>
                <button type="button" className="submit-btn" onClick={() => v.submit()} style={submitStyle}>
                  登録
                </button>
              </div>
              <div style={{ minHeight: 18, marginTop: 9 }}>
                {v.err && <span style={{ color: '#c0392b', fontSize: 12.5, fontWeight: 500 }}>{v.err}</span>}
              </div>
            </div>

            {/* 月フィルター + 件数 */}
            <div style={{ padding: '10px 22px', borderBottom: '1px solid #eef2f5', display: 'flex', alignItems: 'center', gap: 12, flex: 'none' }}>
              <span style={{ fontSize: 11, color: '#8895a3', fontWeight: 600, flex: 'none' }}>表示月</span>
              <MonthChips months={v.months} current={v.monthFilter} accent={BLUE} onSelect={v.setMonth} />
              <span style={{ marginLeft: 'auto', fontSize: 12, color: '#8895a3', flex: 'none' }}>
                検索結果 <b style={{ color: '#22303c', fontWeight: 700 }}>{rows.length}</b> 件
              </span>
            </div>

            {/* テーブル見出し */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: LEDGER_COLS,
                gap: 14,
                padding: '10px 22px',
                background: '#f6f8fa',
                fontSize: 10.5,
                fontWeight: 700,
                color: '#8290a0',
                borderBottom: '1px solid #eef2f5',
                flex: 'none',
              }}
            >
              <div>月日</div>
              <div>借方科目</div>
              <div>貸方科目</div>
              <div>摘要</div>
              <div style={{ textAlign: 'right' }}>金額</div>
            </div>

            {/* 明細 */}
            <div id="journal-scroll" style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
              {rows.length === 0 && (
                <div style={{ padding: '48px 22px', textAlign: 'center', color: '#9aa5b1', fontSize: 13 }}>
                  該当する仕訳がありません。検索条件を変更してください。
                </div>
              )}
              {rows.map((e) => {
                const isNew = e.id === v.lastAdded;
                return (
                  <div
                    key={e.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: LEDGER_COLS,
                      gap: 14,
                      padding: '11px 22px',
                      borderBottom: '1px solid #f1f4f6',
                      fontSize: 12.5,
                      alignItems: 'center',
                      background: isNew ? '#fff2c9' : 'transparent',
                      animation: isNew ? 'rowin 1.8s ease' : 'none',
                    }}
                  >
                    <div style={{ color: '#8895a3', fontSize: 12 }}>{e.date}</div>
                    <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.kari}</div>
                    <div style={{ color: '#48565f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.kashi}</div>
                    <div style={{ color: '#7a8794', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.tekiyo}</div>
                    <div style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{e.amount.toLocaleString('ja-JP')}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </main>
          </>
        )}
      </div>
    </div>
  );
}

const searchInputStyle: CSSProperties = {
  width: '100%',
  padding: '9px 11px',
  border: '1px solid #cfd8e0',
  borderRadius: 8,
  fontSize: 13,
  fontFamily: 'inherit',
  outline: 'none',
  color: '#22303c',
  boxSizing: 'border-box',
};

const searchSelectStyle: CSSProperties = {
  width: '100%',
  padding: '9px 10px',
  border: '1px solid #cfd8e0',
  borderRadius: 8,
  fontSize: 13,
  fontFamily: 'inherit',
  outline: 'none',
  background: '#fff',
  color: '#22303c',
  cursor: 'pointer',
  boxSizing: 'border-box',
};
