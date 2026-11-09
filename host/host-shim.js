/* Marrow Rite host adapter: gives the game the same storage and player interface it uses on claude.ai,
   backed by the server running on the host's PC. */
(function(){
  var API='/api';
  var uid=null,store=null;
  try{store=window.localStorage}catch(e){}
  function lsGet(k){try{return store?store.getItem(k):null}catch(e){return null}}
  function lsSet(k,v){try{if(store)store.setItem(k,v)}catch(e){}}
  uid=lsGet('mr-host-uid');
  if(!uid||!/^p_[a-z0-9]{4,20}$/.test(uid)){uid='p_'+Math.random().toString(36).slice(2,12);lsSet('mr-host-uid',uid)}
  function myName(){return lsGet('mr-host-name')||''}
  function req(method,url,body){
    return fetch(url,{method:method,cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined})
      .then(function(r){if(!r.ok){var e=new Error('Server said '+r.status);e.code=r.status===404?'invalid_argument':'unavailable';throw e}return r.json()});
  }
  function url(path,extra){return API+'/doc?path='+encodeURIComponent(path)+(extra||'')}
  function snap(r){return{exists:!!r.exists,data:function(){return r.data},fromCache:false,hasPendingWrites:false}}
  function docRef(path){
    return{id:path.split('/').pop(),path:path,
      get:function(){return req('GET',url(path)).then(snap)},
      set:function(d){return req('PUT',url(path),d).then(function(){})},
      update:function(d){return req('PATCH',url(path),d).then(function(){})},
      delete:function(){return req('DELETE',url(path)).then(function(){})},
      onSnapshot:function(next,onErr){
        var stop=false,rev=-1,fails=0;
        function tick(){
          if(stop)return;
          req('GET',url(path,'&since='+rev)).then(function(r){
            fails=0;
            if(r.changed!==false){rev=r.rev;next(snap(r))}
          }).catch(function(e){fails++;if(fails===10&&onErr)try{onErr({code:'unavailable',message:'Lost contact with the host server.'})}catch(_){}})
          .then(function(){if(!stop)setTimeout(tick,fails?2000:800)});
        }
        tick();
        return function(){stop=true};
      },
      collection:function(p){return{doc:function(id){return docRef(path+'/'+p+'/'+id)}}}
    };
  }
  var db={doc:docRef,collection:function(p){return{doc:function(id){return docRef(p+'/'+id)}}}};
  var user={
    id:function(){return Promise.resolve(uid)},
    me:function(){return Promise.resolve({id:uid,name:myName(),isOwner:false,canEdit:false})},
    name:function(){return Promise.resolve(myName())},
    isOwner:function(){return Promise.resolve(false)},
    canEdit:function(){return Promise.resolve(false)},
    can:function(){return Promise.resolve(true)},
    profiles:function(ids){
      return req('GET',API+'/names?ids='+ids.map(encodeURIComponent).join(',')).then(function(r){
        var out={};ids.forEach(function(id){out[id]={id:id,name:(r&&r[id]&&r[id].name)||'',isMe:id===uid}});return out;
      }).catch(function(){var out={};ids.forEach(function(id){out[id]={id:id,name:'',isMe:id===uid}});return out});
    }
  };
  window.claude={use:function(n){return Promise.resolve(n==='db'?db:n==='user'?user:null)}};
  window.MR_HOSTED=true;

  function sendName(n){return req('POST',API+'/name',{id:uid,name:n}).catch(function(){})}
  function askName(){
    var wrap=document.createElement('div');
    wrap.className='overlay';wrap.id='name-ask';
    wrap.innerHTML='<form class="res-card" style="text-align:left;justify-items:stretch"><p class="eyebrow">Welcome to the Rite</p><h2 style="font-size:40px">Your name</h2><p>This is how your opponent will see you in 1v1 matches.</p><label class="hint" for="host-name-input">Display name</label><input id="host-name-input" class="vs-input" style="width:100%;letter-spacing:.04em;text-transform:none" maxlength="24" autocomplete="nickname" required><button class="btn gold" type="submit">Enter</button></form>';
    document.body.appendChild(wrap);
    var input=wrap.querySelector('input');input.value=myName();setTimeout(function(){input.focus()},50);
    wrap.querySelector('form').addEventListener('submit',function(ev){
      ev.preventDefault();var n=input.value.trim().slice(0,24);if(!n)return;
      lsSet('mr-host-name',n);sendName(n);wrap.remove();
      try{if(typeof PVP!=='undefined'){PVP.names[uid]=n;if(typeof renderVersus==='function'&&typeof CUR_SCREEN!=='undefined'&&CUR_SCREEN==='versus')renderVersus()}}catch(e){}
    });
  }
  function start(){if(myName())sendName(myName());else askName()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
