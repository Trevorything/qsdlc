/* html-motion engine: shader. A full-surface flowing field with optional contour lines (WebGL fragment shader).
 * GPU, PURE function of time (drawAt(t) is exact). One heavy engine per page; at most one decorative layer.
 * Without WebGL, on a shader error or a lost context the canvas gets a still gradient built from the tokens
 * (data-fallback="still"). The governor halves resolution, then freezes, on a slow machine.
 * Engines.shader(canvas, { W, H, ...options })
 * Options:
 *   speed .25      field drift rate (live)
 *   scale 2.4      feature size: higher = more, smaller swirls (live)
 *   lines 10       contour levels; 0 = no contour lines (live)
 *   lineAlpha .4   contour strength 0..1 (live)
 *   quality 1      resolution multiplier on top of DPR (use .6 or less for always-on pages)
 *   still 6        the time (s) painted under reduced motion
 * Colours: --bg --surface --hi --alt --line (read every frame).
 */
(function () {
  var core = Engines.core;
  var VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  var FS = 'precision mediump float;uniform vec2 r;uniform float t,sc,lv,la;uniform vec3 cb,cs,ch,ca,cl;' +
    'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}' +
    'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}' +
    'float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return s;}' +
    'void main(){vec2 u=gl_FragCoord.xy/r;u.x*=r.x/r.y;vec2 p=u*sc;' +
    'vec2 q=vec2(fbm(p+t*.7),fbm(p+vec2(5.2,1.3)-t*.5));float v=fbm(p+2.*q+t*.3);' +
    'vec3 c=mix(cb,cs,smoothstep(.2,.6,v));c=mix(c,ch,smoothstep(.5,.85,v)*.65);c=mix(c,ca,smoothstep(.55,.95,q.x*q.y*2.)*.3);' +
    'if(lv>.5){float l=smoothstep(.43,.5,abs(fract(v*lv)-.5));c=mix(c,cl,l*la);}' +
    'gl_FragColor=vec4(c,1.);}';
  Engines.shader = function (canvas, o) {
    o = o || {};
    return core.make(canvas, o, {
      pure: true, gpu: true, gl: true,
      init: function (gl, e, s) {
        s.p = core.gl.program(gl, VS, FS, ['a']);
        s.b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, s.b);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        s.u = {}; ['r', 't', 'sc', 'lv', 'la', 'cb', 'cs', 'ch', 'ca', 'cl'].forEach(function (k) { s.u[k] = gl.getUniformLocation(s.p, k); });
      },
      draw: function (gl, e, s) {
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.useProgram(s.p); gl.bindBuffer(gl.ARRAY_BUFFER, s.b);
        gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        var u = s.u;
        gl.uniform2f(u.r, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.uniform1f(u.t, e.t * (o.speed == null ? .25 : o.speed));
        gl.uniform1f(u.sc, o.scale || 2.4); gl.uniform1f(u.lv, o.lines == null ? 10 : o.lines); gl.uniform1f(u.la, o.lineAlpha == null ? .4 : o.lineAlpha);
        gl.uniform3fv(u.cb, e.f('--bg')); gl.uniform3fv(u.cs, e.f('--surface')); gl.uniform3fv(u.ch, e.f('--hi'));
        gl.uniform3fv(u.ca, e.f('--alt')); gl.uniform3fv(u.cl, e.f('--line'));
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
      destroy: function () {}
    });
  };
})();
