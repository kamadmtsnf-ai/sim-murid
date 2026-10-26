/** Structural inventory only; runtime and human assistive-technology tests remain required. */
import ts from 'typescript';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
const baseline=process.argv.includes('--baseline'),mains=[],positiveTabIndex=[];
const ref='59ee00ca94191cf0d42e3406632242137a3bbc38';
function scan(dir){for(const e of readdirSync(dir,{withFileTypes:true})){
 const path=join(dir,e.name);if(e.isDirectory()){scan(path);continue;}if(!path.endsWith('.tsx'))continue;
 const code=baseline?execFileSync('git',['show',`${ref}:rebuilt/${path}`],{encoding:'utf8'}):readFileSync(path,'utf8');
 const source=ts.createSourceFile(path,code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 function walk(n){if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)){
  const props=n.attributes.properties.filter(ts.isJsxAttribute),attr=name=>props.find(p=>p.name.getText(source)===name)?.initializer?.getText(source),line=source.getLineAndCharacterOfPosition(n.getStart(source)).line+1;
  if(n.tagName.getText(source)==='main')mains.push({path,line,id:attr('id'),tabIndex:attr('tabIndex')??null});
  if(/^\{\s*[1-9]\d*\s*\}$/.test(attr('tabIndex')??''))positiveTabIndex.push({path,line});
 }ts.forEachChild(n,walk);}walk(source);
}}
scan('src');const result={kind:'source inventory, not full WCAG conformance',baseline,commit:baseline?ref:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),mains,missingFocusTarget:mains.filter(m=>m.id==='"main-content"'&&m.tabIndex!=='{-1}'),positiveTabIndex};
writeFileSync(process.argv[2]??'/tmp/l10-source.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({mains:mains.length,missing:result.missingFocusTarget.length,positiveTabIndex:positiveTabIndex.length}));
