/** Project-control questions select a complete analysis recipe. Recipes gather
 * existing authorities; they never compute dates or manufacture evidence. */
export type ProjectQuestionRecipe='delay_diagnosis'|'driving_path'|'wbs_pressure'|'revision_change'|'management_actions'|'no_change_outlook'|'project_position'|'milestone_exposure';
export function projectQuestionRecipe(q:string):ProjectQuestionRecipe|null{
 if(/\b(?:entitlement|eot|claim|cpi|spi|boq|payment|cash)\b/.test(q)&&!/\b(?:project|programme|schedule|completion)\b.*\b(?:late|delay)\b/.test(q))return null;
 if(/(?:nothing|no (?:dates|work|logic)) changes?|without (?:any )?(?:change|intervention)|no.change outlook/.test(q))return 'no_change_outlook';
 if(/milestones?/.test(q)&&/threat|expos|risk|pressure/.test(q))return 'milestone_exposure';
 if(/\bwbs\b|work breakdown/.test(q)&&!/\bfor wbs\b/.test(q)&&/delay|pressure|problem|caus|critical|driv|most|(?:group )?by/.test(q))return 'wbs_pressure';
 if(/what (?:has )?changed|changes? (?:this month|since|from)|slipp?ed since|movement since/.test(q))return 'revision_change';
 if(/top\s+\d+\s+(?:things|actions|priorities)|what (?:do|should) (?:i|we) (?:need to )?(?:do|act)|what.*(?:need.*(?:action|attention)|urgent)|management action/.test(q))return 'management_actions';
 if(/\b(?:why|caus\w*|driv\w*|delaying|makes?|making)\b/.test(q)&&(/\b(?:project|programme|schedule|completion|finish|critical path)\b/.test(q)||/why (?:are|were) we (?:late|behind)|why (?:these|those|they).*late|what caus\w* (?:the )?delay/.test(q)))return 'delay_diagnosis';
 if(/\b(?:critical|driving) (?:path|network|sequence|chain)\b|what.*driv.*(?:completion|finish)/.test(q))return 'driving_path';
 if(/project (?:position|status|diagnosis)|diagnose (?:this|the) project|how (?:is|are) (?:the project|we) (?:doing|performing)/.test(q))return 'project_position';
 return null;
}
