import {randomBytes,scrypt as derive,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {normalizeAnswer} from './security-validation.ts';
const scrypt=promisify(derive);
export async function hashAnswer(answer:string){const salt=randomBytes(16).toString('hex');const hash=await scrypt(normalizeAnswer(answer),salt,32) as Buffer;return `scrypt$v1$16384$8$1$${salt}$${hash.toString('hex')}`;}
/** For a future recovery workflow; a match must never be its sole reset credential. */
export async function verifyAnswer(answer:string,encoded:string){const parts=/^scrypt\$v1\$16384\$8\$1\$([a-f0-9]{32})\$([a-f0-9]{64})$/.exec(encoded);if(!parts)return false;const result=await scrypt(normalizeAnswer(answer),parts[1]!,32) as Buffer;return timingSafeEqual(result,Buffer.from(parts[2]!,'hex'));}
