// Signs in to a locally running copy of the app for the integration tests.
// Create a throwaway team member first, then run, for example:
//   $env:MAILCRAFT_QA_EMAIL='qa@example.com'; $env:MAILCRAFT_QA_PASSWORD='...'; node scripts/test-workspace.mjs
export async function signIn(base){
 const email=process.env.MAILCRAFT_QA_EMAIL,password=process.env.MAILCRAFT_QA_PASSWORD;
 if(!email||!password)throw new Error('Set MAILCRAFT_QA_EMAIL and MAILCRAFT_QA_PASSWORD to a test account on the local copy of the app.');
 const res=await fetch(base+'/api/auth',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({action:'login',email,password})});
 if(!res.ok)throw new Error('Test account sign-in failed: '+res.status);
 const cookie=res.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');if(!cookie)throw new Error('No session cookie returned.');return cookie;
}
