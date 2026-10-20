import {z} from 'zod';
import rules from '../student/rules.json' with {type:'json'};
export const maxDocumentBytes=50*1024*1024;
export const documentPrepare=z.object({action:z.literal('prepare'),kind:z.string().refine(k=>rules.documents.includes(k)),filename:z.string().min(1).max(200).refine(n=>!/[\u0000-\u001f\u007f/\\]/.test(n)),size:z.number().int().min(1).max(maxDocumentBytes),mime:z.enum(['application/pdf','image/png','image/jpeg'])}).strict().superRefine((d,ctx)=>{
 const pdf=['KK','AKTA','IJAZAH_MI','IJAZAH_TK'].includes(d.kind),extension=d.filename.split('.').pop()?.toLowerCase();
 if(pdf?(d.mime!=='application/pdf'||extension!=='pdf'):!((d.mime==='image/png'&&extension==='png')||(d.mime==='image/jpeg'&&['jpg','jpeg'].includes(extension??''))))ctx.addIssue({code:'custom',message:pdf?'Dokumen ini harus PDF.':'Dokumen ini harus PNG/JPEG; ekstensi dan tipe harus cocok.'});
});
export const documentAction=z.discriminatedUnion('action',[z.object({action:z.literal('finalize'),id:z.uuid()}).strict(),z.object({action:z.literal('delete'),id:z.uuid()}).strict(),z.object({action:z.literal('download'),id:z.uuid(),download:z.boolean()}).strict()]);
export const documentRow=z.object({id:z.uuid(),kind:z.string(),filename:z.string(),mime:z.string(),size:z.number(),state:z.string(),created_at:z.string()});
