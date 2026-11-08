import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { type NextRequest, type NextResponse } from "next/server";
import { createAuthAdmin } from "@/lib/auth/admin";
import { privateJson, requestAuth, sameOrigin, verifiedPrincipal } from "@/lib/auth/http";
import { pushConfiguration } from "./config";
import { bindingHash, credentialSchema, digest, encrypt, preferencesSchema, subscriptionSchema, testSchema, validateEndpoint, type Credential } from "./security";
const COOKIE = '__Host-sim-push';
const resultSchema = z.object({ code: z.enum(['saved', 'duplicate', 'denied', 'disabled', 'invalid', 'conflict', 'device_limit', 'not_found', 'stale', 'rate_limited', 'request_conflict']), id: z.uuid().optional(), binding_version: z.number().int().optional(), preferences: z.unknown().optional() });
const dbConfig = z.object({ enabled: z.boolean(), test_enabled: z.boolean(), categories: z.array(z.string()) });
class Failure extends Error {
    constructor(readonly status: number, readonly message: string) { super(message); }
}
function credential(request: NextRequest): Credential | null { try {
    return credentialSchema.parse(JSON.parse(Buffer.from(request.cookies.get(COOKIE)?.value ?? '', 'base64url').toString('utf8')));
}
catch {
    return null;
} }
function setCredential(response: NextResponse, c: Credential) { response.cookies.set(COOKIE, Buffer.from(JSON.stringify(c)).toString('base64url'), { httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: 60 * 60 * 24 * 365 }); }
/** Revoke-only capability also works after Auth expiry. Never accepts JSON proof. */
export async function releasePushInstallation(request: NextRequest, nextOwner?: string) {
    const c = credential(request);
    if (!c || c.owner === nextOwner)
        return;
    for (const hash of new Set([bindingHash(c), ...(c.previousHashes ?? [])])) {
        const { data, error } = await createAuthAdmin().rpc('app_push_release', { p_installation: c.installation, p_secret_hash: hash });
        if (error || resultSchema.safeParse(data).data?.code !== 'saved')
            throw Error('Installation release unavailable');
    }
    // Retain proof for cross-account rebind; its hash is owner-scoped and cannot release a new owner.
}
async function body(request: NextRequest) {
    if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') ?? ''))
        throw new Failure(415, 'Gunakan format JSON.');
    if (Number(request.headers.get('content-length')) > 12288)
        throw new Failure(413, 'Permintaan terlalu besar.');
    const reader = request.body?.getReader();
    if (!reader)
        throw new Failure(400, 'Permintaan tidak valid.');
    const chunks: Uint8Array[] = [];
    let size = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => { reject(new Failure(408, 'Waktu permintaan habis.')); void reader.cancel().catch(() => { }); }, 5000); });
    try {
        for (;;) {
            const { value, done } = await Promise.race([reader.read(), timeout]);
            if (done)
                break;
            size += value.byteLength;
            if (size > 12288) {
                await reader.cancel();
                throw new Failure(413, 'Permintaan terlalu besar.');
            }
            chunks.push(value);
        }
        return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))) as unknown;
    }
    catch (error) {
        if (error instanceof Failure)
            throw error;
        throw new Failure(400, 'Permintaan tidak valid.');
    }
    finally {
        clearTimeout(timer);
        reader.releaseLock();
    }
}
const statusFor = (code: string) => ({ denied: 403, disabled: 503, invalid: 400, conflict: 409, request_conflict: 409, device_limit: 409, not_found: 404, stale: 409, rate_limited: 429 }[code] ?? 200);
const messages: Record<string, string> = { denied: 'Permintaan tidak diizinkan.', disabled: 'Push notifikasi belum tersedia.', invalid: 'Permintaan tidak valid.', conflict: 'Perangkat belum dapat dihubungkan. Lepaskan binding sebelumnya terlebih dahulu.', request_conflict: 'ID permintaan sudah digunakan.', device_limit: 'Batas lima perangkat aktif tercapai. Cabut perangkat lama terlebih dahulu.', not_found: 'Perangkat tidak ditemukan.', stale: 'Pengaturan telah berubah. Muat ulang sebelum menyimpan.', rate_limited: 'Terlalu banyak permintaan. Silakan coba lagi nanti.' };
export async function pushApi(request: NextRequest, action: 'config' | 'devices' | 'register' | 'revoke' | 'preferences' | 'test', id?: string) {
    const response = privateJson({});
    try {
        const mutation = !['GET', 'HEAD'].includes(request.method);
        if (mutation && !sameOrigin(request))
            throw new Failure(403, 'Permintaan tidak diizinkan.');
        const state = await verifiedPrincipal(requestAuth(request, response));
        if (!state)
            throw new Failure(401, 'Silakan masuk kembali.');
        if (request.headers.has('X-Sim-Push-Account') && request.headers.get('X-Sim-Push-Account') !== state.principal.id) throw new Failure(403, 'Akun pada tab ini telah berubah. Muat ulang halaman.');
        const admin = createAuthAdmin(), actor = { p_actor: state.principal.id, p_session: state.sessionId };
        const respond = (value: unknown, status = 200) => { const r = privateJson(value, status); response.cookies.getAll().forEach(c => r.cookies.set(c)); if (status === 429)
            r.headers.set('Retry-After', action === 'test' ? '3600' : '60'); return r; };
        const checked = (data: unknown, error: unknown) => { const result = resultSchema.safeParse(data); if (error || !result.success)
            throw Error('Push database unavailable'); return result.data; };
        if (mutation) {
            const rate = await admin.rpc('app_push_rate', { ...actor, p_action: action === 'register' ? 'subscriptions' : action === 'revoke' ? 'revoke' : action === 'test' ? 'test' : 'preferences' });
            const r = checked(rate.data, rate.error);
            if (r.code !== 'saved')
                return respond({ code: r.code, message: messages[r.code] }, statusFor(r.code));
        }
        if (action === 'devices') {
            const { data, error } = await admin.rpc('app_push_devices', actor);
            if (error)
                throw error;
            if (data === null)
                throw new Failure(401, 'Silakan masuk kembali.');
            return respond({ devices: data });
        }
        if (action === 'revoke') {
            const parsed = z.uuid().safeParse(id);
            if (!parsed.success)
                throw new Failure(400, 'ID perangkat tidak valid.');
            const { data, error } = await admin.rpc('app_push_revoke', { ...actor, p_id: parsed.data });
            const r = checked(data, error);
            return respond(r.code === 'saved' ? { code: 'saved' } : { code: r.code, message: messages[r.code] }, statusFor(r.code));
        }
        if (action === 'preferences') {
            const parsed = request.method === 'PATCH' ? preferencesSchema.parse(await body(request)) : null;
            const { data, error } = await admin.rpc('app_push_preferences', { ...actor, ...(parsed ? { p_revision: parsed.revision, p_data: { categories: parsed.categories, quiet_start: parsed.quiet_start, quiet_end: parsed.quiet_end, timezone: parsed.timezone } } : {}) });
            const r = checked(data, error);
            return respond(r.code === 'saved' ? { code: r.code, preferences: r.preferences } : { code: r.code, message: messages[r.code] }, statusFor(r.code));
        }
        const config = pushConfiguration(request.url);
        if (action === 'config') {
            const { data, error } = await admin.rpc('app_push_config', actor);
            if (error)
                throw error;
            if (data === null)
                throw new Failure(401, 'Silakan masuk kembali.');
            const parsedConfig = dbConfig.safeParse(data);
            if (!parsedConfig.success)
                throw Error('Push configuration unavailable');
            const db = parsedConfig.data;
            if (new URL(request.url).protocol === 'https:' && !credential(request))
                setCredential(response, { installation: randomUUID(), secret: randomBytes(32).toString('base64url'), owner: actor.p_actor });
            return respond({ accountId: actor.p_actor, available: !!config, enabled: !!config?.enabled && db.enabled, testEnabled: !!config?.enabled && config.test && db.enabled && db.test_enabled, publicKey: config?.publicKey ?? null, vapidKeyVersion: config?.vapidVersion ?? null, categories: config?.categories.filter(c => db.categories.includes(c)) ?? [], maxDevices: 5 });
        }
        if (!config?.enabled)
            throw new Failure(503, 'Push notifikasi belum tersedia.');
        if (state.principal.must_change_password)
            throw new Failure(403, 'Selesaikan perubahan password terlebih dahulu.');
        if (action === 'test') {
            if (!config.test)
                throw new Failure(503, 'Uji push belum tersedia.');
            const parsed = testSchema.parse(await body(request));
            const { data, error } = await admin.rpc('app_push_test', { ...actor, p_subscription: parsed.subscription_id, p_request: parsed.request_id });
            const r = checked(data, error);
            return respond(['saved', 'duplicate'].includes(r.code) ? { code: r.code, message: 'Permintaan uji telah diantrekan. Ini belum berarti notifikasi diterima.' } : { code: r.code, message: messages[r.code] }, r.code === 'saved' ? 202 : statusFor(r.code));
        }
        const parsed = subscriptionSchema.parse(await body(request));
        if (parsed.subscription.expirationTime !== null && parsed.subscription.expirationTime <= Date.now())
            throw new Failure(400, 'Subscription sudah kedaluwarsa.');
        const c = credential(request);
        if (!c) {
            setCredential(response, { installation: randomUUID(), secret: randomBytes(32).toString('base64url'), owner: actor.p_actor });
            return respond({ code: 'handshake_required', message: 'Ulangi pendaftaran setelah cookie perangkat tersimpan.' }, 428);
        }
        let endpoint: string;
        try {
            endpoint = (await validateEndpoint(parsed.subscription.endpoint)).endpoint;
        }
        catch {
            throw new Failure(400, 'Endpoint push tidak diizinkan atau belum dapat diverifikasi.');
        }
        if (c.owner !== actor.p_actor) {
            await releasePushInstallation(request);
            // Cookie roundtrip BEFORE changing DB ownership. A lost registration response must still
            // leave the browser holding the new owner's revoke capability, even after Auth expiry.
            const previousHashes = [...new Set([bindingHash(c), ...(c.previousHashes ?? [])])].slice(0, 8);
            setCredential(response, { ...c, secret: randomBytes(32).toString('base64url'), owner: actor.p_actor, previousHashes });
            return respond({ code: 'handshake_required', message: 'Binding lama telah dilepas. Ulangi pendaftaran untuk akun ini.' }, 428);
        }
        const keyVersion = config.encryptionVersion, aad = `sim-push-v1:${c.installation}:${actor.p_actor}:${keyVersion}`;
        const keys = JSON.stringify(parsed.subscription.keys);
        const register = async (previous: string) => admin.rpc('app_push_register', { ...actor, p_data: { installation_id: c.installation, endpoint_hash: digest(endpoint), subscription_hash: digest(JSON.stringify([endpoint, parsed.subscription.keys.p256dh, parsed.subscription.keys.auth])), endpoint_ciphertext: encrypt(endpoint, config.key, aad + ':endpoint'), keys_ciphertext: encrypt(keys, config.key, aad + ':keys'), encryption_key_version: keyVersion, vapid_key_version: config.vapidVersion, binding_secret_hash: bindingHash(c, actor.p_actor), previous_binding_secret_hash: previous, label: parsed.label, expires_at: parsed.subscription.expirationTime === null ? null : new Date(parsed.subscription.expirationTime).toISOString() } });
        let r: z.infer<typeof resultSchema> | undefined;
        for (const proof of new Set([bindingHash(c), ...(c.previousHashes ?? [])])) {
            const result = await register(proof);
            r = checked(result.data, result.error);
            if (r.code !== 'conflict')
                break;
        }
        if (!r)
            throw Error('Push registration unavailable');
        if (r.code === 'saved')
            setCredential(response, { installation: c.installation, secret: c.secret, owner: actor.p_actor });
        return respond(r.code === 'saved' ? { code: r.code, id: r.id, binding_version: r.binding_version } : { code: r.code, message: messages[r.code] }, statusFor(r.code));
    }
    catch (error) {
        const r = privateJson({ message: error instanceof Failure ? error.message : error instanceof z.ZodError ? 'Permintaan tidak valid.' : 'Layanan perangkat belum tersedia. Silakan coba kembali.' }, error instanceof Failure ? error.status : error instanceof z.ZodError ? 400 : 503);
        response.cookies.getAll().forEach(c => r.cookies.set(c));
        return r;
    }
}
