// ユーザー設定：プロフィール／パスワード変更／通知／表示設定（一般的な構成）
//   パスワードの変更は、登録済みメールアドレスに届く確認コードでの確認のみ（二段階認証は行わない）。

import { useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { Modal } from './Modal';
import { ToastView, useToast } from './Toast';
import { Notice } from './ui';

/** IME 変換確定の Enter を無視する */
const onEnter = (fn: () => void) => (e: KeyboardEvent) => {
  if (e.key !== 'Enter') return;
  if (e.nativeEvent.isComposing || (e.nativeEvent as unknown as { keyCode: number }).keyCode === 229) return;
  e.preventDefault();
  fn();
};

interface Props {
  variant: 'form' | 'sheet';
  accent: string;
}

export function UserSettingsPage({ variant, accent }: Props) {
  const toast = useToast();
  const [profile, setProfile] = useState({ name: '経理 担当者', kana: 'ケイリ タントウシャ', email: 'keiri@example.jp', dept: '本部 経理', role: '経理担当（入力・照会）' });
  const [pw, setPw] = useState({ cur: '', next: '', confirm: '' });
  const [notify, setNotify] = useState({ closing: true, audit: true, news: false, mail: true });
  const [view, setView] = useState({ start: 'ホーム', density: '標準' });
  // プロフィール画像（DataURL で保持。本番ではサーバーへアップロード）
  const [avatar, setAvatar] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const onAvatarFile = (f: File | undefined) => {
    if (!f) return;
    if (!/^image\/(jpeg|png)$/.test(f.type)) return toast.show('JPEG または PNG の画像を選択してください');
    if (f.size > 2 * 1024 * 1024) return toast.show('画像は 2MB 以下にしてください');
    const rd = new FileReader();
    rd.onload = () => { setAvatar(String(rd.result)); toast.show('プロフィール画像を変更しました'); };
    rd.readAsDataURL(f);
  };
  // パスワード変更の確認：登録済みのメールアドレスに届く確認コードを入力する（二段階認証は行わない）
  const [mailOpen, setMailOpen] = useState(false);
  const [mailCode, setMailCode] = useState('');
  const isSheet = variant === 'sheet';
  const card: CSSProperties = { background: '#fff', border: '1px solid #dde4ea', borderRadius: 14, boxShadow: '0 6px 26px rgba(30,50,70,.06)', overflow: 'hidden' };
  const h2: CSSProperties = { padding: '14px 18px', borderBottom: '1px solid #eef2f5', fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 15 };
  const label: CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: '#8290a0', marginBottom: 6 };
  const input: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 11px', border: '1px solid #cfd8e0', borderRadius: 8, fontSize: 13.5, fontFamily: 'inherit', outline: 'none', color: '#22303c', background: '#fff' };
  const btn = (primary?: boolean): CSSProperties => ({ padding: '9px 20px', borderRadius: 8, border: primary ? 'none' : '1px solid #cfd8e0', background: primary ? accent : '#fff', color: primary ? '#fff' : '#5b6773', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' });
  const Toggle = ({ on, onChange, text }: { on: boolean; onChange: () => void; text: string }) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #f1f4f6', cursor: 'pointer', fontSize: 13 }}>
      <span style={{ flex: 1 }}>{text}</span>
      <span onClick={onChange} role="switch" aria-checked={on} style={{ width: 40, height: 22, borderRadius: 11, background: on ? accent : '#cfd8e0', position: 'relative', transition: 'background .15s' }}>
        <span style={{ position: 'absolute', top: 2, left: on ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} />
      </span>
    </label>
  );
  const savePw = () => {
    if (!pw.cur || !pw.next) return toast.show('現在のパスワードと新しいパスワードを入力してください');
    if (pw.next.length < 8) return toast.show('新しいパスワードは8文字以上にしてください');
    if (pw.next !== pw.confirm) return toast.show('新しいパスワード（確認）が一致しません');
    setMailCode(''); setMailOpen(true);
  };
  const confirmPw = () => {
    if (mailCode.length !== 6) return toast.show('メールに記載された6桁の確認コードを入力してください');
    setMailOpen(false); setMailCode('');
    setPw({ cur: '', next: '', confirm: '' });
    toast.show('パスワードを変更しました');
  };

  return (
    <main style={{ flex: 1, minWidth: 0, padding: isSheet ? '20px 24px 24px' : 28, display: 'flex', justifyContent: 'center' }}>
      <ToastView msg={toast.msg} />
      <div style={{ width: '100%', maxWidth: 1000, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: isSheet ? 18 : 22 }}>ユーザー設定</div>
          <div style={{ color: '#7a8794', fontSize: 12.5, marginTop: 4 }}>ご自身のアカウント情報・パスワード・通知・表示の設定です。事業者全体の設定は「設定」メニューから行います。</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 20, alignItems: 'start' }}>
          {/* プロフィール */}
          <section style={card}>
            <div style={h2}>プロフィール</div>
            <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ width: 56, height: 56, borderRadius: '50%', background: '#eef4f0', color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, overflow: 'hidden', flex: 'none' }}>
                  {avatar ? <img src={avatar} alt="プロフィール画像" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '経'}
                </span>
                <div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" className="btn-outline" onClick={() => { if (fileRef.current) { fileRef.current.value = ''; fileRef.current.click(); } }} style={btn()}>画像を変更</button>
                    {avatar && <button type="button" className="btn-outline" onClick={() => { setAvatar(null); toast.show('プロフィール画像を削除しました'); }} style={{ ...btn(), color: '#c0392b' }}>削除</button>}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" onChange={(e) => onAvatarFile(e.target.files?.[0])} style={{ display: 'none' }} />
                  <div style={{ fontSize: 11, color: '#9aa5b1', marginTop: 6 }}>JPEG／PNG・2MBまで</div>
                </div>
              </div>
              <div><span style={label}>氏名</span><input className="field-input ring" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} style={input} /></div>
              <div><span style={label}>フリガナ</span><input className="field-input ring" value={profile.kana} onChange={(e) => setProfile({ ...profile, kana: e.target.value })} style={input} /></div>
              <div style={{ gridColumn: 'span 2' }}><span style={label}>メールアドレス（ログインID）</span><input className="field-input ring" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} style={input} /></div>
              <div><span style={label}>所属</span><input className="field-input ring" value={profile.dept} onChange={(e) => setProfile({ ...profile, dept: e.target.value })} style={input} /></div>
              <div><span style={label}>権限</span><div style={{ ...input, background: '#f5f7f9', color: '#5b6773' }}>{profile.role}</div><div style={{ fontSize: 10.5, color: '#9aa5b1', marginTop: 4 }}>権限の変更は管理者が「メンバーの追加、管理」で行います</div></div>
              <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" className="submit-btn" onClick={() => toast.show('プロフィールを保存しました（プロトタイプ）')} style={btn(true)}>保存</button>
              </div>
            </div>
          </section>

          {/* パスワード */}
          <section style={card}>
            <div style={h2}>パスワードの変更</div>
            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div><span style={label}>現在のパスワード</span><input type="password" className="field-input ring" value={pw.cur} onChange={(e) => setPw({ ...pw, cur: e.target.value })} autoComplete="current-password" style={input} /></div>
              <div><span style={label}>新しいパスワード（8文字以上・英数字混在）</span><input type="password" className="field-input ring" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" style={input} /></div>
              <div><span style={label}>新しいパスワード（確認）</span><input type="password" className="field-input ring" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} autoComplete="new-password" style={input} /></div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button type="button" className="submit-btn" onClick={savePw} style={btn(true)}>パスワードを変更</button></div>
              <div style={{ borderTop: '1px solid #eef2f5', paddingTop: 12, fontSize: 12, color: '#7a8794', lineHeight: 1.7 }}>変更するときは、登録済みのメールアドレス（{profile.email}）に確認コードをお送りします。メールでの確認が済むと、新しいパスワードに切り替わります。</div>
            </div>
          </section>

          {/* 通知 */}
          <section style={card}>
            <div style={h2}>通知</div>
            <div style={{ padding: '4px 18px 14px' }}>
              <Toggle on={notify.closing} onChange={() => setNotify({ ...notify, closing: !notify.closing })} text="月次締め・決算調査の期限が近づいたら通知する" />
              <Toggle on={notify.audit} onChange={() => setNotify({ ...notify, audit: !notify.audit })} text="日次調査で不一致が見つかったら通知する" />
              <Toggle on={notify.news} onChange={() => setNotify({ ...notify, news: !notify.news })} text="お知らせ（法改正・保守）を通知する" />
              <Toggle on={notify.mail} onChange={() => setNotify({ ...notify, mail: !notify.mail })} text="通知をメールでも受け取る" />
            </div>
          </section>

          {/* 表示 */}
          <section style={card}>
            <div style={h2}>表示設定</div>
            <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div><span style={label}>ログイン後に開く画面</span>
                <select value={view.start} onChange={(e) => setView({ ...view, start: e.target.value })} style={input}>{['ホーム', '単一入力', '伝票入力', '仕訳一覧'].map((o) => <option key={o}>{o}</option>)}</select></div>
              <div><span style={label}>表の行間</span>
                <select value={view.density} onChange={(e) => setView({ ...view, density: e.target.value })} style={input}>{['標準', 'コンパクト', 'ゆったり'].map((o) => <option key={o}>{o}</option>)}</select></div>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}><button type="button" className="submit-btn" onClick={() => toast.show('表示設定を保存しました（プロトタイプ）')} style={btn(true)}>保存</button></div>
            </div>
          </section>
        </div>
      </div>

      {/* パスワード変更：メールアドレスでの確認 */}
      <Modal open={mailOpen} onClose={() => setMailOpen(false)} width={480} title="メールアドレスでの確認" strict>
        <div style={{ padding: '18px 22px 20px' }}>
          <Notice tone="ok">確認メールを送信しました。<b>{profile.email}</b> に届いた6桁の確認コードを入力してください。</Notice>
          <div style={{ marginTop: 14 }}>
            <span style={label}>確認コード（6桁）</span>
            <input data-pw-mail-code className="field-input ring" value={mailCode} onChange={(e) => setMailCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} onKeyDown={onEnter(confirmPw)} inputMode="numeric" autoFocus placeholder="000000" style={{ ...input, width: 200, textAlign: 'center', fontSize: 24, letterSpacing: '.3em', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }} />
          </div>
          <button type="button" onClick={() => toast.show('確認コードを再送しました')} style={{ marginTop: 10, border: 'none', background: 'transparent', color: accent, fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', padding: 0 }}>メールが届かないときは、確認コードを再送する</button>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
            <button type="button" onClick={() => setMailOpen(false)} style={btn()}>キャンセル</button>
            <button type="button" className="submit-btn" onClick={confirmPw} disabled={mailCode.length !== 6} style={{ ...btn(true), opacity: mailCode.length === 6 ? 1 : 0.5 }}>パスワードを変更</button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
