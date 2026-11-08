import "server-only";
import { categories } from "./security";
import { createECDH } from "node:crypto";
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
        return { enabled: env.WEB_PUSH_ENABLED === 'true', test: env.WEB_PUSH_TEST_ENABLED === 'true', publicKey: publicKey.toString('base64url'), key, encryptionVersion: env.WEB_PUSH_ENCRYPTION_KEY_VERSION!, vapidVersion: env.WEB_PUSH_VAPID_KEY_VERSION!, categories: categories.filter(c => c !== 'follow_up' && env['WEB_PUSH_CATEGORY_' + c.toUpperCase() + '_ENABLED'] === 'true') };
    }
    catch {
        return null;
    }
}
