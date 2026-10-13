/* Lightweight homepage motion; computation widgets have separate lifecycles. */
(() => {
  'use strict';
  window.initHomeMotion=()=>{
    const home=document.querySelector('.lab-home');if(!home?.querySelector('.lab-hero'))return ()=>{};
    const media=matchMedia('(prefers-reduced-motion: reduce)'),cleanups=[];
    const listen=(target,type,handler,options)=>{target.addEventListener(type,handler,options);cleanups.push(()=>target.removeEventListener(type,handler,options));};
    const ambient=document.createElement('div');ambient.className='home-ambient';ambient.setAttribute('aria-hidden','true');
    for(let index=0;index<9;index++){
      const petal=document.createElement('span');petal.className='home-petal';
      petal.style.setProperty('--petal-left',(index*12.7+3)%100+'%');petal.style.setProperty('--petal-duration',23+index%5*3+'s');
      petal.style.setProperty('--petal-delay',-index*4.3+'s');ambient.append(petal);
    }
    const progress=document.createElement('div');progress.className='home-scroll-progress';progress.setAttribute('aria-hidden','true');
    document.body.prepend(ambient,progress);let frame=null;
    const update=()=>{frame=null;const total=document.documentElement.scrollHeight-innerHeight;progress.style.transform=`scaleX(${total>0?Math.min(1,scrollY/total):0})`;};
    listen(window,'scroll',()=>{if(frame===null)frame=requestAnimationFrame(update);},{passive:true});listen(window,'resize',update);update();
    const cards=home.querySelectorAll('.home-track-card,.lab-post-card');
    cards.forEach(card=>{
      listen(card,'pointermove',event=>{if(event.pointerType!=='mouse'||media.matches)return;const rect=card.getBoundingClientRect();card.style.setProperty('--pointer-x',event.clientX-rect.left+'px');card.style.setProperty('--pointer-y',event.clientY-rect.top+'px');card.classList.add('is-pointer-active');});
      listen(card,'pointerleave',()=>card.classList.remove('is-pointer-active'));
    });
    listen(document,'visibilitychange',()=>document.body.classList.toggle('home-motion-paused',document.hidden));
    return ()=>{cleanups.forEach(cleanup=>cleanup());cancelAnimationFrame(frame);ambient.remove();progress.remove();cards.forEach(card=>card.classList.remove('is-pointer-active'));document.body.classList.remove('home-motion-paused');};
  };
})();
