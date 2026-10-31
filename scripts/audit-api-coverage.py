"""Inventory uploaded Express routes and locate frontend references (source coverage, not runtime proof)."""
from pathlib import Path
import re, argparse, json
parser=argparse.ArgumentParser(); parser.add_argument('--backend',default='/workspace/pharmacy-pos-backend-main');args=parser.parse_args()
backend=Path(args.backend)/'src'; frontend=Path(__file__).resolve().parents[1]

def read(path):
    # Remove comments so disabled routes are not counted.
    return re.sub(r'/\*.*?\*/|^\s*//[^\n]*','',path.read_text(),flags=re.S|re.M)

def resolve(spec,path):
    if spec.startswith('@modules/'):return backend/'modules'/(spec[len('@modules/'):]+'.ts')
    if spec.startswith('.'):return (path.parent/(spec+'.ts')).resolve()
    raise ValueError(spec)

endpoints=[]
def visit(path,prefix):
    source=read(path)
    imports={}
    for match in re.finditer(r'import\s+(\w+|\{\s*\w+\s*\})\s+from\s+[\'"]([^\'"]+)[\'"]',source):
        imports[match[1].strip('{} ')]=match[2]
    for match in re.finditer(r'router\.(get|post|put|patch|delete)\s*\(\s*[\'"]([^\'"]+)[\'"]',source):
        route=(prefix+'/'+match[2].strip('/')).rstrip('/') or '/'
        endpoints.append((match[1].upper(),route,str(path.relative_to(backend))))
    for match in re.finditer(r'router\.use\(\s*[\'"]([^\'"]+)[\'"]\s*,\s*(\w+)\s*\)',source):
        if match[2] in imports:visit(resolve(imports[match[2]],path),prefix+'/'+match[1].strip('/'))
    for match in re.finditer(r'path:\s*[\'"]([^\'"]+)[\'"],\s*route:\s*(\w+)',source):
        visit(resolve(imports[match[2]],path),prefix+'/'+match[1].strip('/'))
visit(backend/'routes/index.ts','')
files={str(p.relative_to(frontend)):p.read_text() for p in (frontend/'src').rglob('*') if p.suffix in ('.ts','.tsx') and p.name!='demo-data.ts'}
rows=[]
for method,route,source in sorted(set(endpoints),key=lambda x:(x[1],x[0])):
    # Literal references and dynamic entity maps need human review; never label these as working tests.
    stem=route.split('/:')[0]
    refs=[name for name,text in files.items() if stem in text]
    rows.append({'method':method,'path':route,'backend_file':source,'frontend_candidates':refs})
out=frontend/'docs/api-coverage.json';out.write_text(json.dumps(rows,indent=2)+'\n')
report=['# Backend API inventory and frontend review','',f'{len(rows)} active backend route declarations discovered. Generated with `python scripts/audit-api-coverage.py`.','',
'Candidate files are text references only: shared prefixes and dynamic entity maps require review. They do not prove an action exists, a payload is correct, or live integration passed. Webhooks are backend integrations, not cashier UI requirements.','',
'| Method | API path (under /api/v1) | Frontend candidate files |','| --- | --- | --- |']
for row in rows:
    refs=', '.join('`'+x.replace('src/features/','').replace('src/','')+'`' for x in row['frontend_candidates']) or '**Needs review / no literal reference**'
    report.append(f"| {row['method']} | `{row['path']}` | {refs} |")
(frontend/'docs/api-coverage.md').write_text('\n'.join(report)+'\n')
print(f'Inventoried {len(rows)} endpoints; {sum(not r["frontend_candidates"] for r in rows)} need reference review.')
for row in rows:
    if not row['frontend_candidates']:print(row['method'],row['path'])
