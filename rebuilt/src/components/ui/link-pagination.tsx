import Link from 'next/link';
import { Button } from './button';
import { paginationView } from '@/lib/collections/presentation';
/** Server-rendered GET navigation, preserving the caller's canonical filter URLs. */
export function LinkPagination({label,page,pageCount,pageUrl}:{label:string;page:number;pageCount:number;pageUrl:(page:number)=>string}){
 const v=paginationView(page,pageCount);
 return <nav aria-label={label} className="ds-pagination ds-actions">
  {v.hasPrevious?<Button asChild variant="outline"><Link prefetch={false} href={pageUrl(v.previous)}>Sebelumnya</Link></Button>:<Button variant="outline" disabled>Sebelumnya</Button>}
  <p className="text-sm tabular-nums">Halaman {v.page} dari {v.pageCount}</p>
  {v.hasNext?<Button asChild variant="outline"><Link prefetch={false} href={pageUrl(v.next)}>Berikutnya</Link></Button>:<Button variant="outline" disabled>Berikutnya</Button>}
 </nav>;
}
