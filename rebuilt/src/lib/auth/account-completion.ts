import type { SecurityState } from './security-validation';
export type CompletionStep = { id: string; label: string; required: boolean; status: 'complete' | 'pending' | 'blocked' | 'unknown'; detail: string };
/** Presentation only: server gates remain the authority for access and mutations. */
export function accountCompletion(state: SecurityState, emailVerified?: boolean | null) {
  // A confirmed email readback can change only the email gate, never earlier prerequisites.
  const gate = state.role==='teacher' && emailVerified===false && state.gate==='ready' ? 'email_pending' : state.gate==='email_pending' && emailVerified===true ? 'ready' : state.gate;
  const passwordDone = state.gate !== 'password';
  const hasRole = state.role !== null && state.gate !== 'account_pending';
  const profileRequired = state.role === 'student' || state.role === 'applicant';
  const profileDone = passwordDone && hasRole && !['profile_pending'].includes(state.gate);
  const steps: CompletionStep[] = [{id:'password',label:'Ganti password sementara',required:true,status:passwordDone?'complete':'pending',detail:passwordDone?'Langkah password wajib telah selesai.':'Ganti password sementara pada formulir di bawah. Setelah berhasil, masuk kembali dengan password baru.'}];
  if (profileRequired) steps.push({id:'profile',label:'Lengkapi biodata',required:true,status:!passwordDone?'blocked':profileDone?'complete':'pending',detail:!passwordDone?'Tersedia setelah penggantian password.':profileDone?'Tahap biodata wajib telah selesai.':'Lengkapi biodata melalui menu Biodata dan dokumen di sidebar.'});
  steps.push({id:'question',label:'Pertanyaan keamanan',required:true,status:state.question_code?'complete':!passwordDone||!hasRole||state.gate==='profile_pending'?'blocked':'pending',detail:state.question_code?'Pertanyaan keamanan sudah tersimpan.':!passwordDone?'Tersedia setelah penggantian password.':state.gate==='profile_pending'?'Selesaikan biodata wajib terlebih dahulu.':'Pilih pertanyaan dan simpan jawaban melalui formulir Keamanan akun.'});
  const emailRequired = state.role === 'teacher';
  const verified = emailVerified ?? (emailRequired && state.gate==='ready' ? true : null);
  steps.push({id:'email',label:'Verifikasi email',required:emailRequired,status:!passwordDone||!hasRole?'blocked':verified===true?'complete':verified===false||state.gate==='email_pending'?'pending':'unknown',detail:!passwordDone?'Tersedia setelah penggantian password.':!hasRole?'Menunggu penetapan peran oleh administrator.':verified===true?'Email kontak telah terverifikasi.':emailRequired?'Buka menu Verifikasi email. Anda dapat mengisi email tanpa menunggu pertanyaan keamanan selesai.':'Opsional untuk peran ini. Periksa atau verifikasi email melalui menu Verifikasi email.'});
  const next: Record<SecurityState['gate'],string> = {password:'Ganti password sementara, lalu masuk kembali dengan password baru.',account_pending:'Hubungi administrator untuk memeriksa peran akun.',profile_pending:'Lengkapi biodata wajib. Verifikasi email juga sudah dapat dilakukan.',security_question:'Simpan pertanyaan keamanan. Verifikasi email juga sudah dapat dilakukan.',email_pending:'Isi email kontak, kirim kode, lalu verifikasi melalui menu Verifikasi email.',survey_pending:'Selesaikan survei wajib melalui menu Survei.',ready:'Langkah keamanan wajib selesai. Pilih layanan yang tersedia melalui sidebar.'};
  return {steps, completed:steps.filter(s=>s.required&&s.status==='complete').length,total:steps.filter(s=>s.required).length,next:next[gate],ready:gate==='ready'};
}
