import { useState, useRef, useEffect, useCallback } from "react";
import { chatAPI } from "../services/api";
import { v4 as uuidv4 } from "uuid";

/* ─── Fonts ─────────────────────────────────────────────────────────────── */
const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap";
document.head.appendChild(fontLink);

/* ─── Animations + theme tokens ──────────────────────────────────────────────
   Colors are CSS custom properties, flipped by the SAME `dark` class
   ThemeContext already toggles on <html> for the rest of the app — so this
   widget follows the app's light/dark switch instead of always being dark. */
const styleEl = document.createElement("style");
styleEl.textContent = `
  :root {
    --cx-panel: #ffffff;
    --cx-glass: rgba(0,0,0,.025);
    --cx-border: rgba(0,0,0,.09);
    --cx-accent: #2B6CB0;
    --cx-purple: #805AD5;
    --cx-green: #2F855A;
    --cx-txt-pri: #1A202C;
    --cx-txt-sec: rgba(26,32,44,.62);
    --cx-txt-mut: rgba(26,32,44,.4);
    --cx-scrollbar-thumb: rgba(0,0,0,.14);
    --cx-scrollbar-thumb-hover: rgba(0,0,0,.22);
    --cx-placeholder: rgba(26,32,44,.32);
    --cx-icon-hover-bg: rgba(0,0,0,.05);
    --cx-icon-hover-color: rgba(26,32,44,.8);
    --cx-msg-bg: #F7F9FC;
    --cx-msg-shadow: 0 2px 10px rgba(15,23,42,.08);
    --cx-input-bg: #F7F9FC;
    --cx-input-border-focus: rgba(43,108,176,.4);
    --cx-send-idle-bg: rgba(0,0,0,.06);
    --cx-panel-shadow: 0 24px 60px rgba(15,23,42,.18), 0 0 0 1px rgba(0,0,0,.04) inset;
    --cx-code-bg: rgba(43,108,176,.1);
    --cx-error-bg: rgba(220,38,38,.06);
    --cx-error-border: rgba(220,38,38,.25);
  }
  html.dark {
    --cx-panel: #161920;
    --cx-glass: rgba(255,255,255,.03);
    --cx-border: rgba(255,255,255,.07);
    --cx-accent: #63B3ED;
    --cx-purple: #B794F4;
    --cx-green: #68D391;
    --cx-txt-pri: #F0F4FF;
    --cx-txt-sec: rgba(240,244,255,.55);
    --cx-txt-mut: rgba(240,244,255,.28);
    --cx-scrollbar-thumb: rgba(255,255,255,.08);
    --cx-scrollbar-thumb-hover: rgba(255,255,255,.16);
    --cx-placeholder: rgba(255,255,255,.28);
    --cx-icon-hover-bg: rgba(255,255,255,.06);
    --cx-icon-hover-color: rgba(240,244,255,.7);
    --cx-msg-bg: rgba(255,255,255,.04);
    --cx-msg-shadow: 0 2px 10px rgba(0,0,0,.2);
    --cx-input-bg: rgba(255,255,255,.04);
    --cx-input-border-focus: rgba(99,179,237,.35);
    --cx-send-idle-bg: rgba(255,255,255,.06);
    --cx-panel-shadow: 0 32px 80px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.05) inset, 0 1px 0 rgba(255,255,255,.08) inset;
    --cx-code-bg: rgba(99,179,237,.12);
    --cx-error-bg: rgba(252,129,129,.07);
    --cx-error-border: rgba(252,129,129,.2);
  }

  @keyframes cxSlideUp    { from{opacity:0;transform:translateY(24px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes cxFadeIn     { from{opacity:0} to{opacity:1} }
  @keyframes cxMsgIn      { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes cxTyping     { 0%,80%,100%{transform:scale(0);opacity:.4} 40%{transform:scale(1);opacity:1} }
  @keyframes cxBlink      { 0%,100%{opacity:1} 50%{opacity:0} }
  @keyframes cxSpin       { to{transform:rotate(360deg)} }
  @keyframes cxFabPop     { 0%{transform:scale(0) rotate(-20deg);opacity:0} 65%{transform:scale(1.1) rotate(3deg)} 100%{transform:scale(1) rotate(0deg);opacity:1} }
  @keyframes cxOrbit      { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes cxNodePulse  { 0%,100%{opacity:.4;transform:scale(.8)} 50%{opacity:1;transform:scale(1)} }
  @keyframes cxLogoGlow   { 0%,100%{filter:drop-shadow(0 0 3px rgba(99,179,237,.4))} 50%{filter:drop-shadow(0 0 8px rgba(99,179,237,.8))} }

  .cx-msg-in  { animation:cxMsgIn .28s cubic-bezier(.22,1,.36,1) both }
  .cx-fab-pop { animation:cxFabPop .45s cubic-bezier(.22,1,.36,1) both }
  .cx-panel   { animation:cxSlideUp .35s cubic-bezier(.22,1,.36,1) both }
  .cx-fade    { animation:cxFadeIn .3s ease both }
  .cx-blink   { animation:cxBlink 1s step-start infinite }
  .cx-spin    { animation:cxSpin .8s linear infinite }
  .cx-logo-glow { animation:cxLogoGlow 3s ease-in-out infinite }

  .cx-scrollbar::-webkit-scrollbar       { width:4px }
  .cx-scrollbar::-webkit-scrollbar-track { background:transparent }
  .cx-scrollbar::-webkit-scrollbar-thumb { background:var(--cx-scrollbar-thumb);border-radius:99px }
  .cx-scrollbar::-webkit-scrollbar-thumb:hover { background:var(--cx-scrollbar-thumb-hover) }

  .cx-textarea:focus   { outline:none }
  .cx-textarea::placeholder { color:var(--cx-placeholder) }
  .cx-btn-send:not(:disabled):hover  { transform:scale(1.07) }
  .cx-btn-send:not(:disabled):active { transform:scale(.95) }
  .cx-chip:hover { border-color:rgba(99,179,237,.45) !important; background:rgba(99,179,237,.06) !important }
  .cx-icon-btn:hover { background:var(--cx-icon-hover-bg) !important; color:var(--cx-icon-hover-color) !important }
  .cx-copy-btn { opacity:0; transition:opacity .15s }
  .cx-bubble-group:hover .cx-copy-btn { opacity:1 }
`;
document.head.appendChild(styleEl);

/* ─── Tokens ─────────────────────────────────────────────────────────────── */
const T = {
  panel:    "var(--cx-panel)",
  glass:    "var(--cx-glass)",
  border:   "var(--cx-border)",
  accent:   "var(--cx-accent)",
  purple:   "var(--cx-purple)",
  green:    "var(--cx-green)",
  txtPri:   "var(--cx-txt-pri)",
  txtSec:   "var(--cx-txt-sec)",
  txtMut:   "var(--cx-txt-mut)",
  userBg:   "linear-gradient(135deg,#2B6CB0,#4C51BF)",
  fontH:    "'Syne',sans-serif",
  fontB:    "'DM Sans',sans-serif",
};

const TOOL_LABELS = {
  list_organizations:      "Scanning organizations",
  get_organization_detail: "Loading org details",
  create_organization:     "Creating organization",
  update_organization:     "Updating organization",
  list_users:              "Scanning users",
  get_user_detail:         "Loading user details",
  create_user:             "Creating user",
  update_user:             "Updating user",
  get_current_user_summary:"Loading profile",
};

/* ─────────────────────────────────────────────────────────────────────────
   COREX LOGO  — custom SVG mark
   Concept: two interlocked C-brackets forming an X shape with
   circuit-node dots at each terminal — reads as "CX" and feels
   technical / networked, nothing like Gemini's star.
───────────────────────────────────────────────────────────────────────── */
function CoreXLogo({ size = 24, animated = false }) {
  const s = size;

  return (
    <svg
      width={s} height={s} viewBox="0 0 24 24" fill="none"
      className={animated ? "cx-logo-glow" : ""}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Left C-arc (top-left → bottom-left) */}
      <path
        d="M15 4 C10 4, 5 7.5, 5 12 C5 16.5, 10 20, 15 20"
        stroke="url(#cxGradL)" strokeWidth="2.2"
        strokeLinecap="round" fill="none"
      />
      {/* Right C-arc (top-right → bottom-right, mirrored) */}
      <path
        d="M9 4 C14 4, 19 7.5, 19 12 C19 16.5, 14 20, 9 20"
        stroke="url(#cxGradR)" strokeWidth="2.2"
        strokeLinecap="round" fill="none"
      />
      {/* Corner node dots */}
      <circle cx="15" cy="4"  r="1.5" fill="#63B3ED" opacity=".9"/>
      <circle cx="15" cy="20" r="1.5" fill="#B794F4" opacity=".9"/>
      <circle cx="9"  cy="4"  r="1.5" fill="#63B3ED" opacity=".9"/>
      <circle cx="9"  cy="20" r="1.5" fill="#B794F4" opacity=".9"/>
      {/* Centre crosshair dot */}
      <circle cx="12" cy="12" r="1.8" fill="url(#cxGradC)" opacity=".95"/>

      <defs>
        <linearGradient id="cxGradL" x1="15" y1="4" x2="15" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#63B3ED"/>
          <stop offset="100%" stopColor="#B794F4"/>
        </linearGradient>
        <linearGradient id="cxGradR" x1="9" y1="4" x2="9" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#63B3ED"/>
          <stop offset="100%" stopColor="#B794F4"/>
        </linearGradient>
        <radialGradient id="cxGradC" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#F0F4FF"/>
          <stop offset="100%" stopColor="#63B3ED"/>
        </radialGradient>
      </defs>
    </svg>
  );
}

/* FAB-size logo with rotating orbit ring */
function CoreXFabLogo() {
  return (
    <div style={{ position:"relative", width:28, height:28, display:"flex", alignItems:"center", justifyContent:"center" }}>
      {/* Orbit ring */}
      <div style={{
        position:"absolute", inset:-6,
        border:"1.5px dashed rgba(255,255,255,.2)",
        borderRadius:"50%",
        animation:"cxOrbit 8s linear infinite",
      }}>
        {/* Orbiting dot */}
        <div style={{
          position:"absolute", top:-3, left:"50%", transform:"translateX(-50%)",
          width:5, height:5, borderRadius:"50%",
          background:"rgba(255,255,255,.7)",
          boxShadow:"0 0 6px rgba(99,179,237,.8)",
        }}/>
      </div>
      <CoreXLogo size={26} animated />
    </div>
  );
}

/* Small inline logo for message header */
function CoreXMini() {
  return (
    <div style={{
      width:20, height:20, borderRadius:6,
      background:"linear-gradient(135deg,rgba(99,179,237,.18),rgba(183,148,244,.18))",
      border:"1px solid rgba(99,179,237,.25)",
      display:"flex", alignItems:"center", justifyContent:"center",
    }}>
      <CoreXLogo size={13}/>
    </div>
  );
}

/* ─── Session hook ───────────────────────────────────────────────────────── */
function useStableSession(propId, userId) {
  return useRef((() => {
    const re = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (propId && re.test(propId)) return propId;
    const key = `cx_sid_${userId||"u"}`;
    const s = localStorage.getItem(key);
    if (s && re.test(s)) return s;
    const id = uuidv4(); localStorage.setItem(key,id); return id;
  })()).current;
}

/* ─── Chat hook ──────────────────────────────────────────────────────────── */
function useChat(sid) {
  const [msgs,setMsgs]           = useState([]);
  const [loading,setLoading]     = useState(false);
  const [activeTool,setActiveTool] = useState(null);
  const fetched   = useRef(false);
  const abortRef  = useRef(null);   // current in-flight request's AbortController, if any

  useEffect(() => {
    if (!sid||fetched.current) return;
    fetched.current=true;
    chatAPI.getHistory(sid).then(({messages:h})=>{
      if (h?.length) setMsgs(h.map((m,i)=>({...m,id:`h${i}`,streaming:false})));
    });
  },[sid]);

  const send = useCallback(async (text) => {
    const uid=`u${Date.now()}`,aid=`a${Date.now()}`;
    setMsgs(p=>[...p,
      {role:"user",     content:text,id:uid,streaming:false},
      {role:"assistant",content:"", id:aid,streaming:true},
    ]);
    setLoading(true); setActiveTool(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const resp = await chatAPI.streamMessage(text,sid,controller.signal);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const reader=resp.body.getReader(), dec=new TextDecoder();
      let buf="";
      while(true){
        const {done,value}=await reader.read(); if(done) break;
        buf+=dec.decode(value,{stream:true});
        const parts=buf.split("\n\n"); buf=parts.pop()??"";
        for(const part of parts)
          for(const line of part.split("\n")){
            if(!line.startsWith("data: ")) continue;
            let ev; try{ev=JSON.parse(line.slice(6))}catch{continue}
            switch(ev.type){
              case "tool_start": setActiveTool(ev.tool); break;
              case "tool_end":   setActiveTool(null);    break;
              case "token":
                setMsgs(p=>p.map(m=>m.id===aid?{...m,content:m.content+(ev.content??"")}:m));
                break;
              case "done":
                setMsgs(p=>p.map(m=>m.id===aid?{...m,streaming:false}:m));
                setLoading(false); break;
              case "error":
                setMsgs(p=>p.map(m=>m.id===aid?{...m,content:ev.message||"Error",streaming:false,error:true}:m));
                setLoading(false); break;
              default: break;
            }
          }
      }
    } catch(e) {
      if (e.name === "AbortError") {
        // User hit Stop — keep whatever partial text already streamed in
        // rather than treating it as a failure.
        setMsgs(p=>p.map(m=>m.streaming?{...m,streaming:false,stopped:true}:m));
      } else {
        setMsgs(p=>p.map(m=>m.streaming?{...m,content:`Error: ${e.message}`,streaming:false,error:true}:m));
      }
    } finally { setLoading(false); setActiveTool(null); abortRef.current=null; }
  },[sid]);

  const stop = useCallback(() => { abortRef.current?.abort(); },[]);

  const clear = useCallback(async()=>{
    // Optimistic — clear the UI instantly instead of waiting on the
    // network round-trip (Django's session-delete also best-effort clears
    // the orchestrator's memory server-side, which was making the button
    // feel laggy). The server call still happens, just not blocking the UI.
    setMsgs([]); fetched.current=false;
    try { await chatAPI.clearSession(sid); }
    catch(e) { console.error("Failed to clear session on the server:", e); }
  },[sid]);

  return {msgs,loading,activeTool,send,clear,stop};
}

/* ─── Markdown ───────────────────────────────────────────────────────────── */
function Markdown({text,isUser}){
  const color = isUser?"rgba(255,255,255,.92)":T.txtPri;
  const muted = isUser?"rgba(255,255,255,.78)":T.txtSec;
  return (
    <div style={{fontFamily:T.fontB,fontSize:13.5,lineHeight:1.65,color:muted}}>
      {text.split("\n").map((line,i)=>{
        if(!line) return <div key={i} style={{height:5}}/>;
        if(line.startsWith("# "))  return <div key={i} style={{fontFamily:T.fontH,fontSize:15,fontWeight:700,color,marginBottom:4,marginTop:i?6:0}}>{line.slice(2)}</div>;
        if(line.startsWith("## ")) return <div key={i} style={{fontFamily:T.fontH,fontSize:13,fontWeight:600,color,marginBottom:2,marginTop:i?4:0}}>{line.slice(3)}</div>;
        if(line.startsWith("- ")||line.startsWith("• "))
          return <div key={i} style={{display:"flex",gap:8,paddingLeft:2,marginBottom:2}}>
            <span style={{color:T.accent,marginTop:4,fontSize:8,flexShrink:0}}>◆</span>
            <span>{line.slice(2)}</span>
          </div>;
        if(/^\d+\.\s/.test(line))
          return <div key={i} style={{display:"flex",gap:8,paddingLeft:2,marginBottom:2}}>
            <span style={{color:T.accent,fontWeight:600,minWidth:16,flexShrink:0,fontSize:11}}>{line.match(/^\d+/)[0]}.</span>
            <span>{line.replace(/^\d+\.\s/,"")}</span>
          </div>;
        const html=line
          .replace(/\*\*(.+?)\*\*/g,`<strong style="color:${color};font-weight:600">$1</strong>`)
          .replace(/`(.+?)`/g,`<code style="background:var(--cx-code-bg);color:${T.accent};padding:1px 6px;border-radius:4px;font-size:11.5px;font-family:monospace">$1</code>`);
        return <p key={i} style={{margin:"0 0 2px"}} dangerouslySetInnerHTML={{__html:html}}/>;
      })}
    </div>
  );
}

/* ─── Thinking indicator ─────────────────────────────────────────────────── *
   Replaces a generic three-dot pulse with something that's actually
   CoreX's own — the same orbiting logo mark used on the FAB, plus a
   rotating line of flavor text (à la Claude Code's CLI spinner), so it
   reads as "the assistant is working" rather than a stock loading widget. */
const THINKING_PHRASES = [
  "Thinking", "Consulting the core", "Connecting the dots",
  "Crunching data", "Reasoning it out", "Syncing the mesh",
];

function ThinkingIndicator(){
  const [phraseIdx,setPhraseIdx] = useState(0);
  useEffect(()=>{
    const id = setInterval(()=>setPhraseIdx(i=>(i+1)%THINKING_PHRASES.length), 1800);
    return ()=>clearInterval(id);
  },[]);
  return (
    <div className="cx-fade" style={{
      display:"inline-flex",alignItems:"center",gap:10,
      padding:"7px 14px 7px 10px",
      background:"linear-gradient(135deg,rgba(99,179,237,.07),rgba(183,148,244,.07))",
      border:"1px solid rgba(99,179,237,.2)",
      borderRadius:99,alignSelf:"flex-start",
    }}>
      <div style={{position:"relative",width:18,height:18,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        <div style={{
          position:"absolute",inset:-4,borderRadius:"50%",
          border:"1.5px dashed rgba(99,179,237,.35)",
          animation:"cxOrbit 3s linear infinite",
        }}/>
        <CoreXLogo size={13} animated/>
      </div>
      <span key={phraseIdx} className="cx-fade" style={{
        fontFamily:T.fontB,fontSize:12.5,color:T.accent,letterSpacing:".01em",
        display:"inline-flex",alignItems:"center",gap:4,
      }}>
        {THINKING_PHRASES[phraseIdx]}
        <span style={{display:"inline-flex",gap:2.5,marginLeft:1}}>
          {[0,1,2].map(i=>(
            <span key={i} style={{
              width:3,height:3,borderRadius:"50%",background:T.accent,
              animation:`cxTyping 1.2s ease-in-out ${i*.2}s infinite`,
            }}/>
          ))}
        </span>
      </span>
    </div>
  );
}

/* ─── Tool pill ──────────────────────────────────────────────────────────── */
function ToolPill({tool}){
  if(!tool) return null;
  return (
    <div className="cx-fade" style={{
      display:"inline-flex",alignItems:"center",gap:8,
      padding:"6px 14px",
      background:"linear-gradient(135deg,rgba(99,179,237,.07),rgba(183,148,244,.07))",
      border:"1px solid rgba(99,179,237,.2)",
      borderRadius:99,alignSelf:"flex-start",
      fontFamily:T.fontB,fontSize:12,color:T.accent,
    }}>
      <div className="cx-spin" style={{
        width:12,height:12,borderRadius:"50%",
        border:"1.5px solid rgba(99,179,237,.2)",
        borderTopColor:T.accent,
      }}/>
      {TOOL_LABELS[tool]||tool}
      <span style={{color:T.txtMut,fontStyle:"italic"}}>…</span>
    </div>
  );
}

/* ─── Message bubble ─────────────────────────────────────────────────────── */
function Bubble({msg,isLast}){
  const isUser=msg.role==="user";
  const [copied,setCopied]=useState(false);
  const canCopy = !isUser && !msg.streaming && msg.content && !msg.error;

  const copy = async ()=>{
    try{ await navigator.clipboard.writeText(msg.content); setCopied(true); setTimeout(()=>setCopied(false),1500); }
    catch{ /* clipboard permission denied — fail silently, nothing to recover */ }
  };

  return (
    <div className="cx-msg-in" style={{
      display:"flex",flexDirection:"column",
      alignItems:isUser?"flex-end":"flex-start",
      gap:4,
    }}>
      {!isUser&&(
        <div style={{
          display:"flex",alignItems:"center",gap:6,marginBottom:1,
          fontFamily:T.fontH,fontSize:10,fontWeight:600,
          letterSpacing:"0.08em",textTransform:"uppercase",color:T.txtMut,
        }}>
          <CoreXMini/>
          CoreX AI
        </div>
      )}
      <div className="cx-bubble-group" style={{display:"flex",flexDirection:"column",gap:3,maxWidth:"82%",alignItems:isUser?"flex-end":"flex-start"}}>
        <div style={{
          padding:"11px 15px",borderRadius:16,
          borderBottomRightRadius:isUser?4:16,
          borderBottomLeftRadius: isUser?16:4,
          background:isUser?T.userBg:msg.error?"var(--cx-error-bg)":"var(--cx-msg-bg)",
          border:isUser?"none":msg.error?"1px solid var(--cx-error-border)":"1px solid var(--cx-border)",
          backdropFilter:"blur(10px)",
          boxShadow:isUser?"0 4px 20px rgba(43,108,176,.3)":"var(--cx-msg-shadow)",
        }}>
          <Markdown text={msg.content} isUser={isUser}/>
          {msg.streaming&&isLast&&(
            <span className="cx-blink" style={{
              display:"inline-block",width:2,height:13,
              background:T.accent,marginLeft:3,verticalAlign:"middle",borderRadius:1,
            }}/>
          )}
        </div>
        {msg.stopped&&(
          <span style={{fontFamily:T.fontB,fontSize:10,color:T.txtMut,fontStyle:"italic"}}>Stopped</span>
        )}
        {canCopy&&(
          <button
            className="cx-copy-btn cx-icon-btn" onClick={copy}
            title={copied?"Copied!":"Copy"}
            style={{
              display:"flex",alignItems:"center",gap:4,
              padding:"3px 7px",borderRadius:6,border:"none",cursor:"pointer",
              background:"transparent",color:copied?T.green:T.txtMut,
              fontFamily:T.fontB,fontSize:10,transition:"all .15s",
            }}
          >
            {copied
              ?<svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M13.5 4.5L6 12l-3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              :<svg width="11" height="11" viewBox="0 0 16 16" fill="none"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M2.5 10.5v-7A1 1 0 013.5 2.5h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
            }
            {copied?"Copied":"Copy"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Empty state ────────────────────────────────────────────────────────── */
function EmptyState({onSelect}){
  const chips=[
    {icon:"🏢",text:"List all organizations"},
    {icon:"👥",text:"Show users in my tenant"},
    {icon:"🔑",text:"What is my current role?"},
    {icon:"👋",text:"Hi, what can you do?"},
  ];
  return (
    <div className="cx-fade" style={{
      display:"flex",flexDirection:"column",
      alignItems:"center",justifyContent:"center",
      height:"100%",padding:"20px 16px",textAlign:"center",gap:18,
    }}>
      {/* Logo orb */}
      <div style={{
        width:76,height:76,borderRadius:22,
        background:"linear-gradient(135deg,rgba(99,179,237,.1),rgba(183,148,244,.1))",
        border:"1px solid rgba(99,179,237,.2)",
        display:"flex",alignItems:"center",justifyContent:"center",
        boxShadow:"0 0 40px rgba(99,179,237,.1)",
        position:"relative",
      }}>
        <CoreXLogo size={40} animated/>
        {/* Online dot */}
        <div style={{
          position:"absolute",bottom:-4,right:-4,
          width:16,height:16,borderRadius:"50%",
          background:"linear-gradient(135deg,#48BB78,#38A169)",
          border:`2px solid ${T.panel}`,
          display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:7,color:"#fff",fontWeight:700,
        }}>●</div>
      </div>

      <div>
        <div style={{fontFamily:T.fontH,fontSize:19,fontWeight:700,color:T.txtPri,marginBottom:6,letterSpacing:"-.01em"}}>
          CoreX AI Assistant
        </div>
        <div style={{fontFamily:T.fontB,fontSize:13,color:T.txtSec,maxWidth:255,lineHeight:1.65,margin:"0 auto"}}>
          Manage organizations and users using natural language.
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,width:"100%"}}>
        {chips.map(({icon,text})=>(
          <button key={text} className="cx-chip" onClick={()=>onSelect(text)} style={{
            padding:"10px 12px",textAlign:"left",cursor:"pointer",
            background:T.glass,
            border:"1px solid var(--cx-border)",
            borderRadius:12,
            fontFamily:T.fontB,fontSize:12,color:T.txtSec,
            transition:"all .18s ease",
            display:"flex",flexDirection:"column",gap:4,
          }}>
            <span style={{fontSize:16}}>{icon}</span>
            <span style={{lineHeight:1.4}}>{text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Header ─────────────────────────────────────────────────────────────── */
function Header({user,loading,hasMsgs,onClear,onClose,expanded,onToggleExpand}){
  const [confirming,setConfirming]=useState(false);
  const confirmTimer=useRef(null);

  const handleClearClick=()=>{
    if(!confirming){
      setConfirming(true);
      confirmTimer.current=setTimeout(()=>setConfirming(false),3000);
      return;
    }
    clearTimeout(confirmTimer.current);
    setConfirming(false);
    onClear();
  };
  useEffect(()=>()=>clearTimeout(confirmTimer.current),[]);

  return (
    <div style={{
      padding:"13px 14px",
      background:"linear-gradient(180deg,rgba(99,179,237,.05) 0%,transparent 100%)",
      borderBottom:"1px solid var(--cx-border)",
      display:"flex",alignItems:"center",justifyContent:"space-between",
      flexShrink:0,
    }}>
      <div style={{display:"flex",alignItems:"center",gap:11}}>
        {/* Avatar with orbit ring */}
        <div style={{
          width:40,height:40,borderRadius:12,
          background:"linear-gradient(135deg,rgba(99,179,237,.14),rgba(183,148,244,.14))",
          border:"1px solid rgba(99,179,237,.2)",
          display:"flex",alignItems:"center",justifyContent:"center",
          boxShadow:"0 0 18px rgba(99,179,237,.12)",
          position:"relative",overflow:"visible",
        }}>
          <CoreXLogo size={24} animated/>
          {/* Pulse ring */}
          <div style={{
            position:"absolute",inset:-4,borderRadius:16,
            border:"1px solid rgba(99,179,237,.2)",
            animation:"cxOrbit 6s linear infinite",
          }}/>
        </div>

        <div>
          <div style={{
            fontFamily:T.fontH,fontSize:14,fontWeight:700,
            color:T.txtPri,letterSpacing:".01em",
            display:"flex",alignItems:"center",gap:7,
          }}>
            CoreX AI
            <span style={{
              fontSize:9,fontWeight:600,letterSpacing:".08em",
              padding:"2px 7px",borderRadius:99,
              background:"rgba(99,179,237,.1)",
              border:"1px solid rgba(99,179,237,.2)",
              color:T.accent,textTransform:"uppercase",
            }}>BETA</span>
          </div>
          <div style={{
            fontFamily:T.fontB,fontSize:11,color:T.txtMut,
            display:"flex",alignItems:"center",gap:5,marginTop:2,
          }}>
            <span style={{
              width:6,height:6,borderRadius:"50%",display:"inline-block",
              background:loading?T.accent:T.green,
              boxShadow:loading?`0 0 6px ${T.accent}`:`0 0 5px ${T.green}`,
              transition:"background .3s",
            }}/>
            {loading?"Processing":"Online"}
            {user?.role&&<><span style={{opacity:.35}}>·</span><span>{user.role.replace(/_/g," ")}</span></>}
          </div>
        </div>
      </div>

      <div style={{display:"flex",gap:3,alignItems:"center"}}>
        {hasMsgs&&(
          confirming ? (
            <button onClick={handleClearClick} title="Click again to confirm" style={{
              display:"flex",alignItems:"center",gap:5,
              padding:"0 10px",height:30,borderRadius:8,border:"none",cursor:"pointer",
              background:"rgba(252,129,129,.15)",color:"#E53E3E",
              fontFamily:T.fontB,fontSize:11,fontWeight:600,
              transition:"all .15s",whiteSpace:"nowrap",
            }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12M5.333 4V2.667A1.333 1.333 0 016.667 1.333h2.666A1.333 1.333 0 0110.667 2.667V4m2 0v9.333A1.333 1.333 0 0111.333 14.667H4.667A1.333 1.333 0 013.333 13.333V4h9.334z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              Confirm?
            </button>
          ) : (
            <button className="cx-icon-btn" onClick={handleClearClick} title="Clear chat" style={{
              width:30,height:30,borderRadius:8,border:"none",cursor:"pointer",
              background:"transparent",color:T.txtMut,fontSize:13,
              display:"flex",alignItems:"center",justifyContent:"center",
              transition:"all .15s",
            }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12M5.333 4V2.667A1.333 1.333 0 016.667 1.333h2.666A1.333 1.333 0 0110.667 2.667V4m2 0v9.333A1.333 1.333 0 0111.333 14.667H4.667A1.333 1.333 0 013.333 13.333V4h9.334z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </button>
          )
        )}
        <button className="cx-icon-btn" onClick={onToggleExpand} title={expanded?"Shrink":"Expand"} style={{
          width:30,height:30,borderRadius:8,border:"none",cursor:"pointer",
          background:"transparent",color:T.txtMut,
          display:"flex",alignItems:"center",justifyContent:"center",
          transition:"all .15s",
        }}>
          {expanded
            ?<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M6 2v3a1 1 0 01-1 1H2M10 2v3a1 1 0 001 1h3M6 14v-3a1 1 0 00-1-1H2M10 14v-3a1 1 0 011-1h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            :<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M2 6V3a1 1 0 011-1h3M11 2h3a1 1 0 011 1v3M14 10v3a1 1 0 01-1 1h-3M5 14H2a1 1 0 01-1-1v-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
          }
        </button>
        <button className="cx-icon-btn" onClick={onClose} style={{
          width:30,height:30,borderRadius:8,border:"none",cursor:"pointer",
          background:"transparent",color:T.txtMut,fontSize:18,
          display:"flex",alignItems:"center",justifyContent:"center",
          transition:"all .15s",
        }}>×</button>
      </div>
    </div>
  );
}

/* ─── Input bar ──────────────────────────────────────────────────────────── */
function InputBar({value,onChange,onKeyDown,onSend,onStop,disabled,inputRef}){
  const [focused,setFocused]=useState(false);
  return (
    <div style={{
      padding:"11px 13px 13px",flexShrink:0,
      borderTop:"1px solid var(--cx-border)",
      background:"linear-gradient(0deg,rgba(99,179,237,.025) 0%,transparent 100%)",
    }}>
      <div style={{
        display:"flex",alignItems:"flex-end",gap:9,
        background:"var(--cx-input-bg)",
        border:`1px solid ${focused?"var(--cx-input-border-focus)":"var(--cx-border)"}`,
        borderRadius:14,padding:"9px 9px 9px 15px",
        transition:"border-color .2s,box-shadow .2s",
        boxShadow:focused?"0 0 0 3px rgba(99,179,237,.07)":"none",
      }}>
        <textarea
          ref={inputRef} className="cx-textarea"
          value={value} onChange={onChange} onKeyDown={onKeyDown}
          onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
          placeholder="Message CoreX AI…" rows={1} disabled={disabled}
          style={{
            flex:1,background:"transparent",border:"none",
            fontFamily:T.fontB,fontSize:13.5,color:T.txtPri,
            resize:"none",maxHeight:120,lineHeight:1.55,
            overflowY:"auto",paddingTop:2,
          }}
        />
        {disabled ? (
          <button
            className="cx-btn-send" onClick={onStop} title="Stop generating"
            style={{
              width:34,height:34,borderRadius:9,border:"none",cursor:"pointer",
              flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",
              background:"rgba(229,62,62,.12)",color:"#E53E3E",
              transition:"all .2s",
            }}
          >
            <div style={{width:11,height:11,borderRadius:3,background:"currentColor"}}/>
          </button>
        ) : (
          <button
            className="cx-btn-send" onClick={onSend}
            disabled={!value.trim()}
            title="Send"
            style={{
              width:34,height:34,borderRadius:9,border:"none",cursor:"pointer",
              flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",
              background:value.trim()
                ?"linear-gradient(135deg,#3182CE,#6B46C1)"
                :"var(--cx-send-idle-bg)",
              color:value.trim()?"#fff":T.txtMut,
              transition:"all .2s",
              boxShadow:value.trim()?"0 4px 14px rgba(49,130,206,.35)":"none",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
              <path d="M17.5 2.5L10 10M17.5 2.5L12 17.5L10 10L2.5 7.5L17.5 2.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
      </div>
      <div style={{
        textAlign:"center",marginTop:7,
        fontFamily:T.fontB,fontSize:10,color:T.txtMut,letterSpacing:".02em",
      }}>
        AI may make mistakes · Always verify important information
      </div>
    </div>
  );
}

/* ─── FAB ────────────────────────────────────────────────────────────────── */
function Fab({onClick}){
  const [hov,setHov]=useState(false);
  return (
    <button
      className="cx-fab-pop" onClick={onClick}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      title="Open CoreX AI"
      style={{
        position:"fixed",bottom:28,right:28,zIndex:9999,
        width:58,height:58,borderRadius:17,border:"none",cursor:"pointer",
        background:hov
          ?"linear-gradient(145deg,#4C51BF,#2B6CB0)"
          :"linear-gradient(145deg,#2B6CB0,#4C51BF)",
        display:"flex",alignItems:"center",justifyContent:"center",
        transition:"all .25s cubic-bezier(.22,1,.36,1)",
        boxShadow:hov
          ?"0 10px 36px rgba(49,130,206,.55),0 0 0 1px rgba(99,179,237,.3)"
          :"0 6px 22px rgba(49,130,206,.4)",
        transform:hov?"scale(1.07) translateY(-2px)":"scale(1)",
      }}
    >
      <CoreXFabLogo/>
    </button>
  );
}

/* ─── Root ───────────────────────────────────────────────────────────────── */
export default function ChatAssistant({sessionId:propSid,user}){
  const [open,setOpen]         = useState(false);
  const [expanded,setExpanded] = useState(false);
  const [input,setInput]       = useState("");
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);
  const sid = useStableSession(propSid,user?.id);
  const {msgs,loading,activeTool,send,clear,stop} = useChat(sid);

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[msgs,activeTool]);
  useEffect(()=>{ if(open) setTimeout(()=>inputRef.current?.focus(),120); },[open]);

  const submit=()=>{ const t=input.trim(); if(!t||loading) return; setInput(""); send(t); };
  const onKey=e=>{ if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();submit();} };

  if(!open) return <Fab onClick={()=>setOpen(true)}/>;

  return (
    <div className="cx-panel" style={{
      position:"fixed",bottom:28,right:28,zIndex:9999,
      width:expanded?"min(560px, 92vw)":400,
      height:expanded?"min(820px, 88vh)":620,
      background:T.panel,
      border:"1px solid var(--cx-border)",
      borderRadius:22,
      display:"flex",flexDirection:"column",overflow:"hidden",
      fontFamily:T.fontB,
      boxShadow:"var(--cx-panel-shadow)",
      transition:"width .25s cubic-bezier(.22,1,.36,1),height .25s cubic-bezier(.22,1,.36,1)",
    }}>
      {/* Top accent line */}
      <div style={{
        position:"absolute",top:0,left:"8%",right:"8%",height:1,
        background:"linear-gradient(90deg,transparent,rgba(99,179,237,.45),transparent)",
        zIndex:1,pointerEvents:"none",
      }}/>

      <Header
        user={user} loading={loading} hasMsgs={msgs.length>0}
        onClear={clear} onClose={()=>setOpen(false)}
        expanded={expanded} onToggleExpand={()=>setExpanded(e=>!e)}
      />

      <div className="cx-scrollbar" style={{
        flex:1,overflowY:"auto",padding:"14px 13px",
        display:"flex",flexDirection:"column",gap:13,minHeight:0,
        background:"radial-gradient(ellipse at 50% 0%,rgba(99,179,237,.025) 0%,transparent 55%)",
      }}>
        {msgs.length===0
          ?<EmptyState onSelect={t=>{if(!loading) send(t);}}/>
          :<>
            {msgs.map((m,i)=>{
              // Hide the still-empty placeholder bubble while nothing has
              // streamed in yet — ThinkingIndicator/ToolPill below covers
              // that state instead of showing a bare blinking cursor.
              if(m.streaming&&m.content==="") return null;
              return <Bubble key={m.id} msg={m} isLast={i===msgs.length-1}/>;
            })}
            {activeTool&&<ToolPill tool={activeTool}/>}
            {loading&&!activeTool&&msgs[msgs.length-1]?.content===""&&<ThinkingIndicator/>}
            <div ref={bottomRef}/>
          </>
        }
      </div>

      <div style={{height:1,flexShrink:0,background:"linear-gradient(90deg,transparent,var(--cx-border),transparent)"}}/>

      <InputBar
        value={input} onChange={e=>setInput(e.target.value)}
        onKeyDown={onKey} onSend={submit} onStop={stop}
        disabled={loading} inputRef={inputRef}
      />
    </div>
  );
}