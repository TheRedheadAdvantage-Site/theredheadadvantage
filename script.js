
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

function loadBeehiivAttribution(){
  if(document.querySelector('script[data-tra-beehiiv-attribution]')) return;
  const s=document.createElement('script');
  s.async=true;
  s.src='https://subscribe-forms.beehiiv.com/attribution.js';
  s.dataset.traBeehiivAttribution='true';
  document.head.appendChild(s);
}

function setConsent(value){
  localStorage.setItem(CONSENT_KEY,value);
  if(value==='granted'){
    gtag('consent','update',{analytics_storage:'granted'});
    loadAnalytics();
    loadBeehiivAttribution();
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

// Beehiiv form resilience for TRA resource pages.
// Beehiiv renders forms in a cross-origin iframe, so TRA only manages the
// outer loader/container. Subscription fields, consent, redirects, and submit
// behavior remain entirely controlled by Beehiiv.
(function initBeehiivFormResilience(){
  const EMBED_SRC='https://subscribe-forms.beehiiv.com/v3/loader.js';
  const containers=[...document.querySelectorAll('.resource-form,.mvr-form-card')];

  if(!containers.length) return;

  // Help the browser establish the Beehiiv connection early for retries.
  if(!document.querySelector('link[data-tra-beehiiv-preconnect]')){
    const preconnect=document.createElement('link');
    preconnect.rel='preconnect';
    preconnect.href='https://subscribe-forms.beehiiv.com';
    preconnect.crossOrigin='anonymous';
    preconnect.dataset.traBeehiivPreconnect='true';
    document.head.appendChild(preconnect);
  }

  containers.forEach((container)=>{
    const original=container.querySelector('script[data-beehiiv-form]');
    if(!original) return;

    const formId=original.getAttribute('data-beehiiv-form');
    if(!formId) return;

    const status=document.createElement('p');
    status.className='beehiiv-load-status';
    status.setAttribute('role','status');
    status.setAttribute('aria-live','polite');
    status.textContent='Loading signup form…';
    original.insertAdjacentElement('beforebegin',status);

    let attempts=0;
    let finished=false;
    let retryTimer;

    const hasRenderedForm=()=>Boolean(
      container.querySelector('iframe') ||
      container.querySelector('[data-beehiiv-form-rendered]') ||
      [...container.children].some((el)=>el!==status && el.tagName!=='SCRIPT' && !el.classList.contains('form-privacy'))
    );

    const markLoaded=()=>{
      if(finished) return;
      finished=true;
      clearTimeout(retryTimer);
      status.hidden=true;
      observer.disconnect();
    };

    const observer=new MutationObserver(()=>{
      if(hasRenderedForm()) markLoaded();
    });
    observer.observe(container,{childList:true,subtree:true});

    if(hasRenderedForm()){
      markLoaded();
      return;
    }

    const retry=()=>{
      if(finished || hasRenderedForm()){
        markLoaded();
        return;
      }

      attempts+=1;

      // Two conservative retries only. Remove the stale loader node first so
      // Beehiiv gets a fresh execution without duplicating the working form.
      const stale=container.querySelector('script[data-beehiiv-form]');
      stale?.remove();

      const fresh=document.createElement('script');
      fresh.async=true;
      fresh.src=EMBED_SRC;
      fresh.setAttribute('data-beehiiv-form',formId);
      fresh.dataset.traBeehiivRetry=String(attempts);
      container.insertBefore(fresh, container.querySelector('.form-privacy') || null);

      if(attempts<2){
        status.textContent='Loading signup form…';
        retryTimer=setTimeout(retry,5000);
      }else{
        retryTimer=setTimeout(()=>{
          if(finished || hasRenderedForm()){
            markLoaded();
            return;
          }
          status.hidden=false;
          status.innerHTML='The signup form is taking longer than expected. <a href="' +
            window.location.href.split('#')[0] + '">Refresh this page</a> and try again.';
          observer.disconnect();
        },5000);
      }
    };

    // Give Beehiiv's original async loader time to render before retrying.
    retryTimer=setTimeout(retry,5000);
  });
})();
