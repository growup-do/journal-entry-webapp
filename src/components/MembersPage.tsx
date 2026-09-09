// メンバーの追加、管理：メンバー一覧（権限・状態・最終ログイン）、招待、権限変更、無効化／削除

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { NUM, TD, TH } from './ReportShell';
import { ToastView, useToast } from './Toast';

type Role = '管理者' | '経理担当' | '閲覧のみ';
type Status = '有効' | '招待中' | '無効';
interface Member { id: number; name: string; email: string; role: Role; status: Status; last: string }
const ROLES: Role[] = ['管理者', '経理担当', '閲覧のみ'];
const ROLE_DESC: Record<Role, string> = { 管理者: 'すべての操作＋設定・メンバー管理', 経理担当: '仕訳の入力・訂正・照会、帳票出力', 閲覧のみ: '照会・帳票出力のみ（入力不可）' };
const SEED: Member[] = [
  { id: 1, name: '園長 太郎', email: 'encho@example.jp', role: '管理者', status: '有効', last: '2026/09/09 08:12' },
  { id: 2, name: '経理 担当者', email: 'keiri@example.jp', role: '経理担当', status: '有効', last: '2026/09/09 09:40' },
  { id: 3, name: '事務 花子', email: 'jimu@example.jp', role: '経理担当', status: '有効', last: '2026/09/05 17:22' },
  { id: 4, name: '税理士 次郎', email: 'zeirishi@example.jp', role: '閲覧のみ', status: '有効', last: '2026/08/28 10:05' },
  { id: 5, name: '（招待中）', email: 'new-staff@example.jp', role: '閲覧のみ', status: '招待中', last: '—' },
];

interface Props {
  variant: 'form' | 'sheet';
  accent: string;
}

export function MembersPage({ variant, accent }: Props) {
  const [members, setMembers] = useState<Member[]>(SEED);
  const [invite, setInvite] = useState({ email: '', role: '経理担当' as Role });
  const toast = useToast();
  const isSheet = variant === 'sheet';
  const card: CSSProperties = { background: '#fff', border: '1px solid #dde4ea', borderRadius: 14, boxShadow: '0 6px 26px rgba(30,50,70,.06)', overflow: 'hidden' };
  const h2: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid #eef2f5', fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 15 };
  const input: CSSProperties = { boxSizing: 'border-box', padding: '9px 11px', border: '1px solid #cfd8e0', borderRadius: 8, fontSize: 13.5, fontFamily: 'inherit', outline: 'none', color: '#22303c', background: '#fff' };
  const btn = (color = '#5b6773', solid = false): CSSProperties => ({ padding: '7px 12px', borderRadius: 7, border: '1px solid ' + (solid ? color : '#cfd8e0'), background: solid ? color : '#fff', color: solid ? '#fff' : color, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' });
  const statusStyle = (s: Status): CSSProperties => ({ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: s === '有効' ? '#eaf5ef' : s === '招待中' ? '#fff1b8' : '#f1f4f6', color: s === '有効' ? '#1f7a52' : s === '招待中' ? '#8a6d00' : '#9aa5b1' });

  const sendInvite = () => {
    const email = invite.email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast.show('メールアドレスの形式が正しくありません');
    if (members.some((m) => m.email === email)) return toast.show('このメールアドレスはすでに登録されています');
    setMembers((ms) => [...ms, { id: Date.now(), name: '（招待中）', email, role: invite.role, status: '招待中', last: '—' }]);
    setInvite({ email: '', role: '経理担当' });
    toast.show(`${email} に招待メールを送信しました（プロトタイプ）`);
  };
  const setRole = (id: number, role: Role) => setMembers((ms) => ms.map((m) => (m.id === id ? { ...m, role } : m)));
  const toggleActive = (m: Member) => {
    if (m.status === '招待中') {
      if (confirm(`${m.email} への招待を取り消しますか？`)) setMembers((ms) => ms.filter((x) => x.id !== m.id));
      return;
    }
    const to: Status = m.status === '有効' ? '無効' : '有効';
    if (to === '無効' && !confirm(`${m.name} を無効化しますか？（ログインできなくなります。データは残ります）`)) return;
    setMembers((ms) => ms.map((x) => (x.id === m.id ? { ...x, status: to } : x)));
  };
  const remove = (m: Member) => {
    if (confirm(`${m.name}（${m.email}）を削除しますか？この操作は取り消せません。`)) setMembers((ms) => ms.filter((x) => x.id !== m.id));
  };
  const admins = members.filter((m) => m.role === '管理者' && m.status === '有効').length;

  return (
    <main style={{ flex: 1, minWidth: 0, padding: isSheet ? '20px 24px 24px' : 28, display: 'flex', justifyContent: 'center' }}>
      <ToastView msg={toast.msg} />
      <div style={{ width: '100%', maxWidth: 1100, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: isSheet ? 18 : 22 }}>メンバーの追加、管理</div>
          <div style={{ color: '#7a8794', fontSize: 12.5, marginTop: 4 }}>このシステムを利用するメンバーの招待・権限・有効／無効を管理します（管理者のみ）。</div>
        </div>

        {/* 招待 */}
        <section style={card}>
          <div style={h2}>メンバーを招待</div>
          <div style={{ padding: 18, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#8290a0', marginBottom: 6 }}>メールアドレス</span>
              <input className="field-input ring" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} placeholder="name@example.jp" autoComplete="off" style={{ ...input, width: '100%' }} />
            </div>
            <div style={{ width: 200 }}>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#8290a0', marginBottom: 6 }}>権限</span>
              <select value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value as Role })} style={{ ...input, width: '100%' }}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select>
            </div>
            <button type="button" className="submit-btn" onClick={sendInvite} style={{ ...btn(accent, true), padding: '10px 20px', fontSize: 13 }}>招待を送る</button>
          </div>
          <div style={{ display: 'flex', gap: 14, padding: '0 18px 14px', flexWrap: 'wrap' }}>
            {ROLES.map((r) => (
              <div key={r} style={{ fontSize: 11.5, color: '#7a8794' }}><b style={{ color: '#22303c' }}>{r}</b>：{ROLE_DESC[r]}</div>
            ))}
          </div>
        </section>

        {/* 一覧 */}
        <section style={card}>
          <div style={h2}>メンバー一覧 <span style={{ fontSize: 11.5, fontWeight: 500, color: '#7a8794' }}>{members.length} 名（有効な管理者 {admins} 名）</span></div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={TH}>氏名</th>
                  <th style={TH}>メールアドレス</th>
                  <th style={{ ...TH, width: 150 }}>権限</th>
                  <th style={{ ...TH, width: 80 }}>状態</th>
                  <th style={{ ...TH, width: 150 }}>最終ログイン</th>
                  <th style={{ ...TH, width: 170, textAlign: 'right' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const lastAdmin = m.role === '管理者' && m.status === '有効' && admins <= 1;
                  return (
                    <tr key={m.id} style={{ opacity: m.status === '無効' ? 0.55 : 1 }}>
                      <td style={{ ...TD, fontWeight: 600 }}>{m.name}</td>
                      <td style={{ ...TD, color: '#48565f' }}>{m.email}</td>
                      <td style={TD}>
                        <select value={m.role} disabled={lastAdmin} onChange={(e) => setRole(m.id, e.target.value as Role)} title={lastAdmin ? '最後の管理者の権限は変更できません' : ''} style={{ ...input, width: '100%', padding: '5px 8px', fontSize: 12.5 }}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select>
                      </td>
                      <td style={TD}><span style={statusStyle(m.status)}>{m.status}</span></td>
                      <td style={{ ...NUM, textAlign: 'left', color: '#7a8794', fontSize: 12 }}>{m.last}</td>
                      <td style={{ ...TD, textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          {m.status === '招待中' && <button type="button" className="btn-outline" onClick={() => toast.show(`${m.email} に招待メールを再送しました（プロトタイプ）`)} style={btn()}>再送</button>}
                          <button type="button" className="btn-outline" disabled={lastAdmin} onClick={() => toggleActive(m)} style={{ ...btn(), opacity: lastAdmin ? 0.4 : 1 }}>{m.status === '招待中' ? '取消' : m.status === '有効' ? '無効化' : '有効化'}</button>
                          <button type="button" className="btn-outline" disabled={lastAdmin} onClick={() => remove(m)} style={{ ...btn('#c0392b'), opacity: lastAdmin ? 0.4 : 1 }}>削除</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '10px 18px 14px', fontSize: 11, color: '#9aa5b1' }}>※ 最後の有効な管理者は権限変更・無効化・削除できません。</div>
        </section>
      </div>
    </main>
  );
}
