import urllib.request
urls=['http://localhost:8000/','http://localhost:8000/viewer.js','http://localhost:8000/bench_1/manifest.json']
for u in urls:
    try:
        with urllib.request.urlopen(u, timeout=10) as r:
            b=r.read()
            print(u, '->', r.status, len(b))
    except Exception as e:
        print(u, '-> ERROR', e)
