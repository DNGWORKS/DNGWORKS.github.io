(() => {
  'use strict';
  const WORKER_BASE=String(window.DNG_AI_WORKER_BASE||'https://dng-ai.nguyendhungdung.workers.dev').replace(/\/$/,'');
  const ENDPOINT=WORKER_BASE+'/chat';
  const MAX_HISTORY=24;
  function lang(){const l=(document.documentElement.lang||'vi').toLowerCase();if(l.startsWith('en'))return'en';if(l.startsWith('zh'))return'zh';return'vi';}
  function links(l){if(l==='en')return{pricing:'/en/pricing/',portfolio:'/en/portfolio/',contact:'/en/contact/',insights:'/en/insights/'};if(l==='zh')return{pricing:'/zh/pricing/',portfolio:'/zh/portfolio/',contact:'/zh/contact/',insights:'/zh/insights/'};return{pricing:'/pricing/',portfolio:'/portfolio/',contact:'/contact/',insights:'/insights/'};}
  function sessionId(){try{let id=sessionStorage.getItem('dng-ai-session');if(!id){id=crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;sessionStorage.setItem('dng-ai-session',id);}return id;}catch(_){return `${Date.now()}-${Math.random().toString(36).slice(2)}`;}}
  function fallbackText(l){const u=links(l);if(l==='en')return{answer:'AI is temporarily unavailable. You can retry or contact DNGWORKS directly.',url:u.contact,label:'Contact'};if(l==='zh')return{answer:'AI 暂时不可用。您可以重试或直接联系 DNGWORKS。',url:u.contact,label:'联系'};return{answer:'AI đang tạm thời không phản hồi. Bạn có thể thử lại hoặc liên hệ trực tiếp DNGWORKS.',url:u.contact,label:'Liên hệ'};}
  async function ask(question,options={}){
    const l=options.lang||lang();
    const history=(Array.isArray(options.history)?options.history:[]).slice(-MAX_HISTORY).map(x=>({role:x.role==='assistant'?'assistant':'user',content:String(x.content||'').slice(0,4000)}));
    const payload={message:String(question||'').slice(0,5000),history,session_id:options.sessionId||sessionId(),mode:'site-chat',lang:l,url:location.href,title:document.title};
    try{
      const r=await fetch(ENDPOINT,{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify(payload)});
      if(!r.ok)throw new Error('HTTP '+r.status);
      const j=await r.json();
      return{answer:String(j.answer||j.output_text||''),sources:Array.isArray(j.sources)?j.sources:[],conversation_id:j.conversation_id||j.response_id||'',local:false};
    }catch(error){return{...fallbackText(l),error:true,sources:[],local:true};}
  }
  function quickItems(forcedLang){const l=forcedLang||lang();if(l==='en')return[['Today','What is worth knowing today?'],['Analyze','Analyze the current page for me'],['Services','What can DNGWORKS help with?'],['Pricing','Show me pricing']];if(l==='zh')return[['今日','今天有什么值得关注？'],['分析','帮我分析当前页面'],['服务','DNGWORKS 能提供什么帮助？'],['报价','查看报价']];return[['Hôm nay','Hôm nay có gì đáng chú ý?'],['Phân tích','Phân tích trang hiện tại cho tôi'],['Dịch vụ','DNGWORKS có thể giúp gì?'],['Báo giá','Cho tôi xem báo giá']];}
  window.DNGSupport={ask,quickItems,lang,sessionId,MAX_HISTORY};
})();