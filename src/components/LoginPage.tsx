// ログイン画面（プロトタイプ：メール／パスワードは入力済み。そのまま「ログイン」で入れる）

import { useState } from 'react';
import { Footer } from './Footer';
import type { CSSProperties, KeyboardEvent } from 'react';
import { ToastView, useToast } from './Toast';

const GREEN = '#1f7a52';

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
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit();
  };

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
              <button type="button" onClick={() => toast.show('パスワード再設定メールの送信：プロトタイプでは動作しません')} style={{ border: 'none', background: 'transparent', color: GREEN, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5 }}>パスワードをお忘れですか？</button>
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
    </div>
  );
}
