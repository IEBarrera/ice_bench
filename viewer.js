// Minimal molecular viewer: bench selectors + QR, fullscreen canvas, improved PBR render
// Single, self-contained file that reads bench_1/manifest.json and loads paired .xyz files.

document.addEventListener('DOMContentLoaded', ()=>{
  const canvasContainer = document.getElementById('canvasContainer');
  const benchCategory = document.getElementById('benchCategory');
  const benchSystem = document.getElementById('benchSystem');
  const benchLoadBtn = document.getElementById('benchLoadBtn');
  const genQrBtn = document.getElementById('genQrBtn');
  const outUrl = document.getElementById('outUrl');
  const qrcodeEl = document.getElementById('qrcode');

  let scene, camera, renderer, controls, atomGroup;
   let lastBMaterials = [];

  const BG_COLOR = 0x08101a;
  const GLOBAL_SATURATION = 3.5;
  // User-specified saturated palette: O red, H white, C black, N blue (NH3 blue), others saturated defaults
  const elementColors = {
    H: 0xffffff, // Hydrogen -> white
    C: 0x111111, // Carbon -> black
    N: 0x0033ff, // Nitrogen -> saturated blue
    O: 0xff0000, // Oxygen -> red
    S: 0xffd86b,
    P: 0xffa966,
    F: 0x00cc66,
    Cl: 0x00cc66,
    Default: 0x9aa6b2
  };
  // atomic radii (Å) used for sphere sizes and bonding thresholds
  const atomicRad = { H:0.53, C:0.70, N:0.65, O:0.60, S:1.04, P:1.00, F:0.57, Cl:0.99 };
  // scale factor to make spheres visually larger on screen
  const ATOM_SCALE = 1.0;

  function initThree(){
    if(renderer) return;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(BG_COLOR);
    camera = new THREE.PerspectiveCamera(50, window.innerWidth/window.innerHeight, 0.1, 2000);
    camera.position.set(0,0,60);
    renderer = new THREE.WebGLRenderer({antialias:true, physicallyCorrectLights:true});
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputEncoding = THREE.sRGBEncoding;
    canvasContainer.appendChild(renderer.domElement);

    try{ controls = new THREE.OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = 0.08; }catch(e){ console.warn('OrbitControls not available', e); }

  const hemi = new THREE.HemisphereLight(0xffffff, 0x080820, 0.9); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 0.6); key.position.set(5,10,7); scene.add(key);
  // small ambient to lift shadows and favor diffuse appearance
  const amb = new THREE.AmbientLight(0xffffff, 0.12); scene.add(amb);

    atomGroup = new THREE.Group(); scene.add(atomGroup);

    window.addEventListener('resize', ()=>{ if(!camera||!renderer) return; camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });
    animate();
  }

  function animate(){ requestAnimationFrame(animate); if(controls) controls.update(); renderer.render(scene, camera); }

  function clearScene(){ if(!atomGroup) return; while(atomGroup.children.length) atomGroup.remove(atomGroup.children[0]); }

  function normalizeElement(sym){ if(!sym) return sym; sym = sym.trim(); if(/^[0-9]+$/.test(sym)) return null; return sym.charAt(0).toUpperCase()+sym.slice(1).toLowerCase(); }

  function parseXYZWithDiag(text){
    const lines = text.replace(/\r/g,'').split('\n'); let start=0; const diag={totalLines:lines.length, skipped:0}; const trimmed = lines.map(l=>l.trim()).filter(l=>l.length>0);
    if(trimmed.length===0) return {atoms:[],diag};
    if(/^[0-9]+$/.test(trimmed[0])){
      let nonEmptySeen=0;
      for(let i=0;i<lines.length;i++){
        if(lines[i].trim().length===0) continue;
        nonEmptySeen++;
        if(nonEmptySeen===2){
          const tokens = lines[i].trim().split(/\s+/);
          let looksLikeAtom = false;
          if(tokens.length>=4){
            const maybeX = parseFloat(tokens[1]);
            const maybeY = parseFloat(tokens[2]);
            const maybeZ = parseFloat(tokens[3]);
            if(Number.isFinite(maybeX) && Number.isFinite(maybeY) && Number.isFinite(maybeZ)) looksLikeAtom = true;
          }
          start = looksLikeAtom ? i : i+1;
          break;
        }
      }
    } else {
      for(let i=0;i<lines.length;i++) if(lines[i].trim().length>0){ start=i; break; }
    }
    const atoms = [];
    for(let i=start;i<lines.length;i++){
      const raw = lines[i].trim(); if(raw.length===0) continue;
      const parts = raw.split(/\s+/);
      let elToken = parts[0]; let idxOffset = 0;
      if(parts.length>=5 && /^[0-9]+$/.test(parts[0])){ elToken = parts[1]; idxOffset = 1; }
      const x = parseFloat(parts[1+idxOffset]); const y = parseFloat(parts[2+idxOffset]); const z = parseFloat(parts[3+idxOffset]);
      const el = normalizeElement(elToken);
      if(el===null || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)){ diag.skipped++; continue; }
      atoms.push({el,x,y,z});
    }
    diag.parsed = atoms.length; return {atoms,diag};
  }

  function sphereMesh(el,x,y,z){
    const base = (atomicRad[el]||0.7);
    const radius = Math.max(0.08, base * ATOM_SCALE);
  const geo = new THREE.SphereGeometry(radius, 36, 24);
    const color = elementColors[el]||0x8b8f95;
    // Use MeshPhysicalMaterial with transmission/thickness to approximate subsurface scattering
    const mat = new THREE.MeshPhysicalMaterial({
      color: color,
      metalness: 0.0,
      roughness: 0.9,
      envMapIntensity: 0.0,
      transmission: 0.55, // how much light passes through (0..1)
      thickness: radius * 1.4, // approximate object thickness for attenuation
      attenuationDistance: Math.max(0.1, radius * 2.0),
      attenuationColor: new THREE.Color(color).multiplyScalar(0.9),
      clearcoat: 0.0
    });
    const m = new THREE.Mesh(geo,mat);
    m.position.set(x,y,z);
    return m;
  }
  function cylinderBetween(a,b, radius=0.08){ const v1=new THREE.Vector3(a.x,a.y,a.z); const v2=new THREE.Vector3(b.x,b.y,b.z); const dir=new THREE.Vector3().subVectors(v2,v1); const len=dir.length(); const mid=new THREE.Vector3().addVectors(v1,v2).multiplyScalar(0.5); const geo=new THREE.CylinderGeometry(radius,radius,len,12); const mat=new THREE.MeshStandardMaterial({color:0x9aa6b2, metalness:0.0, roughness:1.0, envMapIntensity:0.0}); const mesh=new THREE.Mesh(geo,mat); mesh.position.copy(mid); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir.clone().normalize()); return mesh; }

  function computeRMSD(aAtoms,bAtoms){ const n=Math.min(aAtoms.length,bAtoms.length); if(n===0) return NaN; let sum=0; for(let i=0;i<n;i++){ const dx=aAtoms[i].x-bAtoms[i].x; const dy=aAtoms[i].y-bAtoms[i].y; const dz=aAtoms[i].z-bAtoms[i].z; sum+=dx*dx+dy*dy+dz*dz; } return Math.sqrt(sum/n); }

  function renderBoth(aAtoms,bAtoms){ initThree(); clearScene(); if(!atomGroup){ atomGroup=new THREE.Group(); scene.add(atomGroup); }
     const groupA=new THREE.Group(); const groupB=new THREE.Group(); lastBMaterials = [];
    for(const a of aAtoms) groupA.add(sphereMesh(a.el,a.x,a.y,a.z));
  for(const b of bAtoms){
      // base element color (keep similarity to original but lighter)
      const base = elementColors[b.el] || 0x8b8f95;
      const lightCol = new THREE.Color(base).lerp(new THREE.Color(0xffffff), 0.5);
      const m = sphereMesh(b.el,b.x,b.y,b.z);
      m.material = m.material.clone();
      m.material.color = lightCol;
      m.material.opacity = 0.58;
      m.material.transparent = true;
      // help with sorting of transparent objects
      m.material.depthWrite = false;
      m.material.dithering = true;
      // inject a small ordered Bayer dither into the material shader
      // create an injectable onBeforeCompile function per-material so we can toggle it later
      const makeInject = (mat)=>{
        return function(shader){
          // Bayer 4x4 dither table and init function
          const bayerInit = '\nfloat bayer4[16];\nvoid initBayer(){\n  bayer4[0]=0.0/16.0; bayer4[1]=8.0/16.0; bayer4[2]=2.0/16.0; bayer4[3]=10.0/16.0;\n  bayer4[4]=12.0/16.0; bayer4[5]=4.0/16.0; bayer4[6]=14.0/16.0; bayer4[7]=6.0/16.0;\n  bayer4[8]=3.0/16.0; bayer4[9]=11.0/16.0; bayer4[10]=1.0/16.0; bayer4[11]=9.0/16.0;\n  bayer4[12]=15.0/16.0; bayer4[13]=7.0/16.0; bayer4[14]=13.0/16.0; bayer4[15]=5.0/16.0;\n}\n';
          // prepend bayer table and insert a discard-based dither right before the final output include
          shader.fragmentShader = bayerInit + shader.fragmentShader;
          // Insert our code before the output_fragment include so it runs after lighting/outgoingLight is computed
          const insertBefore = '\n\t#include <output_fragment>';
          const ditherSnippet = "\n\t// BEGIN_BAYER_DITHER_INJECTION\n\tinitBayer(); vec2 _p = gl_FragCoord.xy; int _ix = int(mod(floor(_p.x), 4.0)); int _iy = int(mod(floor(_p.y), 4.0)); int _idx = _iy * 4 + _ix; float _th = bayer4[_idx]; float _lum = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722)); if(_lum < _th) discard;\n\t// END_BAYER_DITHER_INJECTION\n";
          if(shader.fragmentShader.indexOf(insertBefore)!==-1){
            shader.fragmentShader = shader.fragmentShader.replace(insertBefore, ditherSnippet + insertBefore);
          } else {
            // fallback: append at end so it's still present
            shader.fragmentShader = shader.fragmentShader + '\n// FALLBACK_BAYER_DITHER\n' + ditherSnippet;
          }
          // store the injected fragment shader for debugging
          try{ mat.userData.injectedFragmentSource = shader.fragmentShader; }catch(e){}
        };
      };
      const injectFn = makeInject(m.material);
      // keep a reference so toggle can enable/disable the injection
      m.material.userData = m.material.userData || {};
      m.material.userData.injectFn = injectFn;
      m.material.userData.injectedFragmentSource = null;
      // create saturation injector and store it
      const makeSatInject = (mat, sat)=>{
        return function(shader){
          shader.uniforms = shader.uniforms || {};
          shader.uniforms.uSaturation = shader.uniforms.uSaturation || { value: sat };
            // ensure the GLSL uniform is declared so the shader compiles
            if(shader.fragmentShader.indexOf('uniform float uSaturation')===-1){
              shader.fragmentShader = 'uniform float uSaturation;\n' + shader.fragmentShader;
            }
          const satCode = "\n\t// BEGIN_SATURATION_INJECTION\n\tfloat _lumForSat = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));\n\toutgoingLight = mix(vec3(_lumForSat), outgoingLight, uSaturation);\n\t// END_SATURATION_INJECTION\n";
          if(shader.fragmentShader.indexOf('\n\t#include <output_fragment>')!==-1){
            shader.fragmentShader = shader.fragmentShader.replace('\n\t#include <output_fragment>', satCode + '\n\t#include <output_fragment>');
          } else if(shader.fragmentShader.indexOf('#include <output_fragment>')!==-1){
            shader.fragmentShader = shader.fragmentShader.replace('#include <output_fragment>', satCode + '#include <output_fragment>');
          } else {
            shader.fragmentShader = shader.fragmentShader + '\n// FALLBACK_SATURATION\n' + satCode;
          }
          try{ mat.userData.injectedFragmentSource = shader.fragmentShader; }catch(e){}
        };
      };
      const satInject = makeSatInject(m.material, GLOBAL_SATURATION);
      m.material.userData.satInjectFn = satInject;
      // compose both injections: saturation always, dither optional
      m.material.onBeforeCompile = function(shader){
        satInject(shader);
        if(ditherToggle && ditherToggle.checked && injectFn) injectFn(shader);
      };
      // track B materials so the dump button can inspect them
      lastBMaterials.push(m.material);
      groupB.add(m);
    }
    // Attach saturation injector to groupA materials as well
    for(const child of groupA.children){
      if(child && child.material){
        child.material.userData = child.material.userData || {};
        const satInjectA = function(shader){
          shader.uniforms = shader.uniforms || {};
          shader.uniforms.uSaturation = shader.uniforms.uSaturation || { value: GLOBAL_SATURATION };
          if(shader.fragmentShader.indexOf('uniform float uSaturation')===-1){
            shader.fragmentShader = 'uniform float uSaturation;\n' + shader.fragmentShader;
          }
          const satCode = "\n\t// BEGIN_SATURATION_INJECTION\n\tfloat _lumForSat = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));\n\toutgoingLight = mix(vec3(_lumForSat), outgoingLight, uSaturation);\n\t// END_SATURATION_INJECTION\n";
          if(shader.fragmentShader.indexOf('\n\t#include <output_fragment>')!==-1){
            shader.fragmentShader = shader.fragmentShader.replace('\n\t#include <output_fragment>', satCode + '\n\t#include <output_fragment>');
          } else if(shader.fragmentShader.indexOf('#include <output_fragment>')!==-1){
            shader.fragmentShader = shader.fragmentShader.replace('#include <output_fragment>', satCode + '#include <output_fragment>');
          } else {
            shader.fragmentShader = shader.fragmentShader + '\n// FALLBACK_SATURATION\n' + satCode;
          }
        };
        child.material.userData.satInjectFn = satInjectA;
        child.material.onBeforeCompile = satInjectA;
      }
    }
    atomGroup.add(groupA); atomGroup.add(groupB);
    // bonds (simple threshold by covalent radii)
    for(let i=0;i<aAtoms.length;i++){
      for(let j=i+1;j<aAtoms.length;j++){
        const a=aAtoms[i], c=aAtoms[j]; const dx=a.x-c.x, dy=a.y-c.y, dz=a.z-c.z; const d=Math.sqrt(dx*dx+dy*dy+dz*dz);
  const r1=atomicRad[a.el]||0.7, r2=atomicRad[c.el]||0.7; const threshold=r1+r2+0.45; if(d>0.1 && d<threshold) atomGroup.add(cylinderBetween(a,c,0.06));
      }
    }
    // connection lines between corresponding atoms of A and B
    const n = Math.min(aAtoms.length,bAtoms.length);
    if(n>0){ const positions = new Float32Array(n*2*3); let p=0; for(let i=0;i<n;i++){ positions[p++]=aAtoms[i].x; positions[p++]=aAtoms[i].y; positions[p++]=aAtoms[i].z; positions[p++]=bAtoms[i].x; positions[p++]=bAtoms[i].y; positions[p++]=bAtoms[i].z; } const geom=new THREE.BufferGeometry(); geom.setAttribute('position', new THREE.BufferAttribute(positions,3)); const mat = new THREE.LineBasicMaterial({color:0xff88ff, transparent:true, opacity:0.6}); atomGroup.add(new THREE.LineSegments(geom, mat)); }
    const box = new THREE.Box3().setFromObject(atomGroup); const center = box.getCenter(new THREE.Vector3()); atomGroup.position.sub(center); const size = box.getSize(new THREE.Vector3()).length(); camera.position.set(0,0,Math.max(12, size*1.4)); if(controls) controls.target.set(0,0,0); const rmsd = computeRMSD(aAtoms,bAtoms); console.log('RMSD (no align)=', rmsd);
    // attempt to compile B materials so onBeforeCompile runs and we can inspect injected shader
    try{
      if(renderer && lastBMaterials && lastBMaterials.length>0){
        // ask renderer to compile one of the materials (this will trigger onBeforeCompile)
        renderer.compile(scene, camera);
        // after compile, log any injected sources saved on material.userData
        for(let i=0;i<lastBMaterials.length;i++){
          const mm = lastBMaterials[i];
          if(mm && mm.userData && mm.userData.injectedFragmentSource){
            console.log('Auto-dumped injected fragment shader for B material', i, mm.userData.injectedFragmentSource.substring(0,2000));
            break;
          }
        }
      }
    }catch(e){ console.warn('Auto shader compile/dump failed', e); }
  }

  // manifest-driven UI
  let benchManifest = null;
  function loadBenchManifest(){ fetch('bench_1/manifest.json').then(r=>r.json()).then(j=>{ benchManifest=j; benchCategory.innerHTML='<option value="">-- Categoria --</option>'; Object.keys(j).forEach(cat=>{ const o=document.createElement('option'); o.value=cat; o.textContent=cat; benchCategory.appendChild(o); }); }).catch(e=>{ console.warn('No manifest',e); }); }

  benchCategory.addEventListener('change', ()=>{ benchSystem.innerHTML='<option value="">-- Sistema --</option>'; const cat=benchCategory.value; if(!cat||!benchManifest) return; Object.keys(benchManifest[cat]).forEach(sys=>{ const o=document.createElement('option'); o.value=sys; o.textContent=sys; benchSystem.appendChild(o); }); });

  benchLoadBtn.addEventListener('click', ()=>{ const cat=benchCategory.value; const sys=benchSystem.value; if(!cat||!sys){ alert('Selecciona categoria y sistema'); return; } const pair = benchManifest?.[cat]?.[sys]; if(!pair||pair.length<2){ alert('No hay archivos para este sistema'); return; } Promise.all(pair.map(p=>fetch(p).then(r=>r.text()))).then(([aTxt,bTxt])=>{ const a=parseXYZWithDiag(aTxt).atoms; const b=parseXYZWithDiag(bTxt).atoms; renderBoth(a,b); const url = window.location.origin + window.location.pathname + '?bench=' + encodeURIComponent(cat+'/'+sys); outUrl.value = url; }).catch(e=>{ console.error(e); alert('Error cargando archivos: '+e); }); });

  genQrBtn.addEventListener('click', ()=>{ const url = outUrl.value || (window.location.origin + window.location.pathname + (benchCategory.value?('?bench='+encodeURIComponent(benchCategory.value+'/'+benchSystem.value)) : '')); if(!url) return alert('Genera o selecciona un sistema primero'); qrcodeEl.innerHTML=''; new QRCode(qrcodeEl, {text:url,width:128,height:128}); });

  (function handleParams(){ const params=new URLSearchParams(window.location.search); if(params.has('bench')){ const v=params.get('bench'); const [cat,sys] = v.split('/'); loadBenchManifest(); setTimeout(()=>{ if(cat) benchCategory.value=cat; benchCategory.dispatchEvent(new Event('change')); setTimeout(()=>{ if(sys) benchSystem.value=sys; benchLoadBtn.click(); }, 400); }, 300); } else { loadBenchManifest(); } })();

  // UI helpers: toggle dither on/off and dump compiled shader
  const ditherToggle = document.getElementById('ditherToggle');
  if(ditherToggle){
    ditherToggle.addEventListener('change', ()=>{
      // force re-render: re-run last loaded system by simulating click if any
      // simpler: set needsUpdate on stored materials
      for(const mat of lastBMaterials) if(mat) mat.needsUpdate = true;
    });
  }
  const dumpBtn = document.getElementById('dumpShaderBtn');
  if(dumpBtn){
    dumpBtn.addEventListener('click', ()=>{
      // Attempt to print the compiled fragment shader source for the first B material
      if(!lastBMaterials || lastBMaterials.length===0) return console.warn('No B materials present yet — load a system first');
      const mat = lastBMaterials[0];
      try{
        // Prefer the injected source captured during onBeforeCompile
        if(mat.userData && mat.userData.injectedFragmentSource){
          console.log('Injected fragment shader source (captured):\n', mat.userData.injectedFragmentSource);
          return;
        }
        // Next, try renderer.properties to find the compiled program if available
        const props = renderer.properties.get(mat);
        if(props && props.program && props.program.fragmentShader){
          console.log('Compiled fragment shader (from renderer.properties):\n', props.program.fragmentShader);
          return;
        }
        console.log('No injected source or compiled shader available yet. Try toggling the Dither checkbox or re-loading the system to force recompile.');
      }catch(e){ console.warn('Could not dump shader:', e); }
    });
  }

  function makeViewerUrl(mode, textOrUrl){ if(mode==='embed'){ const b = btoa(unescape(encodeURIComponent(textOrUrl))); return window.location.origin + window.location.pathname + '?data=' + b; } return textOrUrl; }
  function b64DecodeUnicode(str){ try{ return decodeURIComponent(Array.prototype.map.call(atob(str), function(c){ return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2); }).join('')); }catch(e){ return atob(str); } }

  // initialize
  initThree();
});
