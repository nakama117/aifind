import { useState } from "react";
import { Card,Button,ReasonDialog } from "../../../apps/web/app/features/admin/ui.tsx";
import { useAdminAction } from "@aihot/web/features/admin/action";
import type { ProductAdminDetail } from "../admin/contracts.ts";
import { Choice,dialogCopy } from "./admin-common.tsx";
import { At } from "./product-view.tsx";

export default function PublicSettingsEditor({detail:d}:{detail:ProductAdminDetail}) {
  const p=d.publicSettings;
  const [visibility,setVisibility]=useState(p.visibility),[open,setOpen]=useState(false);
  const {run,busy}=useAdminAction();
  return <section data-public-settings><Card title="公開設定">
    <div className="space-y-4 text-sm"><Choice label="公開状態" value={visibility} options={['private','unlisted','listed']} optionLabels={{private:'非公開',unlisted:'リンク限定公開',listed:'一般公開'}} onChange={v=>setVisibility(v as typeof visibility)}/>
      <p className="text-xs leading-5 text-ink-3">非公開：ページを表示しません。リンク限定公開：URL からのみ閲覧でき、検索エンジン・一覧・ホームには掲載しません。一般公開：一覧・ホーム・sitemap に掲載します。</p>
      <dl className="space-y-2"><div><dt className="text-xs text-ink-3">公開 URL</dt><dd className="mt-1 break-all">{p.publicUrl?<a className="text-accent underline" href={p.publicUrl} target="_blank" rel="noopener noreferrer">{p.publicUrl}</a>:'非公開'}</dd></div>
        <div><dt className="text-xs text-ink-3">Canonical URL（現在の slug）</dt><dd className="mt-1 break-all">{p.canonicalUrl}</dd></div><div><dt className="text-xs text-ink-3">初回公開日時</dt><dd className="mt-1"><At at={p.firstPublicAt}/></dd></div></dl>
      <div data-public-readiness>{p.readinessIssues.length?<div role="alert" className="rounded-control bg-hot-soft p-3 text-xs text-hot"><p className="mb-2 font-semibold">公開ページの準備が必要です：</p><ul className="space-y-1">{p.readinessIssues.map(i=><li key={i.field}>{i.field}: {i.message}</li>)}</ul></div>:<p className="text-xs text-ok">公開可能：Published の説明・JP・日本語対応・根拠と確認日時を検証済みです。</p>}</div>
      <Button disabled={visibility===p.visibility} onClick={()=>setOpen(true)}>公開設定を変更</Button>
    </div>
    <ReasonDialog open={open} title="公開状態を変更しますか？" copy={dialogCopy} confirmLabel="公開設定を確定" danger={visibility==='private'} description={visibility==='private'?'現在と旧 slug の公開 URL は 404 になります。バージョン履歴・データは保持します。':'現在の Published の準備状態を再検証します。Draft は公開されません。'} busy={busy} onClose={()=>setOpen(false)}
      onSubmit={async reason=>(await run('PATCH',`/api/admin/aifind/products/${d.identity.id}/public-settings`,{visibility,expectedRevision:d.identityRevision,reason},{success:'公開設定を更新しました。'}))!==null}/>
  </Card></section>;
}
