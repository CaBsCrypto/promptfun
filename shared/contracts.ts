export interface PlatformUser { id: string; email: string | null; wallet_address?: string | null }
export interface Session { user: PlatformUser | null; csrf_token: string | null }
export interface Project {
  id: string; owner_id?: string; title: string; description: string;
  published_version_id: string | null; created_at: string; updated_at: string;
  wallet_address?: string | null;
}
export interface CapabilityManifest {
  version: 1;
  records: { collections: string[] };
  auth: boolean; files: boolean;
  connectors: ('github.repository')[];
}
export interface AppVersion {
  id: string; project_id: string; parent_version_id: string | null;
  prompt?: string; html?: string; manifest: CapabilityManifest;
  content_hash: string; changelog: string[]; created_at: string;
}
export type JobStatus = 'queued' | 'running' | 'validating' | 'completed' | 'failed' | 'uncertain' | 'cancelled' | 'no_changes';
export interface GenerationJob {
  id: string; project_id: string; base_version_id: string | null;
  status: JobStatus; usage_status: 'pending' | 'reported' | 'unknown';
  model: string; error: string | null; result_version_id: string | null;
  prompt_tokens: number | null; completion_tokens: number | null;
  cost_usd: string | null; created_at: string;
}
export interface FreeModel { id: string; name: string; context_length: number }
export interface Feedback { id: string; project_id: string; version_id: string; text: string; created_at: string }
export interface Market {
  project_id: string; address: string; mint: string; creator: string;
  net_sold: string; reserve_lamports: string; cluster: 'devnet';
}
export interface ApiErrorBody { error: { code: string; message: string } }
