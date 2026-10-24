
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

// Native TRA resource access
(function initTraResourceAccess(){
  const WORKER="https://tra-resource-access.twilight-violet-d96b.workers.dev";
  const TOKEN_KEY='tra-resource-access-token';
  const TOKEN_EXP_KEY='tra-resource-access-exp';

  function getToken(){
    const token=localStorage.getItem(TOKEN_KEY);
    const exp=Number(localStorage.getItem(TOKEN_EXP_KEY)||0);
    if(!token || (exp && Date.now()>exp)){
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_EXP_KEY);
      return '';
    }
    return token;
  }

  function saveToken(token,days){
    localStorage.setItem(TOKEN_KEY,token);
    localStorage.setItem(TOKEN_EXP_KEY,String(Date.now()+(Number(days)||365)*86400000));
  }

  function currentTracking(){
    const p=new URLSearchParams(location.search);
    return {
      utm_source:p.get('utm_source')||'website',
      utm_medium:p.get('utm_medium')||'website',
      utm_campaign:p.get('utm_campaign')||'resource_library'
    };
  }

  const form=document.querySelector('[data-tra-unlock-form]');
  const unlocked=document.querySelector('[data-tra-unlocked]');

  if(form && unlocked){
    if(getToken()){
      form.hidden=true;
      unlocked.hidden=false;
    }

    form.addEventListener('submit',async(event)=>{
      event.preventDefault();
      const email=form.querySelector('input[name="email"]');
      const consent=form.querySelector('input[name="consent"]');
      const button=form.querySelector('button[type="submit"]');
      const status=form.querySelector('.tra-form-status');
      status.classList.remove('is-error');

      if(!email.value.trim() || !email.checkValidity()){
        status.textContent='Please enter a valid email address.';
        status.classList.add('is-error');
        email.focus();
        return;
      }
      if(!consent.checked){
        status.textContent='Please confirm the email consent to continue.';
        status.classList.add('is-error');
        consent.focus();
        return;
      }

      const tracking=currentTracking();
      button.disabled=true;
      status.textContent='Unlocking your resources…';

      try{
        const response=await fetch(WORKER+'/unlock',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            email:email.value.trim(),
            consent:true,
            ...tracking
          })
        });
        const data=await response.json();
        if(!response.ok || !data.ok || !data.token){
          throw new Error(data.error||'We couldn’t unlock the resource. Please try again.');
        }

        saveToken(data.token,data.expiresInDays);
        if(typeof gtag==='function'){
          gtag('event','resource_library_unlock',tracking);
        }
        location.href=form.dataset.successPage;
      }catch(error){
        status.textContent=error.message||'We couldn’t unlock the resource. Please try again.';
        status.classList.add('is-error');
        button.disabled=false;
      }
    });
  }

  document.addEventListener('click',async(event)=>{
    const link=event.target.closest('[data-tra-download]');
    if(!link) return;
    event.preventDefault();

    const slug=link.dataset.traDownload;
    const token=getToken();
    const landing=document.body.dataset.traUnlockPage || 'resources.html';

    if(!token){
      location.href=landing+'#get-resource';
      return;
    }

    const originalText=link.textContent;
    link.setAttribute('aria-disabled','true');
    link.textContent='Preparing download…';

    const oldError=document.querySelector('.tra-download-error');
    if(oldError) oldError.remove();

    try{
      const response=await fetch(WORKER+'/download/'+encodeURIComponent(slug),{
        headers:{'Authorization':'Bearer '+token}
      });

      if(response.status===401){
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(TOKEN_EXP_KEY);
        location.href=landing+'#get-resource';
        return;
      }

      if(!response.ok){
        throw new Error('The download could not be prepared. Please try again.');
      }

      const blob=await response.blob();
      const disposition=response.headers.get('Content-Disposition')||'';
      const match=disposition.match(/filename="([^"]+)"/i);
      const filename=match ? match[1] : slug;
      const objectUrl=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=objectUrl;
      a.download=filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(()=>URL.revokeObjectURL(objectUrl),1000);

      if(typeof gtag==='function'){
        gtag('event','resource_download',{resource:slug});
      }
    }catch(error){
      const p=document.createElement('p');
      p.className='tra-download-error';
      p.textContent=error.message||'The download could not be prepared. Please try again.';
      link.parentElement.appendChild(p);
    }finally{
      link.removeAttribute('aria-disabled');
      link.textContent=originalText;
    }
  });
})();
