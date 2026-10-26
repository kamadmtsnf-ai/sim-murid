/** Node ESM needs an explicit extension; browser verification uses the actual bundler. */
import {registerHooks,createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);
const dynamicUrl=pathToFileURL(require.resolve('next/dynamic')).href;
registerHooks({resolve(specifier,context,next){
  if(specifier==='next/dynamic') return {url:dynamicUrl,shortCircuit:true};
  return next(specifier,context);
}});
