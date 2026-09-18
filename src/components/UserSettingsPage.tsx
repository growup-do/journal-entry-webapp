// ユーザー設定：プロフィール／パスワード変更／通知／表示設定（一般的な構成）

import { useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { Modal } from './Modal';
import { ToastView, useToast } from './Toast';
import { Notice, Steps } from './ui';

const AUTH_APPS = ['Google Authenticator', 'Microsoft Authenticator', 'Authy', 'その他（TOTP対応アプリ）'];
const MANUAL_KEY = 'JBSW Y3DP EHPK 3PXP K7ZQ 4MUT';
/** IME 変換確定の Enter を無視する */
const onEnter = (fn: () => void) => (e: KeyboardEvent) => {
  if (e.key !== 'Enter') return;
  if (e.nativeEvent.isComposing || (e.nativeEvent as unknown as { keyCode: number }).keyCode === 229) return;
  e.preventDefault();
  fn();
};
/** QRコード風のダミー（決定的な擬似乱数で 25×25 のマス目を描く。本番では TOTP の otpauth:// URI を符号化） */
function FakeQr({ seed, size = 168 }: { seed: string; size?: number }) {
  const cells = useMemo(() => {
    const n = 25;
    let h = 2166136261;
    for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
    const rnd = () => { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; return h / 4294967296; };
    const out: boolean[][] = [];
    for (let y = 0; y < n; y++) { const row: boolean[] = []; for (let x = 0; x < n; x++) row.push(rnd() < 0.45); out.push(row); }
    // 位置検出パターン（左上・右上・左下）
    const finder = (ox: number, oy: number) => { for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) { const edge = x === 0 || y === 0 || x === 6 || y === 6; const core = x >= 2 && x <= 4 && y >= 2 && y <= 4; out[oy + y][ox + x] = edge || core; } for (let i = -1; i <= 7; i++) { const set = (x: number, y: number) => { if (x >= 0 && y >= 0 && x < n && y < n && (x < ox || x > ox + 6 || y < oy || y > oy + 6)) out[y][x] = false; }; set(ox + i, oy - 1); set(ox + i, oy + 7); set(ox - 1, oy + i); set(ox + 7, oy + i); } };
    finder(0, 0); finder(n - 7, 0); finder(0, n - 7);
    return out;
  }, [seed]);
  const n = cells.length;
  const c = size / (n + 2);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="認証アプリ用QRコード（サンプル）" style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8ee' }}>
      {cells.map((row, y) => row.map((on, x) => (on ? <rect key={`${x}-${y}`} x={(x + 1) * c} y={(y + 1) * c} width={c + 0.2} height={c + 0.2} fill="#22303c" /> : null)))}
    </svg>
  );
}

interface Props {
  variant: 'form' | 'sheet';
  accent: string;
}

export function UserSettingsPage({ variant, accent }: Props) {
  const toast = useToast();
  const [profile, setProfile] = useState({ name: '経理 担当者', kana: 'ケイリ タントウシャ', email: 'keiri@example.jp', dept: '本部 経理', role: '経理担当（入力・照会）' });
  const [pw, setPw] = useState({ cur: '', next: '', confirm: '' });
  const [notify, setNotify] = useState({ closing: true, audit: true, news: false, mail: true });
  const [view, setView] = useState({ start: 'ホーム', mode: 'フォーム型', density: '標準' });
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
  // 二段階認証（認証アプリ）設定ウィザード
  const [twoFa, setTwoFa] = useState(false);
  const [tfaOpen, setTfaOpen] = useState(false);
  const [tfaStep, setTfaStep] = useState(0);
  const [tfaApp, setTfaApp] = useState(AUTH_APPS[0]);
  const [tfaCode, setTfaCode] = useState('');
  const [tfaOff, setTfaOff] = useState(false);
  const openTfa = () => { setTfaStep(0); setTfaCode(''); setTfaOpen(true); };
  const enableTfa = () => {
    if (tfaCode.length !== 6) return toast.show('認証アプリに表示された6桁のコードを入力してください');
    setTwoFa(true); setTfaOpen(false);
    toast.show('二段階認証を有効にしました。次回ログインからコード入力が必要になります');
  };
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
    setPw({ cur: '', next: '', confirm: '' });
    toast.show('パスワードを変更しました（プロトタイプ）');
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
              <div style={{ borderTop: '1px solid #eef2f5', paddingTop: 12, fontSize: 12.5, color: '#5b6773', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ flex: 1 }}>二段階認証（認証アプリ）{twoFa && <span style={{ display: 'block', fontSize: 11, color: '#9aa5b1' }}>{tfaApp}</span>}</span>
                {twoFa
                  ? <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#eaf5ef', color: '#1f7a52' }}>有効</span>
                  : <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#f1f4f6', color: '#7a8794' }}>未設定</span>}
                {twoFa
                  ? <button type="button" className="btn-outline" onClick={() => setTfaOff(true)} style={{ ...btn(), color: '#c0392b' }}>解除</button>
                  : <button type="button" className="btn-outline" onClick={openTfa} style={btn()}>設定する</button>}
              </div>
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
              <div><span style={label}>入力画面のレイアウト</span>
                <select value={view.mode} onChange={(e) => setView({ ...view, mode: e.target.value })} style={input}>{['フォーム型', 'スプレッドシート型'].map((o) => <option key={o}>{o}</option>)}</select></div>
              <div><span style={label}>表の行間</span>
                <select value={view.density} onChange={(e) => setView({ ...view, density: e.target.value })} style={input}>{['標準', 'コンパクト', 'ゆったり'].map((o) => <option key={o}>{o}</option>)}</select></div>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}><button type="button" className="submit-btn" onClick={() => toast.show('表示設定を保存しました（プロトタイプ）')} style={btn(true)}>保存</button></div>
            </div>
          </section>
        </div>
      </div>

      {/* 二段階認証 設定ウィザード */}
      <Modal open={tfaOpen} onClose={() => setTfaOpen(false)} width={560} title="二段階認証の設定" strict>
        <Steps steps={['認証アプリ', 'QRコード', 'コード確認']} current={tfaStep} accent={accent} />
        <div style={{ padding: '18px 22px 20px' }}>
          {tfaStep === 0 && (
            <>
              <div style={{ fontSize: 13.5, marginBottom: 10 }}>スマートフォンにインストールした認証アプリを選択してください。</div>
              {AUTH_APPS.map((a) => (
                <label key={a} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '7px 4px', fontSize: 13.5, cursor: 'pointer' }}><input type="radio" name="tfa-app" checked={tfaApp === a} onChange={() => setTfaApp(a)} />{a}</label>
              ))}
              <div style={{ marginTop: 10 }}><Notice>認証アプリはログイン時に30秒ごとに変わる6桁のコードを表示します。パスワードに加えてこのコードの入力が必要になり、第三者による不正ログインを防ぎます。</Notice></div>
            </>
          )}
          {tfaStep === 1 && (
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <FakeQr seed={profile.email + tfaApp} />
              <div style={{ flex: 1, minWidth: 220, fontSize: 13, lineHeight: 1.8 }}>
                <div><b>{tfaApp}</b> でこのQRコードを読み取ってください。</div>
                <div style={{ fontSize: 12, color: '#7a8794', marginTop: 8 }}>読み取れない場合は次のキーを手動で入力してください。</div>
                <div style={{ marginTop: 4, padding: '8px 10px', background: '#f6f8fa', borderRadius: 8, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 14, letterSpacing: '.06em', fontWeight: 700 }}>{MANUAL_KEY}</div>
                <div style={{ fontSize: 11, color: '#9aa5b1', marginTop: 6 }}>アカウント名：{profile.email}　種類：時間ベース（TOTP）</div>
              </div>
            </div>
          )}
          {tfaStep === 2 && (
            <>
              <div style={{ fontSize: 13.5, marginBottom: 10 }}>認証アプリに表示されている6桁のコードを入力してください。</div>
              <input className="field-input ring" value={tfaCode} onChange={(e) => setTfaCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} onKeyDown={onEnter(enableTfa)} inputMode="numeric" autoFocus placeholder="000000" style={{ ...input, width: 200, textAlign: 'center', fontSize: 24, letterSpacing: '.3em', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }} />
              <div style={{ fontSize: 11, color: '#9aa5b1', marginTop: 8 }}>プロトタイプでは6桁の数字であれば有効化できます。本番ではサーバー側でコードを検証します。</div>
            </>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
            {tfaStep > 0 && <button type="button" onClick={() => setTfaStep(tfaStep - 1)} style={{ ...btn(), marginRight: 'auto' }}>戻る</button>}
            <button type="button" onClick={() => setTfaOpen(false)} style={btn()}>キャンセル</button>
            {tfaStep < 2
              ? <button type="button" className="submit-btn" onClick={() => setTfaStep(tfaStep + 1)} style={btn(true)}>次へ</button>
              : <button type="button" className="submit-btn" onClick={enableTfa} disabled={tfaCode.length !== 6} style={{ ...btn(true), opacity: tfaCode.length === 6 ? 1 : 0.5 }}>有効化</button>}
          </div>
        </div>
      </Modal>

      {/* 二段階認証 解除の確認 */}
      <Modal open={tfaOff} onClose={() => setTfaOff(false)} width={420} title="二段階認証の解除" strict>
        <div style={{ padding: '18px 22px 20px', fontSize: 13.5, lineHeight: 1.7 }}>
          二段階認証を解除すると、ログイン時のコード入力が不要になり安全性が下がります。解除してもよろしいですか？
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
            <button type="button" onClick={() => setTfaOff(false)} style={btn()}>キャンセル</button>
            <button type="button" onClick={() => { setTwoFa(false); setTfaOff(false); toast.show('二段階認証を解除しました'); }} style={{ ...btn(true), background: '#c0392b' }}>解除する</button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
