import type { PublicProduct } from '../public-contracts.ts';
import type { TestRecord } from './contracts.ts';

export interface EditorialProductReference {
  facts: PublicProduct; referenceVersionNo: number; referencePublishedAt: string; versionChanged: boolean;
}
interface PublicEditorialBase {
  slug: string; title: string; excerpt: string; bodyMd: string; seoTitle: string; seoDescription: string;
  canonicalUrl: string; revisionNo: number; publishedAt: string;
  rendered: Record<string,string>;
}
export interface PublicComparison extends PublicEditorialBase {
  type: 'comparison'; needsRetest: boolean;
  comparison: { mode: 'official_sources'|'hands_on'; question: string; purpose: string; methodologyMd: string; verdictMd: string;
    goodForMd: string; notForMd: string; incomparableConditionsMd: string; limitationsMd: string };
  products: Array<EditorialProductReference & { testedPlanKey: string | null; hasTestedPriceReference: boolean; testRecord: TestRecord | null }>;
}
export interface PublicCategory extends PublicEditorialBase {
  type: 'category'; productInfoUpdated: boolean;
  category: { question: string; selectionCriteriaMd: string; limitationsMd: string };
  products: Array<EditorialProductReference & { fitSummaryJa: string; notForSummaryJa: string; selectionNote: string }>;
}
export interface PublicGuide extends PublicEditorialBase {
  type:'guide'; needsRetest:boolean;
  guide:{mode:'official_sources'|'hands_on';task:string;taskResultMd:string;prerequisitesMd:string;materialsMd:string;stepsMd:string;resultMd:string;failuresMd:string;limitationsMd:string;costNotesMd:string;alternativesMd:string};
  products:Array<EditorialProductReference & {role:'primary'|'alternative'|'prerequisite';referenceFacts:PublicProduct;referencedPlanKey:string|null;hasReferencedPrice:boolean;testRecord:TestRecord|null}>;
  assets:Array<{assetId:string;role:'cover'|'step'|'result'|'reference';position:number;captionJa:string;altJa:string;url:string;width:number;height:number}>;
  related?:PublicEditorialRelated;
}
export type PublicEditorial = PublicComparison | PublicCategory | PublicGuide;
export interface PublicEditorialSummary {
  type: 'comparison'|'category'|'guide'; slug: string; title: string; excerpt: string; canonicalUrl: string; publishedAt: string;
  products: Array<{ slug: string; displayName: string }>; mode: 'official_sources'|'hands_on'|null; needsRetest: boolean;
  referenceDates: string[]; testedDates: string[];
}
export interface PublicEditorialRelated { comparisons: PublicEditorialSummary[]; categories: PublicEditorialSummary[]; guides?:PublicEditorialSummary[] }
export type PublicEditorialResolution = {kind:'found'; document:PublicEditorial} | {kind:'redirect';slug:string} | {kind:'not_found'};
