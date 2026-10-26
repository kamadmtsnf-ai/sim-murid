/** Presentation only; never changes the caller's query, authorization or dataset. */
export function paginationView(page: number, pageCount: number) {
 const count=Number.isSafeInteger(pageCount)&&pageCount>0?pageCount:1;
 const current=Number.isSafeInteger(page)?Math.min(count,Math.max(1,page)):1;
 return {page:current,pageCount:count,previous:Math.max(1,current-1),next:Math.min(count,current+1),hasPrevious:current>1,hasNext:current<count};
}
export function collectionRange(total:number,page:number,pageSize:number){
 if(!Number.isSafeInteger(total)||total<0||!Number.isSafeInteger(pageSize)||pageSize<1)return null;
 const v=paginationView(page,Math.max(1,Math.ceil(total/pageSize)));
 return {total,from:total?((v.page-1)*pageSize+1):0,to:Math.min(total,v.page*pageSize)};
}
export const collectionSorts=['label-asc','label-desc'] as const;
export type CollectionSort=typeof collectionSorts[number];
export function validCollectionSort(value:unknown):value is CollectionSort{return value==='label-asc'||value==='label-desc';}
