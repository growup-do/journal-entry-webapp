// ログイン画面（プロトタイプ：メール／パスワードは入力済み。そのまま「ログイン」で入れる）

import { useState } from 'react';
import { Footer } from './Footer';
import type { CSSProperties, KeyboardEvent } from 'react';
import { Modal } from './Modal';
import { ToastView, useToast } from './Toast';
import { Notice, Steps } from './ui';

const GREEN = '#1f7a52';
const RESET_STEPS = ['メールアドレス', '確認コード', '新しいパスワード', '完了'];
/** IME 変換確定の Enter（isComposing／keyCode 229）を無視する */
const isImeEnter = (e: KeyboardEvent) => e.nativeEvent.isComposing || (e.nativeEvent as unknown as { keyCode: number }).keyCode === 229;

export function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('keiri@example.jp');
  const [pw, setPw] = useState('password123');
  const [show, setShow] = useState(false);
  const [keep, setKeep] = useState(true);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const input: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '11px 12px', border: '1px solid #cfd8e0', borderRadius: 9, fontSize: 14.5, fontFamily: 'inherit', outline: 'none', color: '#22303c', background: '#fff' };
  const lbl: CSSProperties = { display: 'block', fontSize: 11.5, fontWeight: 700, color: '#8290a0', marginBottom: 6 };
  const submit = () => {
    if (!email.trim() || !pw) return toast.show('メールアドレスとパスワードを入力してください');
    setBusy(true);
    setTimeout(() => { setBusy(false); onLogin(); }, 500);
  };
  const onEnter = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !isImeEnter(e)) submit();
  };
  // パスワード再設定（画面内フロー）：メール入力 → 6桁コード → 新パスワード → 完了
  const [reset, setReset] = useState<{ open: boolean; step: number; email: string; code: string; pw: string; pw2: string; sending: boolean }>({ open: false, step: 0, email: '', code: '', pw: '', pw2: '', sending: false });
  const openReset = () => setReset({ open: true, step: 0, email: email.trim(), code: '', pw: '', pw2: '', sending: false });
  const closeReset = () => setReset((r) => ({ ...r, open: false }));
  const resetNext = () => {
    if (reset.step === 0) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reset.email.trim())) return toast.show('メールアドレスの形式が正しくありません');
      setReset((r) => ({ ...r, sending: true }));
      setTimeout(() => setReset((r) => ({ ...r, sending: false, step: 1 })), 600);
      return;
    }
    if (reset.step === 1) {
      if (reset.code.length !== 6) return toast.show('メールに記載された6桁の確認コードを入力してください');
      setReset((r) => ({ ...r, step: 2 }));
      return;
    }
    if (reset.step === 2) {
      if (reset.pw.length < 8) return toast.show('新しいパスワードは8文字以上にしてください');
      if (!/[a-zA-Z]/.test(reset.pw) || !/[0-9]/.test(reset.pw)) return toast.show('新しいパスワードは英字と数字を組み合わせてください');
      if (reset.pw !== reset.pw2) return toast.show('新しいパスワード（確認）が一致しません');
      setPw(reset.pw);
      setEmail(reset.email.trim());
      setReset((r) => ({ ...r, step: 3 }));
    }
  };
  const onResetEnter = (e: KeyboardEvent) => { if (e.key === 'Enter' && !isImeEnter(e)) { e.preventDefault(); resetNext(); } };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'linear-gradient(160deg,#e8ecf0 0%,#eef4f0 100%)', fontFamily: "'Noto Sans JP', sans-serif" }}>
      <ToastView msg={toast.msg} />
      <div style={{ width: 420, maxWidth: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 18 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, background: GREEN, color: '#fff', borderRadius: 10, fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 20 }}>会</span>
          <div>
            <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 18, lineHeight: 1.2 }}>会計基準システム</div>
            <div style={{ fontSize: 11.5, color: '#7a8794' }}>社会福祉法人向け　Web版</div>
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #dde4ea', borderRadius: 16, boxShadow: '0 10px 36px rgba(30,50,70,.10)', padding: '28px 30px 24px' }}>
          <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 18, marginBottom: 4 }}>ログイン</div>
          <div style={{ fontSize: 12, color: '#7a8794', marginBottom: 18 }}>登録済みのメールアドレスとパスワードを入力してください。</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <span style={lbl}>メールアドレス</span>
              <input id="login-email" className="field-input ring" type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={onEnter} autoComplete="username" style={input} />
            </div>
            <div>
              <span style={lbl}>パスワード</span>
              <div style={{ position: 'relative' }}>
                <input id="login-pw" className="field-input ring" type={show ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={onEnter} autoComplete="current-password" style={{ ...input, paddingRight: 64 }} />
                <button type="button" onClick={() => setShow((s) => !s)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', color: '#7a8794', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{show ? '隠す' : '表示'}</button>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: '#5b6773' }}><input type="checkbox" checked={keep} onChange={() => setKeep(!keep)} />ログイン状態を保持する</label>
              <button type="button" onClick={openReset} style={{ border: 'none', background: 'transparent', color: GREEN, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5 }}>パスワードをお忘れですか？</button>
            </div>
            <button id="login-submit" type="button" className="submit-btn" onClick={submit} disabled={busy} style={{ marginTop: 4, width: '100%', padding: '13px 16px', background: GREEN, color: '#fff', border: 'none', borderRadius: 11, fontWeight: 700, fontSize: 15, fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 3px 12px rgba(31,122,82,.24)', opacity: busy ? 0.7 : 1 }}>
              {busy ? 'ログイン中…' : 'ログイン'}
            </button>
          </div>
          <div style={{ marginTop: 16, padding: '10px 12px', background: '#fff7e6', border: '1px solid #f3d9b0', borderRadius: 9, fontSize: 11.5, color: '#8a5a00', lineHeight: 1.6 }}>
            プロトタイプのため、メールアドレス・パスワードは入力済みです。そのまま「ログイン」を押してください。
          </div>
        </div>
        <div style={{ textAlign: 'center', fontSize: 11, color: '#9aa5b1', marginTop: 14 }}>ご利用には事業者の管理者による招待が必要です。</div>
        <Footer compact />
      </div>

      {/* パスワード再設定 */}
      <Modal open={reset.open} onClose={closeReset} width={480} title="パスワードの再設定" strict>
        <Steps steps={RESET_STEPS} current={reset.step} accent={GREEN} />
        <div style={{ padding: '18px 26px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {reset.step === 0 && (
            <>
              <div style={{ fontSize: 13, color: '#5b6773', lineHeight: 1.7 }}>登録済みのメールアドレスを入力してください。再設定用の確認コードをお送りします。</div>
              <div><span style={lbl}>メールアドレス</span><input className="field-input ring" type="email" value={reset.email} onChange={(e) => setReset({ ...reset, email: e.target.value })} onKeyDown={onResetEnter} autoFocus autoComplete="username" style={input} /></div>
            </>
          )}
          {reset.step === 1 && (
            <>
              <Notice tone="ok">再設定メールを送信しました。<b>{reset.email.trim()}</b> に届いた6桁の確認コードを入力してください。</Notice>
              <div>
                <span style={lbl}>確認コード（6桁）</span>
                <input className="field-input ring" value={reset.code} onChange={(e) => setReset({ ...reset, code: e.target.value.replace(/[^0-9]/g, '').slice(0, 6) })} onKeyDown={onResetEnter} inputMode="numeric" autoFocus placeholder="000000" style={{ ...input, textAlign: 'center', fontSize: 24, letterSpacing: '.3em', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }} />
                <div style={{ fontSize: 11.5, color: '#9aa5b1', marginTop: 6 }}>コードの有効期限は10分です。届かない場合は迷惑メールフォルダをご確認ください。（プロトタイプでは6桁の数字であれば進めます）</div>
              </div>
              <button type="button" onClick={() => toast.show('確認コードを再送しました')} style={{ alignSelf: 'flex-start', border: 'none', background: 'transparent', color: GREEN, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, padding: 0 }}>コードを再送する</button>
            </>
          )}
          {reset.step === 2 && (
            <>
              <div><span style={lbl}>新しいパスワード（8文字以上・英数字混在）</span><input className="field-input ring" type="password" value={reset.pw} onChange={(e) => setReset({ ...reset, pw: e.target.value })} onKeyDown={onResetEnter} autoFocus autoComplete="new-password" style={input} /></div>
              <div><span style={lbl}>新しいパスワード（確認）</span><input className="field-input ring" type="password" value={reset.pw2} onChange={(e) => setReset({ ...reset, pw2: e.target.value })} onKeyDown={onResetEnter} autoComplete="new-password" style={input} /></div>
              <div style={{ display: 'flex', gap: 10, fontSize: 11.5 }}>
                {[['8文字以上', reset.pw.length >= 8], ['英字を含む', /[a-zA-Z]/.test(reset.pw)], ['数字を含む', /[0-9]/.test(reset.pw)], ['確認と一致', reset.pw.length > 0 && reset.pw === reset.pw2]].map(([t, ok]) => (
                  <span key={t as string} style={{ color: ok ? GREEN : '#9aa5b1', fontWeight: 700 }}>{ok ? '✓' : '○'} {t as string}</span>
                ))}
              </div>
            </>
          )}
          {reset.step === 3 && (
            <Notice tone="ok">パスワードを再設定しました。新しいパスワードでログインしてください。（プロトタイプ：ログイン欄に反映済みです）</Notice>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            {reset.step > 0 && reset.step < 3 && <button type="button" onClick={() => setReset({ ...reset, step: reset.step - 1 })} style={{ marginRight: 'auto', padding: '9px 16px', border: '1px solid #cfd8e0', borderRadius: 8, background: '#fff', color: '#5b6773', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>戻る</button>}
            {reset.step < 3 && <button type="button" onClick={closeReset} style={{ padding: '9px 16px', border: '1px solid #cfd8e0', borderRadius: 8, background: '#fff', color: '#5b6773', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>キャンセル</button>}
            {reset.step < 3
              ? <button type="button" className="submit-btn" onClick={resetNext} disabled={reset.sending} style={{ padding: '9px 20px', border: 'none', borderRadius: 8, background: GREEN, color: '#fff', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', opacity: reset.sending ? 0.7 : 1 }}>{reset.step === 0 ? (reset.sending ? '送信中…' : '確認コードを送信') : reset.step === 1 ? '次へ' : 'パスワードを再設定'}</button>
              : <button type="button" className="submit-btn" onClick={() => { closeReset(); setTimeout(() => document.getElementById('login-submit')?.focus(), 0); }} style={{ padding: '9px 20px', border: 'none', borderRadius: 8, background: GREEN, color: '#fff', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>ログイン画面へ</button>}
          </div>
        </div>
      </Modal>
    </div>
  );
}
