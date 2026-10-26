import { collectionRange } from '@/lib/collections/presentation';
/** Committed filters only; caller owns filtering, sorting and export scope. */
export function CollectionSummary({total,page,pageSize,unit='data',filters=[]}:{total:number;page:number;pageSize:number;unit?:string;filters?:ReadonlyArray<{label:string;value:string}>}){
 const range=collectionRange(total,page,pageSize);
 return <div className="min-w-0 space-y-2 [overflow-wrap:anywhere]">
  <p role="status" className="text-sm text-muted-foreground">{range?`Menampilkan ${range.from.toLocaleString('id-ID')}–${range.to.toLocaleString('id-ID')} dari ${range.total.toLocaleString('id-ID')} ${unit}`:'Jumlah hasil belum tersedia.'}</p>
  <ul aria-label="Filter aktif" className="flex min-w-0 flex-wrap gap-2">{filters.filter(f=>f.value.trim()).map(f=><li key={f.label} className="max-w-full rounded-lg border bg-muted/30 px-2 py-1 text-xs"><span className="font-medium">{f.label}:</span> {f.value}</li>)}</ul>
 </div>;
}
