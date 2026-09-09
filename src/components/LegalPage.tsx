// 利用規約（叩き台）。フッターから同じタブで開く静的ページ（?page=terms）。個人情報保護方針はチャイルド社サイトへリンク。
// 条文は一般的な構成のサンプル。正式な文言はクライアントの規程に差し替える。

import { backToApp } from './Footer';

type Section = { title: string; body: string[] };

const TERMS: { title: string; lead: string; sections: Section[] } = {
  title: '利用規約',
  lead: 'この利用規約（以下「本規約」）は、社会福祉法人会計基準システム（以下「本サービス」）の利用条件を定めるものです。ご利用にあたっては本規約に同意いただく必要があります。',
  sections: [
    { title: '第1条（適用）', body: ['本規約は、本サービスの利用に関する提供者と利用者との間の一切の関係に適用されます。', '提供者が本サービス上で掲示する個別の規定は、本規約の一部を構成します。'] },
    { title: '第2条（利用登録）', body: ['本サービスは、事業者の管理者による招待を受けた方が、所定の方法で利用登録を行うことで利用できます。', '登録情報に虚偽があった場合、提供者は利用登録を取り消すことがあります。'] },
    { title: '第3条（アカウントの管理）', body: ['利用者は、自己の責任においてメールアドレスおよびパスワードを管理するものとします。', 'アカウントの第三者への貸与・譲渡はできません。'] },
    { title: '第4条（禁止事項）', body: ['法令または公序良俗に違反する行為', '本サービスのサーバーやネットワークの機能を妨害する行為', '他の利用者の情報を不正に取得・改ざんする行為', 'その他、提供者が不適切と判断する行為'] },
    { title: '第5条（本サービスの提供の停止等）', body: ['保守点検、災害、通信障害等により、提供者は事前の通知なく本サービスの全部または一部の提供を停止することがあります。'] },
    { title: '第6条（データの取扱い）', body: ['利用者が入力した会計データの権利は利用者に帰属します。', '提供者は、本サービスの提供・改善に必要な範囲でデータを取り扱います。'] },
    { title: '第7条（免責）', body: ['提供者は、本サービスに事実上または法律上の瑕疵がないことを保証するものではありません。', '本サービスの利用により利用者に生じた損害について、提供者の故意または重過失による場合を除き責任を負いません。'] },
    { title: '第8条（規約の変更）', body: ['提供者は、必要に応じて本規約を変更できるものとし、変更後の規約は本サービス上に掲示した時点から効力を生じます。'] },
    { title: '第9条（準拠法・管轄）', body: ['本規約は日本法に準拠し、本サービスに関する紛争は提供者の本店所在地を管轄する裁判所を専属的合意管轄とします。'] },
  ],
};


export function LegalPage() {
  const doc = TERMS;
  return (
    <div style={{ minHeight: '100vh', background: '#f3f5f7', fontFamily: "'Noto Sans JP', sans-serif", color: '#22303c', display: 'flex', flexDirection: 'column' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 10, background: '#fff', borderBottom: '1px solid #dde4ea', padding: '12px 28px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, background: '#1f7a52', color: '#fff', borderRadius: 8, fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700 }}>会</span>
        <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontWeight: 700, fontSize: 17 }}>会計基準システム　{doc.title}</div>
        <button type="button" onClick={backToApp} style={{ marginLeft: 'auto', padding: '7px 14px', borderRadius: 8, border: '1px solid #cfd8e0', background: '#fff', color: '#22303c', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>← システムに戻る</button>
      </header>
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '28px 28px 60px', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ background: '#fff', border: '1px solid #dde4ea', borderRadius: 12, padding: '28px 32px' }}>
          <div style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: '#fff1b8', color: '#8a6d00', marginBottom: 12 }}>叩き台（正式な文言は差し替え）</div>
          <h1 style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", fontSize: 22, margin: '0 0 12px' }}>{doc.title}</h1>
          <p style={{ fontSize: 13.5, lineHeight: 1.8, color: '#4a5865', margin: '0 0 22px' }}>{doc.lead}</p>
          {doc.sections.map((s) => (
            <section key={s.title} style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 14.5, margin: '0 0 6px', fontFamily: "'Zen Kaku Gothic New', sans-serif" }}>{s.title}</h2>
              <ol style={{ margin: 0, paddingLeft: 22, fontSize: 13, lineHeight: 1.8, color: '#4a5865' }}>
                {s.body.map((b) => <li key={b}>{b}</li>)}
              </ol>
            </section>
          ))}
          <div style={{ fontSize: 12, color: '#8290a0', marginTop: 24 }}>制定日：2026年4月1日</div>
        </div>
      </div>
    </div>
  );
}
