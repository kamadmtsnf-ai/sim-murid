import {LoginShell} from './login-shell';
import {Card,CardHeader,CardContent} from '@/components/ui/card';
import styles from './login.module.css';
export default function Loading(){return <LoginShell><h1 className="sr-only">Memuat halaman masuk</h1><div aria-busy="true" role="status" aria-label="Menyiapkan halaman masuk"><Card className={styles.card} aria-hidden="true"><CardHeader className={styles.cardHeader}><div className="skeleton h-6 w-2/3"/><div className="skeleton h-4 w-full"/></CardHeader><CardContent className={`${styles.cardContent} space-y-5`}>{[0,1,2].map(key=><div key={key} className={`skeleton ${styles.skeleton}`}/>)}</CardContent></Card></div></LoginShell>;}
