import {z} from 'zod';
const stamp=z.iso.datetime({offset:true}).nullable(),count=z.number().int().nonnegative().safe();
export const alarmCodes=['scheduler_stale','worker_stale','scheduler_error','backlog','lease_expired','ambiguous','keys','invalid_endpoints','worker_error'] as const;
export const operationsSnapshot=z.object({
 checked_at:z.iso.datetime({offset:true}),alarms:z.array(z.enum(alarmCodes)).max(9),
 scheduler:z.object({enabled:z.boolean(),observed_recently:z.boolean(),last_tick:stamp,last_dispatched:stamp,last_response:stamp,http_status:z.number().int().min(100).max(599).nullable(),error:z.enum(['secret_missing','url_invalid','http_timeout','http_error','http_missing','queue_error']).nullable()}).strict(),
 worker:z.object({last_started:stamp,last_finished:stamp,runs_24h:count,errors_1h:count}).strict(),
 queue:z.object({ready:count,oldest_ready:stamp,accepted_samples_24h:count,p95_accepted_seconds:z.number().finite().nonnegative().nullable(),invalid_endpoints_1h:count}).strict(),
 retention:z.object({enabled:z.boolean(),delivery_days:z.number().int().min(30).max(730),subscription_days:z.number().int().min(30).max(730),run_days:z.number().int().min(7).max(180),batch:z.number().int().min(1).max(500),last_cleanup:stamp,last_counts:z.object({deliveries:count.optional(),subscriptions:count.optional(),runs:count.optional()}).strict()}).strict(),
}).strict().superRefine((v,c)=>{if((v.queue.accepted_samples_24h===0)!==(v.queue.p95_accepted_seconds===null))c.addIssue({code:'custom',message:'Missing latency samples'});if(v.scheduler.observed_recently&&(!v.scheduler.enabled||!v.scheduler.last_tick))c.addIssue({code:'custom',message:'Missing tick observation'});});
export type PushOperations=z.infer<typeof operationsSnapshot>;
export const alarmLabels:Record<typeof alarmCodes[number],string>={scheduler_stale:'Pemicu terjadwal berhenti atau belum teramati',worker_stale:'Worker belum menyelesaikan pemeriksaan dalam 5 menit',scheduler_error:'Pemicu gagal menghubungi worker',backlog:'Antrean siap tertua melewati 5 menit',lease_expired:'Lease pengiriman kedaluwarsa',ambiguous:'Hasil pengiriman belum pasti; jangan ulang otomatis',keys:'Periksa kunci dan izin penyedia',invalid_endpoints:'Sedikitnya 5 endpoint tidak valid dalam satu jam',worker_error:'Worker terhenti atau hasilnya belum tercatat'};
