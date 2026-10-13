import { test, expect } from '@playwright/test';

// Real server/UI checks. No API mocking and no invented connected-provider or Devnet evidence.
test('public entry renders and legacy unauthenticated inference is retired',async({page,request})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');await expect(page.getByText('promptfun',{exact:true}).first()).toBeVisible();
 expect(errors).toEqual([]);
 const legacy=await request.post('/api/generate-poc',{data:{prompt:'test'}});
 expect(legacy.status()).toBe(410);expect((await legacy.json()).error.code).toBe('LEGACY_DISABLED');
});
test('unconfigured dependencies fail visibly instead of generating a fake app',async({request})=>{
 const result=await request.get('/api/health');const health=await result.json();
 expect(health.devnet_only).toBe(true);expect(health.dependencies).toHaveProperty('control_database');
 if(!health.dependencies.control_database)expect(result.status()).toBe(503);
});
test('mobile navigation does not overflow at 360px',async({page})=>{
 await page.setViewportSize({width:360,height:800});await page.goto('/');
 await expect(page.getByText('promptfun',{exact:true}).first()).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
