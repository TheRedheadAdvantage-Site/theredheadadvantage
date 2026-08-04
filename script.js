const b=document.querySelector('.menu-toggle'),n=document.querySelector('.site-nav');if(b&&n)b.addEventListener('click',()=>{const o=n.classList.toggle('open');b.setAttribute('aria-expanded',o)});
