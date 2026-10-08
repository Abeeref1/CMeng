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
    labels[schedule.revision.revisionId]=schedule.sourceFilename??schedule.revision.label??'Programme revision';
  }
  cache.set(state,{version:state.version,labels});return labels;
}
