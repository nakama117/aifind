import { z } from 'zod';
import { SlugSchema, NameSchema, PublishAuditSchema, TimestampSchema } from '../contracts.ts';

export const EditorialTypeSchema = z.enum(['comparison','category','guide']);
export type EditorialType = z.infer<typeof EditorialTypeSchema>;
const text = (max: number) => z.string().trim().max(max).refine(v => !v.includes('\u0000'), 'NUL is not allowed');
const id = z.string().min(1).max(80);
export const TestRecordSchema = z.strictObject({ task: text(2000).min(1), environmentMd: text(5000).min(1), procedureMd: text(10000).min(1),
  resultMd: text(10000).min(1), limitationsMd: text(5000).min(1), testedAt: TimestampSchema, reviewer: NameSchema,
  repeatCount: z.number().int().min(1).max(10000).nullable().default(null), errorCriteria: text(2000).nullable().default(null) });
export type TestRecord = z.infer<typeof TestRecordSchema>;
const reference = { productId: id, position: z.number().int().min(1).max(10), referencePublishedVersionId: id };
const comparisonProduct = z.strictObject({ ...reference, testedPlanKey: SlugSchema.nullable().default(null), testedPriceRef: id.nullable().default(null), testRecord: TestRecordSchema.nullable().default(null) });
const categoryProduct = z.strictObject({ ...reference, fitSummaryJa: text(2000).default(''), notForSummaryJa: text(2000).default(''), selectionNote: text(2000).default('') });
export const GuideTestRecordSchema = TestRecordSchema.extend({ productId: id, referencePublishedVersionId: id, referencedPlanKey: SlugSchema.nullable() });
const guideProduct = z.strictObject({ ...reference, role: z.enum(['primary','alternative','prerequisite']),
  referencedPlanKey: SlugSchema.nullable().default(null), referencedPriceRef: id.nullable().default(null), testRecord: GuideTestRecordSchema.nullable().default(null) })
  .refine(p => !p.testRecord || (p.testRecord.productId === p.productId && p.testRecord.referencePublishedVersionId === p.referencePublishedVersionId && p.testRecord.referencedPlanKey === p.referencedPlanKey), 'Test Record binding must match its Product, reference version and Plan');
export const GuideAssetRefSchema = z.strictObject({ assetId: id, role: z.enum(['cover','step','result','reference']), position: z.number().int().min(1).max(30), captionJa: text(2000).default(''), altJa: text(500).default('') });
function distinct(rows: Array<{productId: string; position: number}>) { return new Set(rows.map(r => r.productId)).size === rows.length && new Set(rows.map(r => r.position)).size === rows.length; }
const common = { slug: SlugSchema, title: text(200), excerpt: text(2000).default(''), bodyMd: text(40000).default(''), seoTitle: text(200).default(''), seoDescription: text(500).default('') };
export const EditorialContentSchema = z.discriminatedUnion('type', [
  z.strictObject({ ...common, type: z.literal('comparison'), comparison: z.strictObject({ mode: z.enum(['official_sources','hands_on']),
    question: text(2000).default(''), purpose: text(2000).default(''), methodologyMd: text(10000).default(''), verdictMd: text(10000).default(''),
    goodForMd: text(5000).default(''), notForMd: text(5000).default(''), incomparableConditionsMd: text(5000).default(''), limitationsMd: text(5000).default(''),
    products: z.array(comparisonProduct).max(10).refine(distinct, 'distinct Products and positions required') }) }),
  z.strictObject({ ...common, type: z.literal('category'), category: z.strictObject({ question: text(2000).default(''), selectionCriteriaMd: text(10000).default(''), limitationsMd: text(5000).default(''),
    products: z.array(categoryProduct).max(10).refine(distinct, 'distinct Products and positions required') }) }),
  z.strictObject({ ...common, type: z.literal('guide'), guide: z.strictObject({ mode: z.enum(['official_sources','hands_on']), task: text(2000).default(''),
    taskResultMd: text(10000).default(''), prerequisitesMd: text(5000).default(''), materialsMd: text(10000).default(''), stepsMd: text(20000).default(''), resultMd: text(10000).default(''),
    failuresMd: text(10000).default(''), limitationsMd: text(5000).default(''), costNotesMd: text(5000).default(''), alternativesMd: text(5000).default(''),
    products: z.array(guideProduct).max(3).refine(distinct, 'distinct Products and positions required'),
    assets: z.array(GuideAssetRefSchema).max(30).refine(a => new Set(a.map(r => r.assetId)).size === a.length && new Set(a.map(r => r.position)).size === a.length, 'distinct assets and positions required').default([]) }) }),
]);
export type EditorialContent = z.infer<typeof EditorialContentSchema>;
export type GuideContent = Extract<EditorialContent, {type:'guide'}>['guide'];
const action = { expectedRevision: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER), reason: PublishAuditSchema.shape.reason };
export const EditorialCreateSchema = z.strictObject({ content: EditorialContentSchema, reason: action.reason });
export const EditorialActionSchema = z.strictObject(action);
export const EditorialSaveSchema = z.strictObject({ ...action, content: EditorialContentSchema });
export const EditorialRestoreSchema = z.strictObject({ ...action, sourceRevisionId: id });
export interface EditorialRevision { id: string; revisionNo: number; content: EditorialContent; editor: string; reason: string; createdAt: string; publishedAt: string | null }
export interface EditorialAdminDetail {
  id: string; type: EditorialType; state: 'draft' | 'published' | 'withdrawn'; revision: number; publicSlug: string | null;
  createdAt: string; firstPublishedAt: string | null; draft: EditorialRevision | null; published: EditorialRevision | null; history: EditorialRevision[];
  slugHistory: Array<{slug:string;claimedAt:string}>;
}
export interface EditorialProductChoice { productId: string; name: string; slug: string; visibility: string; versions: Array<{ id: string; versionNo: number; publishedAt: string }> }
export const productRefs = (c: EditorialContent) => c.type === 'comparison' ? c.comparison.products : c.type === 'category' ? c.category.products : c.guide.products;
export class EditorialPublicationError extends Error {
  statusCode = 422;
  issues: string[];
  constructor(issues: string[]) { super(issues.join('; ')); this.issues = issues; }
}
