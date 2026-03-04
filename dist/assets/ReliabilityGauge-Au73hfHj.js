import{j as e}from"./motion-DMmWGCb4.js";import{r as m}from"./react-vendor-DfPuibdP.js";import{u as g}from"./index-DtjFUSNH.js";import{R as j,A as N,C as M,X as w,Y as C,T as _,d as B,e as A}from"./charts-COc1iTIi.js";const E=({data:s,claims:a,totalDuration:i})=>{const{t:r}=g(),[o,l]=m.useState(null),d=m.useMemo(()=>!s||!Array.isArray(s)?[]:s.map((t,n)=>{let c;t.event&&(c=a.find(y=>{var p,u;return y.quote.includes(((p=t.event)==null?void 0:p.substring(0,20))||"")||((u=t.event)==null?void 0:u.includes(y.quote.substring(0,20)))})),!c&&n<a.length&&(c=a[n]);const v=c?c.quote:t.event||r("analysis.timelineEvent");return{index:n,label:t.time,reliability:Math.round(t.reliability>1?t.reliability:t.reliability*100),event:v,isAnomaly:t.reliability<.4||t.reliability>.9,claim:c}}),[s,a]),h=({active:t,payload:n})=>{if(t&&n&&n.length){const c=n[0].payload;return e.jsxs("div",{className:"bg-[#252525] border border-[#968B74]/30 p-4 md:p-6 shadow-2xl max-w-[200px] md:max-w-xs",children:[e.jsxs("div",{className:"flex justify-between items-center mb-2 md:mb-4 border-b border-[#333] pb-2",children:[e.jsx("span",{className:"text-[8px] md:text-[10px] font-black uppercase tracking-widest text-[#968B74]",children:c.label}),e.jsxs("span",{className:"text-base md:text-xl font-black text-[#C4B091]",children:[c.reliability,"%"]})]}),e.jsxs("p",{className:"text-[10px] md:text-xs leading-relaxed font-medium text-[#ccc]",children:["„",c.event,"“"]})]})}return null};return!d||d.length===0?e.jsx("div",{className:"editorial-card p-6 md:p-12 border-l-4 border-l-[#968B74]",children:e.jsx("div",{className:"text-center py-12",children:e.jsx("p",{className:"text-[#666] text-sm font-medium",children:r("analysis.noChartData")})})}):e.jsxs("div",{className:"space-y-8 md:space-y-12",children:[e.jsxs("div",{className:"editorial-card p-6 md:p-12 border-l-4 border-l-[#968B74]",children:[e.jsxs("div",{className:"flex flex-col md:flex-row justify-between items-start md:items-end mb-8 md:mb-16 gap-6",children:[e.jsxs("div",{className:"text-center md:text-left w-full md:w-auto",children:[e.jsx("h3",{className:"text-[10px] md:text-[12px] font-extrabold text-[#968B74] uppercase tracking-[0.3em] md:tracking-[0.5em] mb-2 md:mb-3",children:r("analysis.chartOscilloscope")}),e.jsx("p",{className:"text-2xl md:text-4xl font-black uppercase tracking-tighter serif leading-none text-[#E0E0E0]",children:r("analysis.reliabilityDynamics")})]}),e.jsx("div",{className:"text-right hidden md:block",children:e.jsxs("div",{className:"flex gap-8",children:[e.jsxs("div",{className:"text-center",children:[e.jsx("p",{className:"text-[9px] font-black text-[#666] uppercase tracking-widest mb-1",children:r("analysis.maxStability")}),e.jsxs("p",{className:"text-xl font-black text-[#C4B091]",children:[Math.max(...d.map(t=>t.reliability),0),"%"]})]}),e.jsxs("div",{className:"text-center",children:[e.jsx("p",{className:"text-[9px] font-black text-[#666] uppercase tracking-widest mb-1",children:r("analysis.risks")}),e.jsx("p",{className:"text-xl font-black text-[#c66]",children:d.filter(t=>t.reliability<50).length})]})]})})]}),e.jsx("div",{className:"w-full min-h-[300px] h-[300px] md:h-[400px] relative",style:{minWidth:280},children:e.jsx(j,{width:"100%",height:"100%",minWidth:280,minHeight:280,children:e.jsxs(N,{data:d,onMouseMove:t=>t.activePayload&&l(t.activePayload[0].payload),onMouseLeave:()=>l(null),margin:{top:10,right:30,left:0,bottom:0},children:[e.jsx("defs",{children:e.jsxs("linearGradient",{id:"colorRel",x1:"0",y1:"0",x2:"0",y2:"1",children:[e.jsx("stop",{offset:"5%",stopColor:"#968B74",stopOpacity:.25}),e.jsx("stop",{offset:"95%",stopColor:"#968B74",stopOpacity:0})]})}),e.jsx(M,{strokeDasharray:"4 4",stroke:"#333",vertical:!1}),e.jsx(w,{dataKey:"label",hide:!0}),e.jsx(C,{domain:[0,100],orientation:"right",tick:{fontSize:8,fontWeight:"800",fill:"#888"},axisLine:!1,tickLine:!1}),e.jsx(_,{content:e.jsx(h,{}),cursor:{stroke:"#968B74",strokeWidth:1,strokeDasharray:"5 5"}}),e.jsx(B,{type:"monotone",dataKey:"reliability",stroke:"#C4B091",strokeWidth:3,fill:"url(#colorRel)",animationDuration:2e3,connectNulls:!0}),d.filter(t=>t.isAnomaly).map((t,n)=>e.jsx(A,{x:t.index,y:t.reliability,r:3,fill:t.reliability<50?"#8b4a4a":"#4a7c59",stroke:"#252525",strokeWidth:1},n))]})})}),e.jsxs("div",{className:"mt-6 md:mt-8 flex justify-between text-[9px] md:text-[11px] font-black text-[#666] uppercase tracking-[0.2em] md:tracking-[0.4em] border-t border-[#333] pt-4 md:pt-6",children:[e.jsxs("div",{className:"flex items-center gap-1 md:gap-2",children:[e.jsx("span",{className:"h-1.5 w-1.5 md:h-2 md:w-2 bg-[#968B74]"}),e.jsx("span",{children:r("analysis.start")})]}),e.jsxs("div",{className:"flex items-center gap-1 md:gap-2",children:[e.jsx("span",{className:"hidden md:inline",children:r("analysis.durationLabel")})," ",e.jsx("span",{children:i}),e.jsx("span",{className:"h-1.5 w-1.5 md:h-2 md:w-2 bg-[#968B74]"})]})]})]}),e.jsxs("div",{className:"editorial-card p-6 md:p-10 border-l-4 border-l-[#968B74] overflow-hidden relative",children:[e.jsx("h4",{className:"text-[9px] md:text-[11px] font-black uppercase tracking-[0.3em] md:tracking-[0.5em] text-[#968B74] mb-6 border-b border-[#333] pb-4",children:r("analysis.chronologicalRegister")}),e.jsx("div",{className:"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 max-h-[300px] md:max-h-[400px] overflow-y-auto pr-2 scroll-custom",children:d.map((t,n)=>e.jsxs("div",{className:`p-4 md:p-6 border border-[#333] transition-all cursor-default group hover:border-[#968B74]/40 ${(o==null?void 0:o.label)===t.label?"bg-[#252525] border-[#968B74]/50":"bg-[#252525]/50"}`,children:[e.jsxs("div",{className:"flex justify-between items-start mb-2 md:mb-4",children:[e.jsx("span",{className:"text-[9px] md:text-[10px] font-black text-[#968B74] tracking-tighter",children:t.label}),e.jsxs("span",{className:`text-[10px] md:text-xs font-black ${t.reliability<50?"text-[#c66]":"text-[#7cb87c]"}`,children:[t.reliability,"%"]})]}),e.jsx("p",{className:"text-[11px] md:text-[12px] leading-relaxed font-medium text-[#aaa] group-hover:text-[#ccc] transition-colors serif",children:t.event&&t.event.length>100?t.event.substring(0,100)+"...":t.event}),t.event&&t.event.length>100&&e.jsxs("p",{className:"text-[9px] text-[#666] mt-1 tracking-tight font-bold uppercase",children:["(",r("analysis.fullQuoteInClaimsTab"),")"]})]},n))})]}),e.jsx("style",{children:`
        .scroll-custom::-webkit-scrollbar { width: 3px; }
        .scroll-custom::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); }
        .scroll-custom::-webkit-scrollbar-thumb { background: #968B74; border-radius: 10px; }
      `})]})},xe=m.memo(E);/**
 * @license lucide-react v0.575.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const k=(...s)=>s.filter((a,i,r)=>!!a&&a.trim()!==""&&r.indexOf(a)===i).join(" ").trim();/**
 * @license lucide-react v0.575.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const T=s=>s.replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase();/**
 * @license lucide-react v0.575.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const L=s=>s.replace(/^([A-Z])|[\s-_]+(\w)/g,(a,i,r)=>r?r.toUpperCase():i.toLowerCase());/**
 * @license lucide-react v0.575.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const b=s=>{const a=L(s);return a.charAt(0).toUpperCase()+a.slice(1)};/**
 * @license lucide-react v0.575.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */var R={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"};/**
 * @license lucide-react v0.575.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const $=s=>{for(const a in s)if(a.startsWith("aria-")||a==="role"||a==="title")return!0;return!1};/**
 * @license lucide-react v0.575.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const V=m.forwardRef(({color:s="currentColor",size:a=24,strokeWidth:i=2,absoluteStrokeWidth:r,className:o="",children:l,iconNode:d,...h},t)=>m.createElement("svg",{ref:t,...R,width:a,height:a,stroke:s,strokeWidth:r?Number(i)*24/Number(a):i,className:k("lucide",o),...!l&&!$(h)&&{"aria-hidden":"true"},...h},[...d.map(([n,c])=>m.createElement(n,c)),...Array.isArray(l)?l:[l]]));/**
 * @license lucide-react v0.575.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const x=(s,a)=>{const i=m.forwardRef(({className:r,...o},l)=>m.createElement(V,{ref:l,iconNode:a,className:k(`lucide-${T(b(s))}`,`lucide-${s}`,r),...o}));return i.displayName=b(s),i};/**
 * @license lucide-react v0.575.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const I=[["path",{d:"M12 18V5",key:"adv99a"}],["path",{d:"M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4",key:"1e3is1"}],["path",{d:"M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5",key:"1gqd8o"}],["path",{d:"M17.997 5.125a4 4 0 0 1 2.526 5.77",key:"iwvgf7"}],["path",{d:"M18 18a4 4 0 0 0 2-7.464",key:"efp6ie"}],["path",{d:"M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517",key:"1gq6am"}],["path",{d:"M6 18a4 4 0 0 1-2-7.464",key:"k1g0md"}],["path",{d:"M6.003 5.125a4 4 0 0 0-2.526 5.77",key:"q97ue3"}]],S=x("brain",I);/**
 * @license lucide-react v0.575.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const D=[["path",{d:"M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0",key:"1nclc0"}],["circle",{cx:"12",cy:"12",r:"3",key:"1v7zrd"}]],U=x("eye",D);/**
 * @license lucide-react v0.575.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const F=[["path",{d:"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z",key:"1oefj6"}],["path",{d:"M14 2v5a1 1 0 0 0 1 1h5",key:"wfsgrz"}],["path",{d:"M10 9H8",key:"b1mrlr"}],["path",{d:"M16 13H8",key:"t4e002"}],["path",{d:"M16 17H8",key:"z1uh3a"}]],H=x("file-text",F);/**
 * @license lucide-react v0.575.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const W=[["path",{d:"M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2",key:"1fvzgz"}],["path",{d:"M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2",key:"1kc0my"}],["path",{d:"M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8",key:"10h0bg"}],["path",{d:"M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15",key:"1s1gnw"}]],q=x("hand",W);/**
 * @license lucide-react v0.575.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Y=[["path",{d:"M10 18v-7",key:"wt116b"}],["path",{d:"M11.12 2.198a2 2 0 0 1 1.76.006l7.866 3.847c.476.233.31.949-.22.949H3.474c-.53 0-.695-.716-.22-.949z",key:"1m329m"}],["path",{d:"M14 18v-7",key:"vav6t3"}],["path",{d:"M18 18v-7",key:"aexdmj"}],["path",{d:"M3 22h18",key:"8prr45"}],["path",{d:"M6 18v-7",key:"1ivflk"}]],K=x("landmark",Y);/**
 * @license lucide-react v0.575.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const O=[["rect",{width:"7",height:"9",x:"3",y:"3",rx:"1",key:"10lvy0"}],["rect",{width:"7",height:"5",x:"14",y:"3",rx:"1",key:"16une8"}],["rect",{width:"7",height:"9",x:"14",y:"12",rx:"1",key:"1hutg5"}],["rect",{width:"7",height:"5",x:"3",y:"16",rx:"1",key:"ldoo1y"}]],P=x("layout-dashboard",O);/**
 * @license lucide-react v0.575.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const G=[["path",{d:"M14 14a2 2 0 0 0 2-2V8h-2",key:"1r06pg"}],["path",{d:"M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z",key:"18887p"}],["path",{d:"M8 14a2 2 0 0 0 2-2V8H8",key:"1jzu5j"}]],Q=x("message-square-quote",G);/**
 * @license lucide-react v0.575.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const X=[["path",{d:"M12 19v3",key:"npa21l"}],["path",{d:"M19 10v2a7 7 0 0 1-14 0v-2",key:"1vc78b"}],["rect",{x:"9",y:"2",width:"6",height:"13",rx:"3",key:"s6n7sd"}]],z=x("mic",X);/**
 * @license lucide-react v0.575.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Z=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M8 14s1.5 2 4 2 4-2 4-2",key:"1y1vjs"}],["line",{x1:"9",x2:"9.01",y1:"9",y2:"9",key:"yxxnd0"}],["line",{x1:"15",x2:"15.01",y1:"9",y2:"9",key:"1p4y9e"}]],J=x("smile",Z);/**
 * @license lucide-react v0.575.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ee=[["path",{d:"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2",key:"975kel"}],["circle",{cx:"12",cy:"7",r:"4",key:"17ys0d"}]],te=x("user",ee);/**
 * @license lucide-react v0.575.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ae=[["path",{d:"M18 11c-1.5 0-2.5.5-3 2",key:"1fod00"}],["path",{d:"M4 6a2 2 0 0 0-2 2v4a5 5 0 0 0 5 5 8 8 0 0 1 5 2 8 8 0 0 1 5-2 5 5 0 0 0 5-5V8a2 2 0 0 0-2-2h-3a8 8 0 0 0-5 2 8 8 0 0 0-5-2z",key:"d70hit"}],["path",{d:"M6 11c1.5 0 2.5.5 3 2",key:"136fht"}]],se=x("venetian-mask",ae),re={summary:P,claims:Q,manipulation:q,report:H,visual:U,bodyLanguage:te,vocal:z,deception:se,humor:J,psychological:S,cultural:K},ie=({id:s,className:a="w-4 h-4 shrink-0"})=>{const i=re[s];return i?e.jsx(i,{className:a,strokeWidth:1.75}):null},me=({id:s,className:a})=>e.jsx(ie,{id:s,className:a??"w-5 h-5 shrink-0 text-[#968B74]"}),f={TRUE:"analysis.verdictTrue",MOSTLY_TRUE:"analysis.verdictMostlyTrue",MIXED:"analysis.verdictMixed",MOSTLY_FALSE:"analysis.verdictMostlyFalse",FALSE:"analysis.verdictFalse",UNVERIFIABLE:"analysis.verdictUnverifiable"},le={вярно:"analysis.verdictTrue","предимно вярно":"analysis.verdictMostlyTrue","частично вярно":"analysis.verdictMixed",подвеждащо:"analysis.verdictMostlyFalse",невярно:"analysis.verdictFalse",непроверимо:"analysis.verdictUnverifiable",true:"analysis.verdictTrue","mostly true":"analysis.verdictMostlyTrue","partially true":"analysis.verdictMixed",misleading:"analysis.verdictMostlyFalse",false:"analysis.verdictFalse",unverifiable:"analysis.verdictUnverifiable"};function he(s){var i,r;const a=(r=(i=s.verdict)==null?void 0:i.toUpperCase)==null?void 0:r.call(i);return a&&a in f?f[a]:le[s.veracity||""]||"analysis.verdictUnverifiable"}const ye=({score:s,size:a=180})=>{const i=Math.round(s*100),r=12,o=(a-r)/2,l=2*Math.PI*o,d=l-i/100*l,h=t=>t>=.8?"#047857":t>=.6?"#059669":t>=.4?"#d97706":t>=.2?"#ea580c":"#991b1b";return e.jsxs("div",{className:"relative flex items-center justify-center",style:{width:a,height:a},children:[e.jsxs("svg",{width:a,height:a,className:"transform -rotate-90",children:[e.jsx("circle",{cx:a/2,cy:a/2,r:o,stroke:"#333",strokeWidth:r,fill:"transparent"}),e.jsx("circle",{cx:a/2,cy:a/2,r:o,stroke:h(s),strokeWidth:r,fill:"transparent",strokeDasharray:l,strokeDashoffset:d,strokeLinecap:"round",className:"transition-all duration-1000 ease-out"})]}),e.jsxs("div",{className:"absolute flex flex-col items-center justify-center",children:[e.jsxs("span",{className:"text-4xl font-black text-[#C4B091] tracking-tighter serif",children:[i,"%"]}),e.jsx("span",{className:"text-[8px] font-black text-[#666] uppercase tracking-widest mt-1",children:"Достоверност"})]})]})};export{xe as R,me as S,ie as T,ye as a,he as g};
