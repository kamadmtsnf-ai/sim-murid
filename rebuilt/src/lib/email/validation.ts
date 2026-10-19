import {z} from 'zod';
import {loginSchema} from '../auth/validation.ts';
export const emailCommand=z.discriminatedUnion('action',[
 z.object({action:z.literal('send')}).strict(),
 z.object({action:z.literal('verify'),challengeId:z.uuid(),code:z.string().regex(/^\d{6}$/)}).strict(),
]);
export const emailStateSchema=z.object({email:z.string(),verified:z.boolean(),sent_today:z.number().int(),challenge:z.object({id:z.uuid(),expires_at:z.string(),retry_at:z.string(),status:z.string(),delivery_state:z.string(),attempts_remaining:z.number().int()}).nullable()});
export const recoveryEmailRequest=z.object({action:z.literal('send'),username:loginSchema.shape.username}).strict();
export const recoveryEmailReset=z.object({action:z.literal('reset'),username:loginSchema.shape.username,challengeId:z.uuid(),code:z.string().regex(/^\d{6}$/),newPassword:z.string().max(72),confirmPassword:z.string().max(1024)}).strict();
