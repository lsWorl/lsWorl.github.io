/* Independent navigation and lifecycle for Klee's four games. */
(() => {
  'use strict';
  const element=(tag,cls,text)=>{const el=document.createElement(tag);el.className=cls;el.textContent=text;return el;};
  const sessions = new WeakMap();
  window.initLabGames=()=>{
    const tablist=document.querySelector('.ai-tabs');
    if(!tablist)return ()=>{};
    if(sessions.has(tablist)) {
      const session=sessions.get(tablist); session.resume(); return session.pause;
    }
    const tabs=[...tablist.querySelectorAll('[data-experiment-tab]')];
    const panels=[...document.querySelectorAll('[data-experiment-panel]')];
    const initialized=new Map(),failed=new Set();
    // Games in their own files register in window.LabExperiments.
    const initializers=window.LabExperiments||{};
    const stop=()=>{
      initialized.forEach(pause=>pause());
      document.dispatchEvent(new CustomEvent('lab:panel-change'));
    };
    function activate(id,focus=false) {
      if(!tabs.some(tab=>tab.dataset.experimentTab===id))id=tabs[0].dataset.experimentTab;
      stop();
      tabs.forEach(tab=>{
        const active=tab.dataset.experimentTab===id;
        tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;
        if(active&&focus)tab.focus();
      });
      panels.forEach(panel=>{panel.hidden=panel.dataset.experimentPanel!==id;});
      // Tab navigation is independent of each game. Initialize each
      // panel only when opened, so one component cannot disable the other tabs.
      if(initializers[id]&&!initialized.has(id)&&!failed.has(id)) {
        const panel=panels.find(panel=>panel.dataset.experimentPanel===id);
        try {
          initialized.set(id,initializers[id](panel));
        } catch(error) {
          failed.add(id);
          const notice=element('p','ai-empty','游戏组件未能加载，请刷新页面后重试。');
          notice.setAttribute('role','alert');panel.querySelector('.lab-experiment-heading').append(notice);
          console.error('Lab game initialization failed:',id,error);
        }
      }
      if(location.hash!=='#'+id)history.replaceState(null,'','#'+id);
    }
    tabs.forEach((tab,index)=>{
      tab.addEventListener('click',()=>activate(tab.dataset.experimentTab));
      tab.addEventListener('keydown',event=>{
        const offset=event.key==='ArrowRight'?1:event.key==='ArrowLeft'?-1:0;
        const target=event.key==='Home'?0:event.key==='End'?tabs.length-1:
          offset?(index+offset+tabs.length)%tabs.length:-1;
        if(target>=0){event.preventDefault();activate(tabs[target].dataset.experimentTab,true);}
      });
    });
    const visibility=()=>{if(document.hidden)stop();};
    // `#hike?map=1001`: the tab is the part before `?`; games read their own parameters.
    const tabFromHash=()=>location.hash.slice(1).split('?')[0];
    const hash=()=>activate(tabFromHash());
    let listening=false;
    const resume=()=>{
      if(!listening){document.addEventListener('visibilitychange',visibility);window.addEventListener('hashchange',hash);listening=true;}
      activate(tabFromHash());
    };
    const pause=()=>{
      stop();document.removeEventListener('visibilitychange',visibility);window.removeEventListener('hashchange',hash);listening=false;
    };
    sessions.set(tablist,{resume,pause});resume();return pause;
  };

  // Also boot independently of the blog's navigation script. This supports a
  // freshly deployed games page even if an older navigation script is cached.
  let pauseActive=()=>{};
  const boot=()=>{pauseActive();pauseActive=window.initLabGames();};
  document.addEventListener('pjax:send',()=>pauseActive());
  document.addEventListener('pjax:complete',boot);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
