import {deliveryRecords} from './delivery-records';
import {resolveBoqSource} from './boq-source';
import type {ProjectRuntimeState} from './project-state-types';

const cache=new WeakMap<ProjectRuntimeState,{version:number;labels:Record<string,string>}>();

/** Labels are presentation metadata; original evidence identifiers stay intact. */
export function projectSourceLabels(state:ProjectRuntimeState):Record<string,string>{
  const old=cache.get(state);if(old?.version===state.version)return old.labels;
  const labels:Record<string,string>={};
  for(const doc of state.evidenceDocuments??[]){
    labels[doc.documentId]=doc.sourceFilename;
    labels['evidence-document:'+doc.documentId]=doc.sourceFilename;
    if(doc.linkedArtifactId)labels[doc.linkedArtifactId]=doc.sourceFilename;
  }
  for(const schedule of state.schedules??[]){
    labels[schedule.revision.revisionId]=schedule.revision.label??schedule.sourceFilename??'Programme revision';
    const model=schedule.revision.model as any;
    for(const id of [model.sourceRevisionId,model.revisionId,(schedule as any).revisionId])if(id)labels[id]=schedule.revision.label??schedule.sourceFilename??'Programme revision';
  }
  for(const record of deliveryRecords(state).records){
    if(record.reference)labels[record.recordId]=record.reference;
  }
  const retainItem=(item:any)=>{const number=String(item.itemNumber??'').trim();if(!number)return;for(const id of [item.itemId,item.quantityItemId])if(id)labels[id]=number;};
  for(const boq of [...(state.boqRevisions??[]),state.boq])for(const item of boq?.canonicalItems??[])retainItem(item);
  for(const item of state.quantities?.items??[])retainItem(item);
  const resolved=resolveBoqSource(state,state.schedules?.at(-1)?.revision.revisionId??'');
  for(const item of resolved.boq?.canonicalItems??[])retainItem(item);
  for(const item of resolved.quantities?.items??[])retainItem(item);
  cache.set(state,{version:state.version,labels});return labels;
}
