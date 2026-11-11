import "server-only";
import { categories } from "./security";
import { createECDH } from "node:crypto";
import { z } from "zod";

const keyVersion = z.string().regex(/^[A-Za-z0-9_-]{1,80}$/);
const previousKey = z.object({
    encryptionVersion: keyVersion,
    vapidVersion: keyVersion,
    key: z.string(),
    publicKey: z.string(),
    privateKey: z.string(),
    expiresAt: z.iso.datetime({ offset: true }),
}).strict();

function previousKeys(raw: string | undefined, current: Omit<z.infer<typeof previousKey>, 'expiresAt'>) {
    if (!raw) return [];
    if (Buffer.byteLength(raw) > 4096) throw Error('Invalid key transition');
    const entries = z.array(previousKey).max(2).parse(JSON.parse(raw));
    const encryption = new Map([[current.encryptionVersion, current.key]]);
    const vapid = new Map([[current.vapidVersion, current.publicKey]]);
    const generations = new Set([current.encryptionVersion + ':' + current.vapidVersion]);

    return entries.map(entry => {
        const id = entry.encryptionVersion + ':' + entry.vapidVersion;
        const knownEncryption = encryption.get(entry.encryptionVersion);
        const knownVapid = vapid.get(entry.vapidVersion);
        if (generations.has(id) || (knownEncryption && knownEncryption !== entry.key) || (knownVapid && knownVapid !== entry.publicKey))
            throw Error('Conflicting key versions');

        const key = Buffer.from(entry.key, 'base64');
        const privateKey = Buffer.from(entry.privateKey, 'base64url');
        const publicKey = Buffer.from(entry.publicKey, 'base64url');
        if (key.length !== 32 || key.toString('base64') !== entry.key ||
            privateKey.length !== 32 || privateKey.toString('base64url') !== entry.privateKey ||
            publicKey.length !== 65 || publicKey.toString('base64url') !== entry.publicKey)
            throw Error('Invalid transition key');

        const curve = createECDH('prime256v1');
        curve.setPrivateKey(privateKey);
        if (!curve.getPublicKey().equals(publicKey)) throw Error('Invalid VAPID pair');
        generations.add(id);
        encryption.set(entry.encryptionVersion, entry.key);
        vapid.set(entry.vapidVersion, entry.publicKey);
        return { ...entry, key };
    });
}
export function pushConfiguration(requestUrl: string, env: NodeJS.ProcessEnv = process.env) {
    try {
        const origin = new URL(env.WEB_PUSH_APP_ORIGIN ?? '');
        if (origin.origin !== env.WEB_PUSH_APP_ORIGIN || origin.origin !== new URL(requestUrl).origin || origin.protocol !== 'https:')
            return null;
        const mode = env.WEB_PUSH_ENVIRONMENT, deploy = env.VERCEL_ENV;
        if (deploy && !['production', 'preview', 'development'].includes(deploy))
            return null;
        if (!['production', 'staging', 'development'].includes(mode ?? '') || (deploy === 'production' && mode !== 'production') || (deploy === 'preview' && mode !== 'staging') || (deploy === 'development' && mode !== 'development') || (!deploy && mode !== 'development'))
            return null;
        const db = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? '');
        if (!/^[a-z0-9]+\.supabase\.co$/.test(db.hostname) || db.protocol !== 'https:')
            return null;
        if (mode === 'staging' && (!env.WEB_PUSH_STAGING_SUPABASE_REF || db.hostname !== env.WEB_PUSH_STAGING_SUPABASE_REF + '.supabase.co' || env.WEB_PUSH_STAGING_SUPABASE_REF === 'qpzoukkhdxpmbtkcqemj'))
            return null;
        const key = Buffer.from(env.WEB_PUSH_ENCRYPTION_KEY ?? '', 'base64');
        if (key.length !== 32 || key.toString('base64') !== env.WEB_PUSH_ENCRYPTION_KEY)
            return null;
        const publicKey = Buffer.from(env.WEB_PUSH_VAPID_PUBLIC_KEY ?? '', 'base64url');
        if (publicKey.length !== 65 || publicKey.toString('base64url') !== env.WEB_PUSH_VAPID_PUBLIC_KEY)
            return null;
        const privateKey = Buffer.from(env.WEB_PUSH_VAPID_PRIVATE_KEY ?? '', 'base64url');
        if (privateKey.length !== 32 || privateKey.toString('base64url') !== env.WEB_PUSH_VAPID_PRIVATE_KEY)
            return null;
        const ecdh = createECDH('prime256v1');
        ecdh.setPrivateKey(privateKey);
        if (!ecdh.getPublicKey().equals(publicKey))
            return null;
        const version = /^[A-Za-z0-9_-]{1,80}$/;
        if (!version.test(env.WEB_PUSH_ENCRYPTION_KEY_VERSION ?? '') || !version.test(env.WEB_PUSH_VAPID_KEY_VERSION ?? '') || !/^mailto:[^\s@]+@[^\s@]+$/.test(env.WEB_PUSH_VAPID_SUBJECT ?? ''))
            return null;
        const flags = ['WEB_PUSH_ENABLED', 'WEB_PUSH_DISPATCH_ENABLED', 'WEB_PUSH_TEST_ENABLED', ...categories.map(c => 'WEB_PUSH_CATEGORY_' + c.toUpperCase() + '_ENABLED')];
        if (flags.some(k => !['true', 'false'].includes(env[k] ?? '')))
            return null;
        const previous = previousKeys(env.WEB_PUSH_PREVIOUS_KEYS, {
            encryptionVersion: env.WEB_PUSH_ENCRYPTION_KEY_VERSION!,
            vapidVersion: env.WEB_PUSH_VAPID_KEY_VERSION!,
            key: key.toString('base64'),
            publicKey: publicKey.toString('base64url'),
            privateKey: privateKey.toString('base64url'),
        });
        return { previousKeys:previous, enabled: env.WEB_PUSH_ENABLED === 'true', test: env.WEB_PUSH_TEST_ENABLED === 'true', publicKey: publicKey.toString('base64url'), key, encryptionVersion: env.WEB_PUSH_ENCRYPTION_KEY_VERSION!, vapidVersion: env.WEB_PUSH_VAPID_KEY_VERSION!, categories: categories.filter(c => c !== 'follow_up' && env['WEB_PUSH_CATEGORY_' + c.toUpperCase() + '_ENABLED'] === 'true') };
    }
    catch {
        return null;
    }
}
