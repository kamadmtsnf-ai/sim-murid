import test from "node:test";
import assert from "node:assert/strict";
import { academicSelection, academicStorageKey, parseAcademicSelection, academicSelectionIssue, academicSelectionLabel } from "../src/lib/academic/context.ts";
const id="00000000-0000-4000-8000-000000000001";
const value={version:1 as const,year:2026,semester:2 as const,classId:id};
const catalog={years:[2025,2026],classes:[{id,year:2026,name:"7 A"}]};
test("Academic preference rejects untrusted storage shape/version/year/semester and excessive input",()=>{
 assert.deepEqual(parseAcademicSelection(JSON.stringify(value)),value);
 for(const input of [{...value,version:2},{...value,year:"2026"},{...value,semester:3},{...value,classId:"bad"},{...value,capability:"all"}])assert.equal(parseAcademicSelection(JSON.stringify(input)),null);
 assert.equal(parseAcademicSelection("invalid"),null);assert.equal(parseAcademicSelection(" ".repeat(2049)),null);
 assert.equal(academicSelectionLabel(value),"2026/2027 · Genap");
});
test("Current catalog checks never silently broaden a missing/revoked/foreign class or wrong year",()=>{
 assert.equal(academicSelectionIssue(value,catalog,true),null);
 assert.ok(academicSelectionIssue(value,{...catalog,classes:[]},true));
 assert.ok(academicSelectionIssue({...value,year:2025},catalog,true));
 assert.ok(academicSelectionIssue({...value,year:2024},catalog,true));
 assert.ok(academicSelectionIssue({...value,classId:null},catalog,true));
 assert.equal(academicSelectionIssue({...value,classId:null},catalog,false),null);
});
test("Preference keys preserve username case, leading zero and minus; preference carries no identity or authorization",()=>{
 const keys=["001-user","001-User","1-user","other"].map(academicStorageKey);assert.equal(new Set(keys).size,4);
 assert.equal(academicStorageKey("001-user"),"sim-academic:v1:001-user");
 assert.equal(academicSelection.safeParse({...value,userId:id}).success,false);
});
