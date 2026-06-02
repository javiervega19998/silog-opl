const fs = require('fs');
const files = fs.readdirSync('.').filter(f => f.endsWith('.html'));
const results = {
  hardcodedFirebase: [],
  duplicateScripts: [],
  inlineScriptSize: {},
  missingSanitize: []
};
files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  if(content.includes('firebase.initializeApp(')) results.hardcodedFirebase.push(f);
  if(content.match(/<script src="js\/auth\.js/g)?.length > 1) results.duplicateScripts.push(f);
  
  const inlines = [...content.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  results.inlineScriptSize[f] = inlines.reduce((acc, m) => acc + m[1].length, 0);

  if(!content.includes('function sanitize(') && !content.includes('auth.js')) {
    // maybe needs sanitize
  }
});
console.log(JSON.stringify(results, null, 2));
