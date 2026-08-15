(() => {
  'use strict';
  // Remove the old Insights-only AI widget so the site has exactly one AI entry point.
  ['aiFloat','chat'].forEach(id=>{const el=document.getElementById(id);if(el)el.remove();});
  if(document.getElementById('dng-ai-global-trigger'))return;
  if(!window.DNGSupport)return;
  const L=window.DNGSupport.lang();
  const copy=L==='en'?{trigger:'DNG AI',title:'DNG AI',placeholder:'Ask anything…',hello:'Hi. Ask me anything about this site, current insights, or a problem you are working on.',send:'Send',close:'Close',clear:'New chat',thinking:'Thinking…'}:L==='zh'?{trigger:'DNG AI',title:'DNG AI',placeholder:'问任何问题…',hello:'你好。你可以询问本站内容、最新资讯，或正在处理的问题。',send:'发送',close:'关闭',clear:'新对话',thinking:'思考中…'}:{trigger:'DNG AI',title:'DNG AI',placeholder:'Hỏi bất cứ điều gì…',hello:'Chào bạn. Cứ hỏi bất cứ điều gì về website, tin mới hoặc vấn đề bạn đang xử lý.',send:'Gửi',close:'Đóng',clear:'Chat mới',thinking:'Đang suy nghĩ…'};
  const trigger=document.createElement('button');trigger.id='dng-ai-global-trigger';trigger.type='button';trigger.setAttribute('aria-label',copy.trigger);trigger.innerHTML='<i aria-hidden="true"></i><span>'+copy.trigger+'</span>';
  const panel=document.createElement('section');panel.id='dng-ai-global-panel';panel.setAttribute('aria-label',copy.title);panel.innerHTML=`<div class="dng-ai-global-head"><strong>${copy.title}</strong><button class="dng-ai-new" type="button">${copy.clear}</button><button class="dng-ai-close" type="button" aria-label="${copy.close}">×</button></div><div class="dng-ai-global-body"></div><div class="dng-ai-quick"></div><form class="dng-ai-global-form"><textarea rows="1" aria-label="Question" autocomplete="off" placeholder="${copy.placeholder}"></textarea><button>${copy.send}</button></form>`;
  document.body.append(trigger,panel);
  const body=panel.querySelector('.dng-ai-global-body'),quick=panel.querySelector('.dng-ai-quick'),input=panel.querySelector('textarea'),close=panel.querySelector('.dng-ai-close'),fresh=panel.querySelector('.dng-ai-new'),form=panel.querySelector('form');
  const key='dng-ai-chat-history-v21';let history=[];try{history=JSON.parse(sessionStorage.getItem(key)||'[]');if(!Array.isArray(history))history=[];}catch(_){history=[];}
  let busy=false, hiddenFixed=[];
  const persist=()=>{try{sessionStorage.setItem(key,JSON.stringify(history.slice(-40)));}catch(_){}};
  function fixedContacts(){return[...document.querySelectorAll('a[href^="tel:"],a[href*="zalo.me"]')].filter(a=>{let p=a,n=0;while(p&&n++<4){if(getComputedStyle(p).position==='fixed')return true;p=p.parentElement}return false})}
  function hideContacts(){hiddenFixed=fixedContacts().map(el=>({el,v:el.style.visibility}));hiddenFixed.forEach(x=>x.el.style.visibility='hidden')}
  function restoreContacts(){hiddenFixed.forEach(x=>x.el.style.visibility=x.v);hiddenFixed=[]}
  function bubble(text,user=false){const d=document.createElement('div');d.className='dng-ai-bubble'+(user?' user':'');d.textContent=text;body.appendChild(d);body.scrollTop=body.scrollHeight;return d}
  function addSources(r){(r?.sources||[]).slice(0,4).forEach(s=>{const a=document.createElement('a');a.className='dng-ai-result-link';a.href=s.url||s; a.target='_blank';a.rel='noopener';a.textContent=s.title||s.label||s.url||String(s);body.appendChild(a);});if(r?.url){const a=document.createElement('a');a.className='dng-ai-result-link';a.href=r.url;a.textContent=r.label||r.url;body.appendChild(a)}}
  function renderHistory(){body.innerHTML='';if(!history.length){bubble(copy.hello);return;}history.forEach(x=>bubble(x.content,x.role==='user'));}
  async function ask(q){if(busy||!q)return;busy=true;history.push({role:'user',content:q});persist();bubble(q,true);const pending=bubble(copy.thinking);try{const r=await window.DNGSupport.ask(q,{lang:L,history:history.slice(0,-1),sessionId:window.DNGSupport.sessionId()});pending.textContent=r.answer||'';history.push({role:'assistant',content:r.answer||''});persist();addSources(r);}finally{busy=false;body.scrollTop=body.scrollHeight}}
  function updateViewport(){if(!window.visualViewport)return;const kb=Math.max(0,innerHeight-visualViewport.height-visualViewport.offsetTop);panel.style.bottom=(kb+12)+'px';panel.style.maxHeight=Math.max(320,visualViewport.height-24)+'px'}
  function open(){panel.classList.add('open');hideContacts();setTimeout(()=>input.focus(),50);updateViewport()}
  function shut(){panel.classList.remove('open');restoreContacts()}
  renderHistory();window.DNGSupport.quickItems(L).forEach(([label,q])=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>ask(q);quick.appendChild(b)});
  trigger.onclick=open;close.onclick=shut;fresh.onclick=()=>{history=[];persist();renderHistory();input.focus()};
  input.addEventListener('input',()=>{input.style.height='auto';input.style.height=Math.min(input.scrollHeight,120)+'px'});
  input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();form.requestSubmit();}});
  form.addEventListener('submit',e=>{e.preventDefault();const q=input.value.trim();if(!q)return;input.value='';input.style.height='auto';ask(q)});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')shut()});if(window.visualViewport){visualViewport.addEventListener('resize',updateViewport);visualViewport.addEventListener('scroll',updateViewport)}
})();