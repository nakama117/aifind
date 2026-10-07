import { useState } from "react";
import { useAdminAction } from "@aihot/web/features/admin/action";
import { Button, Card, Field, Input, Select } from "../../../apps/web/app/features/admin/ui.tsx";
import type { ProductAdminDetail } from "../admin/contracts.ts";
import { Choice, ReasonField } from "./admin-common.tsx";
import type { Vendor } from "../contracts.ts";
import LookupSelect from "./lookup-select.tsx";

export default function IdentityEditor({ detail }: { detail: ProductAdminDetail }) {
  const [name, setName] = useState(detail.identity.canonicalName), [slug, setSlug] = useState(detail.identity.slug);
  const [vendorId, setVendorId] = useState(detail.identity.vendorId ?? ""), [reason, setReason] = useState("");
  const [alias, setAlias] = useState(""), [aliasType, setAliasType] = useState("common"), [locale, setLocale] = useState("ja");
  const { run, busy } = useAdminAction(); const base = `/api/admin/aifind/products/${detail.identity.id}`;
  return <Card title="Identity · 製品の識別情報">
    <div className="text-sm"><p className="font-semibold">{detail.identity.canonicalName} · {detail.vendor?.name ?? "Vendor 未設定"}</p>
      <p className="mt-1 break-all text-xs text-ink-3">slug: {detail.identity.slug}</p>
      <p className="mt-2 text-xs text-ink-3">aliases: {detail.aliases.map(a => `${a.alias} (${a.aliasType} / ${a.locale ?? "—"})`).join(" · ") || "なし"}</p></div>
    <details className="mt-4"><summary className="cursor-pointer text-sm font-medium text-accent">Identity を編集</summary>
      <form className="mt-3 space-y-3" onSubmit={async e => { e.preventDefault(); await run("PATCH", base + "/identity", { canonicalName: name, slug, vendorId: vendorId || null, expectedRevision: detail.identityRevision, reason }, { success: "Identity を保存しました。" }); }}>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Canonical name"><Input aria-label="Canonical name" value={name} required maxLength={200} onChange={e => setName(e.target.value)} /></Field>
          <Field label="Slug" hint="公開 URL に使用します。初回公開後の旧 slug は恒久予約され、現在の URL へ直接転送します。"><Input aria-label="Product slug" value={slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={100} onChange={e => setSlug(e.target.value)} /></Field></div>
        <LookupSelect label="Product vendor" fieldLabel="Vendor" endpoint="/api/admin/aifind/vendors" initialRows={detail.vendors}
          value={vendorId} onChange={setVendorId} describe={v => v.name} emptyLabel="未設定" />
        <ReasonField value={reason} onChange={setReason} /><Button type="submit" busy={busy} disabled={!reason.trim()}>Identity を保存</Button>
      </form>
    </details>
    <details className="mt-4"><summary className="cursor-pointer text-sm font-medium text-accent">別名を追加</summary>
      <form className="mt-3 space-y-3" onSubmit={async e => { e.preventDefault(); const result = await run("POST", base + "/aliases", { alias, aliasType, locale: locale || null, reason }, { success: "別名を追加しました。" }); if (result) setAlias(""); }}>
        <Field label="Alias"><Input aria-label="Alias" value={alias} required maxLength={200} onChange={e => setAlias(e.target.value)} /></Field>
        <div className="grid gap-3 sm:grid-cols-2"><Choice label="Alias type" value={aliasType} options={["official", "brand", "former_name", "common", "model_family"]} onChange={setAliasType} />
          <Field label="Locale"><Input aria-label="Alias locale" value={locale} maxLength={35} onChange={e => setLocale(e.target.value)} /></Field></div>
        <ReasonField value={reason} onChange={setReason} /><Button type="submit" busy={busy} disabled={!reason.trim()}>別名を追加</Button>
      </form>
    </details>
    <div className="mt-4 space-y-3"><VendorForm />{detail.vendor && <VendorForm key={detail.vendor.updatedAt} vendor={detail.vendor} />}</div>
  </Card>;
}
export function VendorForm({ vendor }: { vendor?: Vendor }) {
  const [name, setName] = useState(vendor?.name ?? ""), [slug, setSlug] = useState("");
  const [legalName, setLegalName] = useState(vendor?.legalName ?? ""), [url, setUrl] = useState(vendor?.officialUrl ?? "");
  const [country, setCountry] = useState(vendor?.countryCode ?? "unknown"), [status, setStatus] = useState(vendor?.status ?? "unknown"), [reason, setReason] = useState("");
  const { run, busy } = useAdminAction();
  return <details><summary className="cursor-pointer text-sm font-medium text-accent">{vendor ? `Vendor を編集: ${vendor.name}` : "Vendor を作成"}</summary>
    <form className="mt-3 space-y-3" onSubmit={async e => { e.preventDefault();
      await run(vendor ? "PATCH" : "POST", `/api/admin/aifind/vendors${vendor ? `/${vendor.id}` : ""}`, { name, legalName: legalName || null, officialUrl: url || null,
        countryCode: country === "unknown" ? null : country, status, reason, ...(vendor ? { expectedUpdatedAt: vendor.updatedAt } : { slug }) }, { success: "Vendor を保存しました。" });
    }}>
      <Field label="Vendor 名"><Input aria-label="Vendor name" value={name} required onChange={e => setName(e.target.value)} /></Field>
      {!vendor && <Field label="Vendor slug"><Input aria-label="Vendor slug" value={slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*" onChange={e => setSlug(e.target.value)} /></Field>}
      <Field label="法人名"><Input aria-label="Vendor legal name" value={legalName} onChange={e => setLegalName(e.target.value)} /></Field>
      <Field label="公式 URL"><Input aria-label="Vendor URL" type="url" value={url} onChange={e => setUrl(e.target.value)} /></Field>
      <div className="grid gap-3 sm:grid-cols-2"><Choice label="Vendor country" value={country} options={["unknown", "JP", "US"]} onChange={setCountry} />
        <Choice label="Vendor status" value={status} options={["unknown", "active", "inactive"]} onChange={v => setStatus(v as Vendor["status"])} /></div>
      <ReasonField value={reason} onChange={setReason} /><Button type="submit" busy={busy} disabled={!reason.trim()}>{vendor ? "Vendor を保存" : "Vendor を作成"}</Button>
    </form>
  </details>;
}
