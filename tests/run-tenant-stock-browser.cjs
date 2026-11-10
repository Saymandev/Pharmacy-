/* eslint @typescript-eslint/no-require-imports: "off" */
const {spawnSync}=require('node:child_process');
const result=spawnSync(process.execPath,[require.resolve('./tenant-workspace.browser.cjs')],{stdio:'inherit',windowsHide:true,env:{...process.env,TENANT_CATALOG_TEST:'1',TENANT_STOCK_FORM_TEST:'1'}});
if(result.error)throw result.error;
process.exitCode=result.status??1;
