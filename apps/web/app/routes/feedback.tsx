import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { SITE } from "@aihot/site";
import { Presence } from "../components/ui/Presence";
import { edgeTtl } from "../lib/api.server";
import { pageMeta } from "../lib/seo";
import { KEYS, lastPage, readJson, writeRaw } from "../lib/local-state";
import { IconCheck, IconClose, IconImage } from "../components/icons";
import { RingMark } from "@aihot/site/brand/Logo.tsx";
import { AsideCard, ReadingLayout } from "../components/ui/Page";
import { PhoneBar } from "../components/shell/PhoneBar";
import type { Screen } from "../components/shell/screens";
import { webModules } from "../site-modules";

export const handle: Screen = { tab: "me", name: "フィードバック" };

export function headers() {
  return edgeTtl(300);
}

export function meta() {
  return pageMeta({ title: "フィードバック", description: `${SITE.name}へのご意見をお寄せください。改善してほしい点や、内容・機能・連携に関するご要望、情報源の訂正・掲載停止のご依頼などをお聞かせください。`, path: "/feedback", image: "/og/pages/feedback.png", noindex: true });
}

interface Draft {
  content: string;
  email: string;
  pageUrl: string;
}

function parseDraft(value: unknown): Draft | null {
  if (!value || typeof value !== "object") return null;
  const d = value as Record<string, unknown>;
  return { content: String(d.content ?? ""), email: String(d.email ?? ""), pageUrl: String(d.pageUrl ?? "") };
}

/** Drafts the site's modules keep elsewhere in this browser. */
const otherDrafts = () => webModules().flatMap((m) => (m.feedbackDraft ? [m.feedbackDraft] : []));

function readDraft(): Draft | null {
  let draft = parseDraft(readJson(KEYS.feedbackDraft));
  for (const other of otherDrafts()) draft ??= parseDraft(other.read());
  return draft;
}

/** Saves the draft in this browser, or clears it (null); false when the browser refused. */
function writeDraft(d: Draft | null): boolean {
  const saved = writeRaw(KEYS.feedbackDraft, d && JSON.stringify({ ...d, savedAt: new Date().toISOString() }));
  // Another draft is kept until this one is saved; a submitted draft clears them all.
  if (saved || d === null) for (const other of otherDrafts()) other.clear();
  return saved;
}

const TIPS = ["問題が起きたページまたは記事のリンク", "何が起きたか、何をしようとしていたか", "スクリーンショットがあると助かります。機密情報は事前に隠してください"];

function FeedbackAside() {
  return (
    <>
      <AsideCard title="以下の点を明記いただくと、対応がスムーズです">
        <ol className="space-y-2.5">
          {TIPS.map((t, i) => (
            <li key={t} className="flex gap-2.5 text-[13px] leading-[1.6] text-ink-3">
              <span className="mono mt-px text-[11px] font-bold text-accent">{String(i + 1).padStart(2, "0")}</span>
              {t}
            </li>
          ))}
        </ol>
      </AsideCard>
      <AsideCard title="情報提供元の方へ">
        <p className="text-[13px] leading-[1.75] text-ink-3">情報提供元の方で、訂正・掲載停止・表示方法の変更をご希望の場合は、該当する記事のリンクとご要望をお知らせください。</p>
      </AsideCard>
    </>
  );
}

/**
 * Some phones report a JPEG as image/jpg, or give no type at all: the file name decides then. The
 * server checks the picture's real bytes either way.
 */
function screenshotType(file: File): string {
  const type = file.type.trim().toLowerCase();
  if (type === "image/jpg") return "image/jpeg";
  if (type && type !== "application/octet-stream") return type;
  if (/\.png$/i.test(file.name)) return "image/png";
  if (/\.jpe?g$/i.test(file.name)) return "image/jpeg";
  if (/\.webp$/i.test(file.name)) return "image/webp";
  return type;
}

const MAX_IMAGE = 5 * 1024 * 1024;
const MAX_TEXT = 2000;

export default function FeedbackPage() {
  const [params] = useSearchParams();
  const [draft, setDraft] = useState<Draft>({ content: "", email: "", pageUrl: params.get("from") ?? "" });
  const [shot, setShot] = useState<{ file: File; url: string } | null>(null);
  const [state, setState] = useState<{ kind: "idle" | "sending" | "done" | "error"; message?: string; id?: number }>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = readDraft();
    // The page the reader was on before coming here (tracked across in-site navigation, "更多" skipped);
    // a document the browser opened fresh falls back to its referrer.
    const before = params.get("from") ? null : (lastPage() ?? (document.referrer.startsWith(location.origin) ? document.referrer : null));
    const from = before ? new URL(before, location.origin).href : null;
    if (saved) setDraft((d) => ({ ...saved, pageUrl: d.pageUrl || from || saved.pageUrl }));
    else if (from) setDraft((d) => ({ ...d, pageUrl: from }));
  }, []);
  useEffect(() => {
    const t = setTimeout(() => writeDraft(draft.content || draft.email ? draft : null), 400);
    return () => clearTimeout(t);
  }, [draft]);

  useEffect(() => {
    if (!shot) return;
    return () => URL.revokeObjectURL(shot.url);
  }, [shot]);

  const pick = (picked: File | null | undefined) => {
    if (!picked) return;
    const type = screenshotType(picked);
    if (!/^image\/(png|jpeg|webp)$/.test(type)) return setState({ kind: "error", message: "スクリーンショットは PNG、JPEG、WebP 形式に対応しています。" });
    const file = type === picked.type ? picked : new File([picked], picked.name, { type });
    if (file.size > MAX_IMAGE) return setState({ kind: "error", message: "スクリーンショットの元画像は 5 MB 以下にしてください。" });
    setShot({ file, url: URL.createObjectURL(file) });
    setState({ kind: "idle" });
  };

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));
      if (file) pick(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (draft.content.trim().length < 2) return setState({ kind: "error", message: "フィードバック内容を入力してください。" });
    setState({ kind: "sending" });
    try {
      const form = new FormData();
      form.set("content", draft.content);
      form.set("email", draft.email);
      form.set("pageUrl", draft.pageUrl);
      if (shot) form.set("screenshot", shot.file);
      const res = await fetch("/api/site/feedback", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return setState({ kind: "error", message: body.detail ?? "送信に失敗しました。しばらくしてからもう一度お試しください。" });
      writeDraft(null);
      setState({ kind: "done", id: body.id });
      setDraft({ content: "", email: "", pageUrl: "" });
      setShot(null);
    } catch {
      setState({ kind: "error", message: "ネットワークの状態が不安定です。下書きは端末に保存されました。後ほど再送信してください。" });
    }
  };

  if (state.kind === "done") {
    return (
      <ReadingLayout>
        <div className="card px-6 py-14 text-center">
          <div className="anim-pop-in mx-auto flex size-14 items-center justify-center rounded-full bg-accent text-accent-contrast">
            <IconCheck size={26} />
          </div>
          <h1 className="mt-6 text-[22px] font-semibold text-ink">受け付けました。ありがとうございます</h1>
          <p className="mt-2 text-[14px] text-ink-3">
            フィードバック番号 <span className="mono font-semibold text-ink">#{state.id}</span>。返信が必要な場合は、この番号を引用してご連絡します。
          </p>
          <Link to="/" className="mt-8 inline-flex h-10 items-center rounded-full bg-ink px-6 text-[14px] font-medium text-bg transition-opacity hover:opacity-90">
            厳選記事に戻る
          </Link>
        </div>
      </ReadingLayout>
    );
  }

  const field = "w-full rounded-card bg-bg-sunk text-ink outline-none ring-1 ring-inset ring-line-soft transition-[background-color,box-shadow] placeholder:text-ink-4 hover:ring-line-strong focus:bg-surface focus:shadow-[0_0_0_3px_var(--accent-soft)] focus:ring-accent dark:bg-bg-muted/60 dark:focus:bg-surface";
  const label = "mb-2 block text-[13px] font-semibold text-ink";
  const canSend = draft.content.trim().length >= 2 && state.kind !== "sending";
  return (
    <>
    <PhoneBar back={{ to: "/more", label: "マイページ" }} title="フィードバック" />
    <ReadingLayout aside={<FeedbackAside />}>
      <header>
        <h1 data-page-title="" className="text-[24px] font-semibold leading-[1.3] text-ink">ご意見をお聞かせください</h1>
        <p className="mt-2 text-[14.5px] leading-relaxed text-ink-3">バグや欲しい機能、気になる点など、何でもお知らせください。すべて確認します。</p>
      </header>

      <form
        onSubmit={submit}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files[0]);
        }}
        className={`card mt-6 overflow-hidden transition-shadow ${dragging ? "shadow-[0_0_0_3px_var(--accent-soft)] ring-1 ring-accent" : ""}`}
      >
        <div className="space-y-5 p-5 sm:p-6">
          <div>
            <label htmlFor="fb-content" className={label}>
              ご意見をお聞かせください
            </label>
            <div className="relative">
              <textarea
                id="fb-content"
                required
                rows={9}
                maxLength={MAX_TEXT}
                value={draft.content}
                onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                placeholder={SITE.feedbackExample}
                className={`${field} block resize-y px-4 pb-8 pt-3.5 text-[14.5px] leading-relaxed`}
              />
              <span className="mono pointer-events-none absolute bottom-3 right-4 text-[11px] text-ink-4">
                {draft.content.length} / {MAX_TEXT}
              </span>
            </div>
          </div>

          <div>
            <label htmlFor="fb-email" className={label}>
              メールアドレス <span className="font-normal text-ink-4">（任意）</span>
            </label>
            <input id="fb-email" type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="メールアドレスを入力すると、返信でご連絡できます" className={`${field} h-11 px-4 text-[14.5px]`} />
          </div>

          <div>
            <span className={label}>
              スクリーンショット <span className="font-normal text-ink-4">（任意）</span>
            </span>
            {shot ? (
              <div className="flex items-center gap-4 well rounded-card p-3">
                <img src={shot.url} alt="スクリーンショットのプレビュー" className="h-16 w-24 shrink-0 rounded-control border border-line bg-surface object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-ink-2">{shot.file.name}</div>
                  <div className="mono mt-0.5 text-[11.5px] text-ink-4">{(shot.file.size / 1024 / 1024).toFixed(2)} MB</div>
                </div>
                <button type="button" aria-label="スクリーンショットを削除" onClick={() => setShot(null)} className="grid size-8 shrink-0 place-items-center rounded-full text-ink-4 transition-colors hover:bg-surface hover:text-ink">
                  <IconClose size={15} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className={`group flex w-full items-center gap-3.5 rounded-card border border-dashed px-4 py-3.5 text-left transition-colors ${dragging ? "border-accent bg-accent-softer" : "border-line-strong hover:border-ink-4 hover:bg-bg-sunk/60"}`}
              >
                <span className="grid size-10 shrink-0 place-items-center well rounded-tile text-ink-3 transition-colors group-hover:text-accent">
                  <IconImage size={19} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold text-ink-2">問題のスクリーンショットを追加</span>
                  <span className="mt-0.5 block text-[12px] leading-relaxed text-ink-4">ここに貼り付けるか、ドラッグしてください · 事前に機密情報を隠してください。PNG、JPEG、WebPに対応。元画像は5 MB以下</span>
                </span>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
          </div>

          <Presence show={state.kind === "error"} enter="anim-notice-in" exit="anim-fade-out" duration={160}>
            <p role="alert" className="rounded-tile bg-hot-soft px-3.5 py-2.5 text-[13px] text-hot">
              {state.kind === "error" ? state.message : ""}
            </p>
          </Presence>
        </div>

        <div className="flex flex-col-reverse gap-4 border-t border-line-soft bg-bg-sunk/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:bg-bg-muted/30">
          <p className="text-[12px] leading-relaxed text-ink-4 sm:max-w-[400px]">
            秘密鍵、身分証明書、問題に関係のない機密情報は送信しないでください。送信すると、フィードバックの内容、任意のメールアドレス、ページ情報、スクリーンショットが以下に従って
            <Link viewTransition to="/privacy" className="text-accent hover:underline">
              プライバシーについて
            </Link>
            処理されることに同意したものとします。
          </p>
          <button
            type="submit"
            disabled={!canSend}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 self-start rounded-full bg-accent px-6 text-[14px] font-medium text-accent-contrast transition-[background-color,opacity] hover:bg-accent-ink disabled:bg-line-strong disabled:text-ink-4 sm:self-auto"
          >
            {state.kind === "sending" && <RingMark className="size-4" spinning />}
            フィードバックを送信
          </button>
        </div>
      </form>
    </ReadingLayout>
    </>
  );
}
