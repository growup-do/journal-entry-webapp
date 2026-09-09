// ユーザー設定：プロフィール／パスワード変更／通知／表示設定（一般的な構成）

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { ToastView, useToast } from './Toast';

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
                <span style={{ width: 56, height: 56, borderRadius: '50%', background: '#eef4f0', color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700 }}>経</span>
                <div>
                  <button type="button" className="btn-outline" onClick={() => toast.show('画像のアップロードはプロトタイプでは動作しません')} style={btn()}>画像を変更</button>
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
                <span style={{ flex: 1 }}>二段階認証（メール）</span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#f1f4f6', color: '#7a8794' }}>未設定</span>
                <button type="button" className="btn-outline" onClick={() => toast.show('二段階認証の設定はプロトタイプでは動作しません')} style={btn()}>設定する</button>
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
    </main>
  );
}
