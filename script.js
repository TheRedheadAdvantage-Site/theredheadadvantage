
const button=document.querySelector('.menu-toggle');
const nav=document.querySelector('.site-nav');
if(button&&nav){
  button.addEventListener('click',()=>{
    const open=nav.classList.toggle('open');
    button.setAttribute('aria-expanded',String(open));
  });
}

const CONSENT_KEY='tra-analytics-consent';
const banner=document.querySelector('.cookie-banner');
const accept=document.querySelector('.cookie-accept');
const decline=document.querySelector('.cookie-decline');
const manage=document.querySelector('.manage-cookies');

function loadAnalytics(){
  if(document.querySelector('script[data-tra-ga]')) return;
  const s=document.createElement('script');
  s.async=true;
  s.src='https://www.googletagmanager.com/gtag/js?id=G-91BE4649ZV';
  s.dataset.traGa='true';
  document.head.appendChild(s);
  window.dataLayer=window.dataLayer||[];
  window.gtag=window.gtag||function(){dataLayer.push(arguments);};
  gtag('js',new Date());
  gtag('config','G-91BE4649ZV',{anonymize_ip:true});
}

function setConsent(value){
  localStorage.setItem(CONSENT_KEY,value);
  if(value==='granted'){
    gtag('consent','update',{analytics_storage:'granted'});
    loadAnalytics();
  } else {
    gtag('consent','update',{analytics_storage:'denied'});
  }
  if(banner) banner.hidden=true;
}

const saved=localStorage.getItem(CONSENT_KEY);
if(saved==='granted'){ setConsent('granted'); }
else if(saved==='denied'){ setConsent('denied'); }
else if(banner){ banner.hidden=false; }

accept?.addEventListener('click',()=>setConsent('granted'));
decline?.addEventListener('click',()=>setConsent('denied'));
manage?.addEventListener('click',()=>{if(banner) banner.hidden=false;});

document.addEventListener('click',(event)=>{
  const tracked=event.target.closest('[data-event]');
  if(!tracked || typeof gtag!=='function') return;
  gtag('event',tracked.dataset.event,{link_url:tracked.href||'',link_text:tracked.textContent.trim()});
});
