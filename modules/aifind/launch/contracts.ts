import {z} from 'zod';
import {CatalogPackSchema} from '../catalog-pack/contracts.ts';
import {EditorialContentSchema} from '../editorial/contracts.ts';
import {HttpUrlSchema,SlugSchema,TimestampSchema,SOURCE_KINDS} from '../contracts.ts';
export const SourceDossierSchema=z.strictObject({productSlug:SlugSchema,japanesePage:HttpUrlSchema.nullable(),lastVerified:TimestampSchema,
  reviewStatus:z.enum(['machine_validated','owner_review_required']),unknownFields:z.array(z.string().max(200)),openQuestions:z.array(z.string().max(2000)),
  unresolvedContradictions:z.array(z.string().max(200)).default([]),
  factReview:z.strictObject({checkedAt:TimestampSchema,freePlanState:z.enum(['free','trial','paid','custom','unknown']),
    freePlanFingerprint:z.string().regex(/^[a-f0-9]{64}$/),freePlanSourceUrl:HttpUrlSchema,
    unknown:z.array(z.strictObject({field:z.string().min(1).max(200),checkedSources:z.array(HttpUrlSchema).min(2),checkedAt:TimestampSchema,
      reasonStillUnknown:z.string().trim().min(30).max(2000)}))}).optional(),
  sources:z.array(z.strictObject({role:z.enum(['product','pricing','docs','japanese']),sourceKind:z.enum(SOURCE_KINDS),url:HttpUrlSchema,title:z.string().max(500),retrievedAt:TimestampSchema,
    access:z.enum(['accessible','limited','unavailable']),quote:z.string().max(500),excerptHash:z.string().regex(/^[a-f0-9]{64}$/).nullable(),hashScope:z.literal('minimal_review_excerpt'),note:z.string().max(2000),
    reviewedFacts:z.array(z.strictObject({field:z.string().min(1).max(200),values:z.record(z.string().min(1).max(80),z.union([z.string().max(500),z.number(),z.null()])),supportingSources:z.array(HttpUrlSchema).default([])})).default([])})).min(3)});
export const LaunchCorpusSchema=z.strictObject({schemaVersion:z.literal(1),researchedAt:TimestampSchema,pack:CatalogPackSchema,
  dossiers:z.array(SourceDossierSchema),editorial:z.array(EditorialContentSchema),referenceMode:z.literal('slug_bind_after_explicit_staging_publish')});
export type LaunchCorpus=z.infer<typeof LaunchCorpusSchema>;
