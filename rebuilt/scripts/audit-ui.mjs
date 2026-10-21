/** Structural label audit; does not replace browser or assistive technology testing. */
import ts from 'typescript';
import {readdirSync,readFileSync} from 'node:fs';
const files=[];function scan(path){for(const file of readdirSync(path,{withFileTypes:true})){const p=path+'/'+file.name;if(file.isDirectory())scan(p);else if(p.endsWith('.tsx'))files.push(p);}}scan('src');
const issues=[];let controls=0;
for(const file of files){
 const sf=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),labels=new Set();
 const attrs=n=>Object.fromEntries(n.attributes.properties.filter(ts.isJsxAttribute).map(p=>[p.name.getText(sf),p.initializer?.getText(sf)??'true']));
 function collect(n){if(ts.isJsxOpeningElement(n)&&n.tagName.getText(sf)==='label'){const a=attrs(n);if(a.htmlFor)labels.add(a.htmlFor);}ts.forEachChild(n,collect);}collect(sf);
 function visit(n){if((ts.isJsxSelfClosingElement(n)||ts.isJsxOpeningElement(n))&&['input','select','textarea'].includes(n.tagName.getText(sf))){const a=attrs(n);if(a.type==='"hidden"'||a.type==="'hidden'")return;controls++;let wrapped=false;for(let p=n.parent;p;p=p.parent){if(ts.isJsxElement(p)&&p.openingElement.tagName.getText(sf)==='label'){wrapped=true;break;}}if(!wrapped&&!a['aria-label']&&!a['aria-labelledby']&&!labels.has(a.id))issues.push({file,line:sf.getLineAndCharacterOfPosition(n.getStart()).line+1,tag:n.tagName.getText(sf)});}ts.forEachChild(n,visit);}visit(sf);
}
console.log(JSON.stringify({status:issues.length?'failed':'passed',files:files.length,controls,unresolvedLabelChecks:issues,limitations:['Static JSX associations only; runtime content and screen-reader behavior need separate testing.']},null,2));if(issues.length)process.exitCode=1;
