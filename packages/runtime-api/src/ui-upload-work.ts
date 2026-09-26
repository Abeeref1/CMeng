export const uploadWorkScript=String.raw`
function uploadSchedules(){return startProjectUpload("schedule")}
function uploadBoqs(){return startProjectUpload("boq")}
function uploadContracts(){return startProjectUpload("contract")}
function uploadEvidence(){return startProjectUpload("evidence")}
function uploadJobVisible(job){return project()===job.projectId&&projectUploadJobs.get(job.projectId)===job}
function renderBackgroundUploads(){
  const jobs=[...projectUploadJobs.values()];
  el("backgroundUploads").hidden=!jobs.length;
  el("backgroundUploads").innerHTML=jobs.map(job=>'<div class="notice '+(job.state==="failed"?'error':'info')+'" style="display:flex;justify-content:space-between;gap:12px;align-items:center"><div><b>'+escapeHtml(job.projectId)+'</b> · '+escapeHtml(job.message)+(job.state==="uploading"?' · '+escapeHtml(job.percent)+'%':'')+'</div><button class="btn small upload-project-link" data-project="'+escapeHtml(job.projectId)+'">Open project</button></div>').join("");
  el("backgroundUploads").querySelectorAll(".upload-project-link").forEach(button=>button.onclick=()=>openProject(button.dataset.project));
}
function updateUploadJob(job,progress,index,total,detail){
  job.percent=Math.round((index+progress.percent/100)/total*100);
  job.message=progress.message||"Processing project documents";
  renderBackgroundUploads();
  if(uploadJobVisible(job))renderEvidenceUploadProgress(progress,index,total,detail);
}
async function startProjectUpload(kind){
  const projectId=project(),prior=projectUploadJobs.get(projectId);
  if(!projectId||prior&&(prior.state==="uploading"||prior.state==="updating"))return;
  const selections={schedule:scheduleSelection,boq:boqSelection,contract:contractSelection,evidence:evidenceSelection};
  const files=[...selections[kind]];if(!files.length)return;
  const roles=[...document.querySelectorAll(kind==="schedule"?".schedule-role":".contract-role")].reduce((result,node)=>{result[Number(node.dataset.index)]=node.value;return result},{});
  const job={projectId,kind,files,intent:el(kind+"Intent").value,rerun:!!el("runAfterUpload")?.checked,roles,state:"uploading",percent:0,message:"Uploading project documents"};
  projectUploadJobs.set(projectId,job);renderBackgroundUploads();
  // Active uploads own their captured files, independent of every project picker.
  if(kind==="schedule"){scheduleSelection=[];renderScheduleQueue()}
  if(kind==="boq"){boqSelection=[];renderSimpleQueue("boqQueue",boqSelection,"boq")}
  if(kind==="contract"){contractSelection=[];renderContractQueue()}
  if(kind==="evidence"){evidenceSelection=[];renderSimpleQueue("evidenceQueue",evidenceSelection,"evidence")}
  el(kind+"Files").value="";
  try{
    for(let i=0;i<files.length;i++)await uploadEvidenceFileWithProgress(files[i],i,files.length,job);
    if(job.rerun){
      job.state="updating";job.message="Documents saved · calculating project position";renderBackgroundUploads();
      if(uploadJobVisible(job)){showProjectUpdating(projectId);void loadEvidence();}
      await api("/api/projects/"+encodeURIComponent(projectId)+"/evidence/rerun",{method:"POST"});
    }
    job.state="complete";job.percent=100;job.message=job.rerun?"Documents loaded and project position checked":"Documents loaded · ready to review";
    if(uploadJobVisible(job)){
      await refresh(false);
      if(uploadJobVisible(job)){
        const review=currentModuleResult?.scheduleAuthorityReview||currentModuleResult?.data?.scheduleAuthorityReview;
        if(review?.pendingSchedules?.length){
          job.message=review.state==='missing'?'Programme uploaded · adoption required':'Documents loaded · programme revisions await review';
          el('uploadMessage').innerHTML=renderProgrammeReview(review);bindProgrammeReview(el('uploadMessage'));
        }
      }
    }
  }catch(error){job.state="failed";job.message="Could not finish: "+error.message+". Check Documents before retrying.";if(uploadJobVisible(job))void refresh(false);}
  finally{renderBackgroundUploads();}
}
`;
