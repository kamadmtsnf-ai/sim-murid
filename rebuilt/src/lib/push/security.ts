import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, ECDH } from "node:crypto";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { z } from "zod";
export const categories = ['points', 'schedule', 'reports', 'surveys', 'follow_up', 'documents'] as const;
export const digest = (text: string) => createHash('sha256').update(text).digest('hex');
const b64 = (size: number) => z.string().regex(/^[A-Za-z0-9_-]+$/).refine(v => Buffer.from(v, 'base64url').length === size && Buffer.from(v, 'base64url').toString('base64url') === v);
export const subscriptionSchema = z.object({
    label: z.string().trim().max(80).regex(/^[^\u0000-\u001f\u007f]*$/).default(''),
    subscription: z.object({ endpoint: z.url().max(4096), expirationTime: z.number().int().positive().max(8640000000000000).nullable().default(null), keys: z.object({ p256dh: b64(65).refine(v => { try {
                ECDH.convertKey(Buffer.from(v, 'base64url'), 'prime256v1');
                return true;
            }
            catch {
                return false;
            } }), auth: b64(16) }).strict() }).strict(),
}).strict();
export const preferencesSchema = z.object({ revision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), categories: z.array(z.enum(categories)).max(6).refine(v => new Set(v).size === v.length), quiet_start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), quiet_end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), timezone: z.string().max(80).refine(v => { try {
        new Intl.DateTimeFormat('en', { timeZone: v });
        return true;
    }
    catch {
        return false;
    } }) }).strict();
export const testSchema = z.object({ subscription_id: z.uuid(), request_id: z.uuid() }).strict();
export const credentialSchema = z.object({ installation: z.uuid(), secret: b64(32), owner: z.uuid(), previousHashes: z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(8).optional() }).strict();
export type Credential = z.infer<typeof credentialSchema>;
export function bindingHash(c: Credential, owner = c.owner) { return createHmac('sha256', Buffer.from(c.secret, 'base64url')).update('sim-push-binding-v1:' + c.installation + ':' + owner).digest('hex'); }
export function encrypt(value: string, key: Buffer, aad: string) { const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv); cipher.setAAD(Buffer.from(aad)); const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]); return { iv: iv.toString('base64url'), ciphertext: ciphertext.toString('base64url'), tag: cipher.getAuthTag().toString('base64url') }; }
export function decrypt(value: ReturnType<typeof encrypt>, key: Buffer, aad: string) { const cipher = createDecipheriv('aes-256-gcm', key, Buffer.from(value.iv, 'base64url')); cipher.setAAD(Buffer.from(aad)); cipher.setAuthTag(Buffer.from(value.tag, 'base64url')); return Buffer.concat([cipher.update(Buffer.from(value.ciphertext, 'base64url')), cipher.final()]).toString('utf8'); }
// Only known browser push services; no suffix/substring matching for Google/Apple.
const hostAllowed = (host: string) => ['fcm.googleapis.com', 'web.push.apple.com', 'updates.push.services.mozilla.com'].includes(host) || /^[a-z0-9-]+\.notify\.windows\.com$/.test(host);
// Public IPv4, or global-unicast IPv6 only. Mapped/transition/documentation ranges fail closed.
export function publicAddress(address: string) {
    if (!isIP(address))
        return false;
    if (address.includes(':')) {
        const [first, second] = address.toLowerCase().split(':');
        if (first === '2001' && parseInt(second || '0', 16) < 0x200) return false;
        return /^2[0-9a-f]{3}:/i.test(address) && !/^2002:/i.test(address) && !/^2001:db8:/i.test(address);
    }
    const oct = address.split('.').map(Number);
    if (oct.length !== 4 || oct.some(n => !Number.isInteger(n) || n < 0 || n > 255))
        return false;
    const a = oct[0]!, b = oct[1]!;
    return a > 0 && a < 224 && a !== 10 && a !== 127 && !(a === 100 && b >= 64 && b <= 127) && !(a === 169 && b === 254) && !(a === 172 && b >= 16 && b <= 31) && !(a === 192 && (b === 168 || b === 0 || b === 2)) && !(a === 198 && (b === 18 || b === 19 || b === 51)) && !(a === 203 && b === 0);
}
export function endpointURL(endpoint:string){const u=new URL(endpoint);if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||!hostAllowed(u.hostname))throw Error('Invalid push endpoint');return u;}
export async function validateEndpoint(endpoint: string, resolver: typeof lookup = lookup) {
    const u = endpointURL(endpoint);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        const answers = await Promise.race([resolver(u.hostname, { all: true, verbatim: true }), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error('DNS timeout')), 2000); })]);
        if (!answers.length || answers.length > 32 || answers.some(a => !publicAddress(a.address)))
            throw Error('Invalid push address');
        return { endpoint: u.href, hostname: u.hostname, addresses: answers };
    }
    finally {
        clearTimeout(timer);
    }
    // No endpoint HTTP request here. WP-05 must re-resolve/pin public IPs and refuse redirects.
}
