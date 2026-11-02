export type ReviewStatus = 'pending' | 'accepted' | 'rejected';
export interface Source {
  id: string; key?: string; title: string; shortTitle?: string; authors: string; year: number; region: string;
  doi: string; url: string; pmcid?: string; licence: string; licenceUrl?: string; evidenceType: string; text: string;
  format: 'text' | 'table'; attribution?: string; locator?: string; adaptation?: string; contentHash: string;
  xmlSha256?: string; rowCount?: number; truncated?: boolean; createdAt?: string;
}
export interface TaxonomyResult {
  query: string; retrievedAt: string; mode?: 'live'|'reference-snapshot'; providerUrl?: string; usageKey?: number; acceptedUsageKey?: number; scientificName?: string;
  canonicalName?: string; acceptedScientificName?: string; status?: string; rank?: string; matchType?: string;
  confidence?: number; kingdom?: string; family?: string; alternatives?: {scientificName:string;usageKey:number}[];
}
export interface Claim {
  id: string; sourceId: string; plantName: string; candidates: string[]; nameKind: string; category: string;
  reportedUse: string; sourceUse: string; plantPart: string; preparation: string; route: string; quote: string;
  start: number; end: number; plantStart: number; plantEnd: number; useStart: number; useEnd: number;
  flags: string[]; polarity: string; evidenceType: string; engineVersion: string; offsetEncoding: string;
  status: ReviewStatus; reviewerNote: string; revision: number; updatedAt: string;
  review?: {resolvedName?: string;reportedUse?: string;plantPart?: string;preparation?: string;taxonomy?:TaxonomyResult;identityBasis?:string};
}
export interface AuditEvent {id:string;action:string;claimId?:string;sourceId?:string;detail:string;createdAt:string}
export interface Workspace {sources:Source[];claims:Claim[];audit:AuditEvent[];createdAt:string;engineVersion:string;workspaceId:string;preview?:boolean}

export interface PaperSummary {id:string;pmcid?:string;title:string;authors:string;year:string|number;doi:string;licence:string;url:string;isOpenAccess?:string;abstract?:string}
export interface LiteratureResult {hitCount:number;results:PaperSummary[];retrievedAt:string;mode:string;scopeWarning?:string}
export interface SourceImportResult {workspace:Workspace;sourceId:string;count:number}
