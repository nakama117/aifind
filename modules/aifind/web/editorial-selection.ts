/** Test Records and tested Plan/Price belong to one Product version, never to a selector position. */
export function changeEditorialReference<T extends {productId:string;referencePublishedVersionId:string}>(row:T,productId:string,referencePublishedVersionId:string):T {
  if(row.productId===productId&&row.referencePublishedVersionId===referencePublishedVersionId)return row;
  return {...row,productId,referencePublishedVersionId,...('testRecord'in row?{testRecord:null,testedPlanKey:null,testedPriceRef:null}:{})};
}
