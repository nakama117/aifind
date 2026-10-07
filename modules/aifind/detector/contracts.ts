import { z } from 'zod';
import { SOURCE_KINDS } from '../contracts.ts';
import { ReasonSchema } from '../admin/contracts.ts';

export const DETECTOR_VERSION='aifind-detector-v1';
export const DETECTOR_PROMPT_VERSION='aifind-detector-p1';
export const DetectorChangeSchema=z.strictObject({
  candidateType:z.enum(['market','language','platform','capability','plan','price','lifecycle']),
  targetKey:z.string().min(1).max(100),targetRef:z.string().min(1).max(80).nullable().optional(),
  proposedValue:z.record(z.string(),z.unknown()),evidenceQuote:z.string().min(1).max(500),
  evidenceLocator:z.strictObject({start:z.number().int().min(0),end:z.number().int().min(1)}),
});
export const DetectorOutputSchema=z.strictObject({changes:z.array(DetectorChangeSchema).max(20),
  unsupportedObservations:z.array(z.string().min(1).max(500)).max(20).default([]),notes:z.array(z.string().max(500)).max(20).default([])});
export type DetectorChange=z.infer<typeof DetectorChangeSchema>;
export type DetectorOutput=z.infer<typeof DetectorOutputSchema>;
export const MonitorSchema=z.strictObject({productId:z.string().min(1).max(80).nullable().default(null),
  url:z.url().refine(v=>/^https?:\/\//.test(v),'HTTP(S) only'),sourceKind:z.enum(SOURCE_KINDS),
  publisher:z.string().trim().min(1).max(200),identityHint:z.string().trim().max(200).nullable().default(null),
  vendorHint:z.string().trim().max(200).nullable().default(null),enabled:z.boolean().default(false),
  cadenceMinutes:z.number().int().min(60).max(43200).default(1440),allowJina:z.boolean().default(false),reason:ReasonSchema});
// Registration defaults must never reset omitted fields in a partial edit (Zod applies inner defaults).
export const MonitorEditSchema=MonitorSchema.omit({reason:true}).partial().extend({
  productId:MonitorSchema.shape.productId.unwrap().optional(),identityHint:MonitorSchema.shape.identityHint.unwrap().optional(),vendorHint:MonitorSchema.shape.vendorHint.unwrap().optional(),
  enabled:MonitorSchema.shape.enabled.unwrap().optional(),cadenceMinutes:MonitorSchema.shape.cadenceMinutes.unwrap().optional(),allowJina:MonitorSchema.shape.allowJina.unwrap().optional(),
  expectedRevision:z.number().int().min(1),reason:ReasonSchema});
export interface Monitor {
  id:string;productId:string|null;url:string;sourceKind:string;publisher:string;identityHint:string|null;vendorHint:string|null;
  enabled:boolean;cadenceMinutes:number;allowJina:boolean;revision:number;nextCheckAt:string|null;lastCheckAt:string|null;
  lastSuccessAt:string|null;lastChangedAt:string|null;lastContentHash:string|null;lastError:string|null;
  sourcePolicy:{status:'unreviewed'|'approved'|'blocked';retentionClass:'evidence_only'|'short_excerpt';excerptDays:number;
    allowAutomatedFetch:boolean;allowJina:boolean;reviewedAt:string|null;reviewedBy:string|null;reason:string|null};
}
export interface Observation {
  id:string;monitorId:string;url:string;sourceKind:string;publisher:string;productId:string|null;identityHint:string|null;vendorHint:string|null;
  monitorRevision:number;retrievedAt:string;publishedAt:string|null;httpStatus:number|null;fetchOutcome:string;contentHash:string|null;
  inputHash:string;text:string;etag:string|null;lastModified:string|null;state:string;reason:string|null;baseVersionId:string|null;
  resolution:import('../resolver/contracts.ts').ResolverResult|null;candidateIds:string[];unsupported:string[];receiptIds:string[];
  retentionClass:'evidence_only'|'short_excerpt';retentionExpiresAt:string;prunedAt:string|null;
}
