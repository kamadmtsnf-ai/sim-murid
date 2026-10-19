import Link from 'next/link';
import {RecoveryForm} from './recovery-form';
export default function RecoveryPage(){return <main id="main-content" className="mx-auto max-w-lg space-y-6 px-6 py-12"><Link href="/login" className="text-primary underline">Kembali ke login</Link><h1 className="text-3xl font-semibold">Bantuan akun</h1><p>Minta pemulihan password atau sesi, kemudian hubungi petugas madrasah untuk memverifikasi identitas Anda. Jawaban keamanan tidak langsung mengubah akun.</p><RecoveryForm/></main>;}
