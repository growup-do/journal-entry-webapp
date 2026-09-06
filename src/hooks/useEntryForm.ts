// 仕訳入力の共有ロジック（フォーム型・スプレッドシート型で共通）
// プロトタイプ（.dc.html の Component クラス）の挙動を忠実に移植。
// 各画面はこのフックをベースに、固有の状態（折りたたみ / 検索）を足す。

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildGroups, mkField, monthsOf } from '../lib/format';
import type {
  AssistFieldName,
  AssistState,
  AssistType,
  FormState,
  JournalEntry,
  MonthFilter,
} from '../types';

export interface UseEntryFormOptions {
  initialForm: FormState;
  seed: JournalEntry[];
  /** 登録成功後に追加で行う処理（例: 検索条件のクリア）。同一ハンドラ内で呼ぶためバッチされる。 */
  afterSubmit?: () => void;
  /** 月フィルターの初期値（省略時は全月） */
  initialMonth?: MonthFilter;
}

export interface EntryForm {
  form: FormState;
  assist: AssistState;
  journal: JournalEntry[];
  lastAdded: number | null;
  err: string;
  monthFilter: MonthFilter;
  // 派生値
  fields: Record<'service' | 'kariKamoku' | 'kashiKamoku' | 'gyosha', ReturnType<typeof mkField>>;
  amountFmt: string;
  assistGroups: ReturnType<typeof buildGroups>;
  assistEmpty: boolean;
  months: string[];
  isActive: (field: AssistFieldName) => boolean;
  // ハンドラ
  openAssist: (field: AssistFieldName, type: AssistType) => void;
  onQueryInput: (query: string) => void;
  pick: (rawValue: string) => void;
  setField: (field: keyof FormState, rawValue: string) => void;
  setTorihiki: (label: '資金' | '事業' | 'その他') => void;
  setMonth: (month: MonthFilter) => void;
  /** 複数項目をまとめて設定（訂正で行を入力欄に戻すときなど） */
  setFields: (patch: Partial<FormState>) => void;
  /** 仕訳帳から1行削除 */
  removeEntry: (id: number) => void;
  /** 登録。extra で画面固有の追加項目（証憑・小切手No 等）を付与できる。 */
  submit: (extra?: Partial<JournalEntry>) => void;
}

export function useEntryForm({ initialForm, seed, afterSubmit, initialMonth = null }: UseEntryFormOptions): EntryForm {
  const [form, setForm] = useState<FormState>(initialForm);
  const [assist, setAssist] = useState<AssistState>({ open: false, field: '', type: '', query: '' });
  const [journal, setJournal] = useState<JournalEntry[]>(seed);
  const [lastAdded, setLastAdded] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const [monthFilter, setMonthFilter] = useState<MonthFilter>(initialMonth);

  const nextId = useRef(1);
  const afterSubmitRef = useRef(afterSubmit);
  afterSubmitRef.current = afterSubmit;

  // 補助ドロップダウン外の mousedown（capture）で閉じる
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (assist.open && !(target && target.closest('[data-assist]'))) {
        setAssist((s) => ({ ...s, open: false }));
      }
    };
    document.addEventListener('mousedown', onDown, true);
    return () => document.removeEventListener('mousedown', onDown, true);
  }, [assist.open]);

  // 追加後、仕訳帳スクロール領域を最下部へ（scrollIntoView は使わない）
  useEffect(() => {
    if (lastAdded == null) return;
    const el = document.getElementById('journal-scroll');
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastAdded]);

  const openAssist = useCallback((field: AssistFieldName, type: AssistType) => {
    setAssist({ open: true, field, type, query: '' });
    // 開いた直後に検索入力へフォーカス（AssistPanel 側でも自動フォーカス）
    setTimeout(() => document.getElementById('assist-search')?.focus(), 30);
  }, []);

  const onQueryInput = useCallback((query: string) => {
    setAssist((s) => ({ ...s, query }));
  }, []);

  const pick = useCallback(
    (rawValue: string) => {
      const field = assist.field;
      if (field) {
        const val = rawValue === '（なし）' ? '' : rawValue;
        setForm((s) => ({ ...s, [field]: val }));
        setErr('');
      }
      setAssist((s) => ({ ...s, open: false }));
    },
    [assist.field],
  );

  const setField = useCallback((field: keyof FormState, rawValue: string) => {
    let val = rawValue;
    if (field === 'amount') val = val.replace(/[^0-9]/g, '');
    if (field === 'month' || field === 'day') val = val.replace(/[^0-9]/g, '').slice(0, 2);
    setForm((s) => ({ ...s, [field]: val }));
    setErr('');
  }, []);

  const setTorihiki = useCallback((label: '資金' | '事業' | 'その他') => {
    setForm((s) => ({ ...s, torihiki: s.torihiki === label ? '' : label }));
  }, []);

  const setMonth = useCallback((month: MonthFilter) => setMonthFilter(month), []);
  const setFields = useCallback((patch: Partial<FormState>) => {
    setForm((s) => ({ ...s, ...patch }));
    setErr('');
  }, []);
  const removeEntry = useCallback((id: number) => setJournal((arr) => arr.filter((e) => e.id !== id)), []);

  // 各 setState には純粋な更新関数のみを渡す（StrictModeの二重実行で重複追加しないため、
  // 採番などの副作用は updater の外＝このコールバック本体で1回だけ行う）。
  const submit = useCallback((extra?: Partial<JournalEntry>) => {
    if (!form.kariKamoku || !form.kashiKamoku || !form.amount) {
      setErr('借方科目・貸方科目・金額を入力してください。');
      return;
    }
    const month = form.month || '';
    const id = nextId.current++;
    const entry: JournalEntry = {
      id,
      date: month + '/' + (form.day || ''),
      kari: form.kariKamoku,
      kashi: form.kashiKamoku,
      tekiyo: form.tekiyo || '',
      amount: parseInt(form.amount, 10) || 0,
      gyosha: form.gyosha || undefined,
      ...extra,
    };
    setJournal((arr) => [...arr, entry]);
    setLastAdded(id);
    setErr('');
    // 借方・貸方・摘要・業者・金額をクリア（日付・取引区分・サービス区分は保持）
    setForm((s) => ({ ...s, kariKamoku: '', kashiKamoku: '', tekiyo: '', gyosha: '', amount: '' }));
    // フィルターが特定月に絞られていて新規行の月と異なる場合は新規行の月へ自動切替
    setMonthFilter((mf) => (mf != null && mf !== month ? month : mf));
    afterSubmitRef.current?.();
  }, [form]);

  const assistGroups = useMemo(
    () => (assist.open && assist.type ? buildGroups(assist.type, assist.query) : []),
    [assist.open, assist.type, assist.query],
  );
  const assistEmpty = assist.open && assistGroups.reduce((n, g) => n + g.items.length, 0) === 0;

  const isActive = useCallback(
    (field: AssistFieldName) => assist.open && assist.field === field,
    [assist.open, assist.field],
  );

  return {
    form,
    assist,
    journal,
    lastAdded,
    err,
    monthFilter,
    fields: {
      service: mkField(form.service, '選択'),
      kariKamoku: mkField(form.kariKamoku, '科目を選択'),
      kashiKamoku: mkField(form.kashiKamoku, '科目を選択'),
      gyosha: mkField(form.gyosha, '業者を選択'),
    },
    amountFmt: useMemo(() => {
      const n = parseInt(form.amount.replace(/[^0-9]/g, ''), 10);
      return isNaN(n) ? '' : n.toLocaleString('ja-JP');
    }, [form.amount]),
    assistGroups,
    assistEmpty,
    months: useMemo(() => monthsOf(journal), [journal]),
    isActive,
    openAssist,
    onQueryInput,
    pick,
    setField,
    setTorihiki,
    setMonth,
    setFields,
    removeEntry,
    submit,
  };
}
