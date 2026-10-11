/** Reuse the exact source-area measurements already published underneath
 * Progress Breakdown in its primary WBS management table. A source area is
 * never guessed from partial labels or allocated across currencies/WBS nodes.
 * Unknown and conflicting values remain null, not fabricated zeros. */
export function bindMeasuredAreasToWbs<T extends Record<string, any>>(projection:T,analysis:unknown):T {
  const a=analysis as {kind?:string;areas?:Array<Record<string,any>>}|null;
  if(a?.kind!=='area_progress'||!Array.isArray(a.areas)||!Array.isArray(projection.dimensionViews))return projection;
  const name=(s:unknown)=>String(s??'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
  const views=projection.dimensionViews as Array<{dimension:string;rows?:Array<Record<string,any>>}>;
  const wbs=views.find(view=>view.dimension==='wbs');
  if(!wbs||!Array.isArray(wbs.rows))return projection;
  const wbsCounts=new Map<string,number>();
  for(const row of wbs.rows)if(row.classified!==false){
    const label=name(row.groupLabel);
    if(label)wbsCounts.set(label,(wbsCounts.get(label)??0)+1);
  }
  const measurements=new Map<string,Array<Record<string,any>>>();
  for(const area of a.areas){
    const label=name(area.area);
    if(!label||typeof area.currency!=='string'||!area.currency.trim())continue;
    measurements.set(label,[...(measurements.get(label)??[]),area]);
  }
  const finite=(v:unknown)=>typeof v==='number'&&Number.isFinite(v);
  const enhance=(row:Record<string,any>,labelValue:unknown)=>{
    const label=name(labelValue),values=measurements.get(label)??[];
    // Exactly one named source area and exactly one WBS group establish the
    // direct relationship; equal names in multiple currencies are ambiguous.
    if(!label||wbsCounts.get(label)!==1||values.length!==1)return row;
    const area=values[0]!;
    if(!finite(area.physicalProgressPercent)&&!finite(area.certifiedProgressPercent))return row;
    return {...row,
      physicalMeasuredPercent:finite(area.physicalProgressPercent)?area.physicalProgressPercent:row.physicalMeasuredPercent??null,
      certifiedPhysicalPercent:finite(area.certifiedProgressPercent)?area.certifiedProgressPercent:row.certifiedPhysicalPercent??null,
      areaSourceCurrency:area.currency,
      areaMeasurementCount:area.measuredItemCount??null,
      areaSourceItemCount:area.itemCount??null,
      physicalProgressBasis:area.physicalBasis??null,
      certifiedProgressBasis:area.certificationBasis??null,
      areaProgressAuthority:'unique_exact_source_area_to_wbs_name',
    };
  };
  return {...projection,
    dimensionViews:views.map(view=>view===wbs?{...view,rows:view.rows!.map(row=>enhance(row,row.groupLabel))}:view),
    rows:Array.isArray(projection.rows)?projection.rows.map((row:Record<string,any>)=>enhance(row,row.wbsName)):projection.rows,
  };
}
