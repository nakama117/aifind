import type { TopicPagePart } from "@aihot/web/modules";
import type { ChroniclePart } from "../types.ts";
import { ChronicleBand, ChronicleRail } from "./Chronicle.tsx";

const part: TopicPagePart = {
  name: "年表",
  shows: (data, topic) => {
    const value = data as ChroniclePart | null;
    return !!value && (topic.group === "company" ? value.milestones.length > 0 : value.months.some((m) => m.events.length > 0));
  },
  Block: ({ data, topic }) => {
    const value = data as ChroniclePart;
    return <>
      {topic.group === "company" ? <ChronicleBand milestones={value.milestones} kinds={value.kinds} /> : <ChronicleRail months={value.months} kinds={value.kinds} />}
      {value.months.some((m) => m.events.length > 0) && <p className="mt-2 px-1 text-[12px] leading-relaxed text-ink-4">公開記事から選んだ直近12か月の主な出来事を、発表・発生日順に表示しています。</p>}
      {value.archive && <div className="mt-2 rounded-tile border border-line p-3 text-[12px] leading-relaxed text-ink-3">
        <p>歴史資料は公式発表を基に後日編纂した記録です。日付は原文の表記に従います。編纂日: <time dateTime={value.archive.compiledOn}>{value.archive.compiledOn}</time>。資料の収録範囲: {value.archive.through} までの主な出来事。</p>
        <details className="mt-2">
          <summary className="cursor-pointer font-medium text-accent">歴史資料の出典を確認（{value.archive.sources}件）</summary>
          <ol className="mt-3 space-y-3">
            {value.milestones.filter((m) => m.external).map((m) => <li key={`${m.date}:${m.href}`}>
              <div><time dateTime={m.date} className="num mr-2">{m.date}</time><a href={m.href!} target="_blank" rel="noopener noreferrer" className="font-medium text-accent underline">{m.title} — {m.source}</a></div>
              {m.summary && <p className="mt-1">{m.summary}</p>}
              {m.related && <a className="mt-1 inline-block text-accent underline" href={m.related}>本サイトの関連記事</a>}
            </li>)}
          </ol>
        </details>
      </div>}
    </>;
  },
  entries: (data) => {
    const value = data as ChroniclePart;
    return value.milestones.length ? [...value.milestones].reverse().map((m) => ({ title: m.title, href: m.href }))
      : value.months.flatMap((m) => m.events.map((e) => ({ title: e.label, href: e.href })));
  },
  news: (data) => (data as ChroniclePart).highlights.map((e) => e.label),
};

export default part;
