/* Marrow Rite browser-to-browser 1v1.
   Gives the game the same storage and player interface it uses on claude.ai, but the match lives in the
   host player's browser and travels to the guest over WebRTC (PeerJS introduces the two browsers).
   Anyone can open this page, so everything received from the other player is checked before the game sees it. */
(function(){
  var PREFIX='marrowrite-1v1-',MAX=400000;
  var ls=null;try{ls=window.localStorage}catch(e){}
  function lsGet(k){try{return ls?ls.getItem(k):null}catch(e){return null}}
  function lsSet(k,v){try{if(ls)ls.setItem(k,v)}catch(e){}}
  function lsDel(k){try{if(ls)ls.removeItem(k)}catch(e){}}
  function rnd(n){var a=new Uint8Array(n),s='';crypto.getRandomValues(a);for(var i=0;i<n;i++)s+='abcdefghijklmnopqrstuvwxyz0123456789'[a[i]%36];return s}
  var uid=lsGet('mr-p2p-uid');
  if(!/^p_[a-z0-9]{16}$/.test(uid||'')){uid='p_'+rnd(16);lsSet('mr-p2p-uid',uid)}
  function cleanName(n){return String(n==null?'':n).replace(/[<>&"'`\\\u0000-\u001f]/g,'').trim().slice(0,24)}
  function myName(){return cleanName(lsGet('mr-p2p-name'))}
  var names={};names[uid]=myName();
  function err(code,msg){var e=new Error(msg);e.code=code;e.p2p=true;return e}

  /* ---- checking what the other browser sends ---- */
  var RICH={text:1,lines:1};
  function plain(s){return s.slice(0,300).replace(/[<>&"`\\]/g,'')}
  function rich(s){
    return s.slice(0,1500).replace(/<(\/?(?:b|i)|\/span|span class="tmark")>|[<>"`]/g,function(m,tag){
      return tag?m:({'<':'&lt;','>':'&gt;','"':'&quot;','`':''})[m]});
  }
  function clean(v,key,depth){
    if(depth>14)return null;
    if(v===null||typeof v==='boolean')return v;
    if(typeof v==='number')return isFinite(v)?v:0;
    if(typeof v==='string')return RICH[key]?rich(v):plain(v);
    if(Array.isArray(v))return v.slice(0,200).map(function(x){return clean(x,key,depth+1)});
    if(typeof v==='object'){
      var o={};
      Object.keys(v).slice(0,200).forEach(function(k){
        if(!/^[A-Za-z0-9_$-]{1,40}$/.test(k)||k==='__proto__'||k==='constructor'||k==='prototype')return;
        o[k]=clean(v[k],k,depth+1);
      });
      return o;
    }
    return null;
  }
  function has(o,k){return Object.prototype.hasOwnProperty.call(o,k)}
  function checkState(json){
    if(json==='')return '';
    if(typeof json!=='string'||json.length>MAX)return null;
    var st;try{st=clean(JSON.parse(json),'',0)}catch(e){return null}
    try{
      if(!Array.isArray(st.s)||st.s.length!==2||!Array.isArray(st.rec))return null;
      for(var i=0;i<2;i++){
        var s=st.s[i];
        if(!Array.isArray(s.team)||s.team.length!==3)return null;
        if(!s.team.every(function(m){return m&&has(FIGHTERS,m.f)}))return null;
        if(![s.deck,s.hand,s.discard].every(function(a){return Array.isArray(a)&&a.every(function(c){return c&&has(CARD,c.i)})}))return null;
      }
      if(!st.rec.every(function(e){return e&&typeof e==='object'&&(!e.c||e.c.g||has(CARD,e.c.i))}))return null;
    }catch(e){return null}
    return JSON.stringify(st);
  }
  function checkDeck(json){
    if(json==='')return '';
    if(typeof json!=='string'||json.length>6000)return null;
    var d;try{d=clean(JSON.parse(json),'',0)}catch(e){return null}
    try{
      if(!Array.isArray(d.team)||d.team.length!==3||new Set(d.team).size!==3)return null;
      if(!d.team.every(function(id){return ROSTER.indexOf(id)>=0||id==='vorhul'}))return null;
      var total=0,ids=Object.keys(d.cards);
      if(!ids.every(function(id){var n=d.cards[id];if(!has(CARD,id)||!Number.isInteger(n)||n<1||n>LIMIT(CARD[id])||!eligible(CARD[id],d.team))return false;total+=n;return true}))return null;
      if(total!==30)return null;
      return JSON.stringify({name:plain(String(d.name||'Deck')),team:d.team,cards:d.cards});
    }catch(e){return null}
  }
  var STATUS={waiting:1,live:1,over:1};
  function int(n){return Number.isInteger(n)&&n>=0&&n<1e15?n:null}
  function checkDoc(d){
    if(!d||typeof d!=='object')return null;
    var hd=checkDeck(d.hostDeck),gd=checkDeck(d.guestDeck),st=checkState(d.state),ver=int(d.ver);
    if(hd===null||gd===null||st===null||ver===null||!STATUS[d.status])return null;
    return{code:plain(String(d.code||'')),host:plain(String(d.host||'')),guest:plain(String(d.guest||'')),hostDeck:hd,guestDeck:gd,status:d.status,ver:ver,state:st,created:int(d.created)||0,updated:int(d.updated)||0};
  }

  function newPeer(id){
    if(!window.Peer)throw err('unavailable','The connection library did not load. Check your internet connection or ad blocker, then reload.');
    return id?new Peer(id,{debug:0}):new Peer({debug:0});
  }
  function snapOf(doc){return{exists:!!doc,data:function(){return doc?JSON.parse(JSON.stringify(doc)):null},fromCache:false,hasPendingWrites:false}}

  /* ---- host side: owns the match document ---- */
  var hosting=null;
  function hostKey(code){return 'mr-p2p-match-'+code}
  function loadHosted(code){try{return JSON.parse(lsGet(hostKey(code))||'null')}catch(e){return null}}
  function Host(code,doc){
    var h=this;h.code=code;h.doc=doc;h.subs=[];h.conn=null;h.dead=false;h.peer=null;
    h.save=function(){if(h.doc)lsSet(hostKey(code),JSON.stringify(h.doc));else lsDel(hostKey(code))};
    h.emit=function(){h.subs.slice().forEach(function(f){try{f(snapOf(h.doc))}catch(e){console.error(e)}})};
    h.push=function(force){if(h.conn&&h.conn.open)h.conn.send({t:'doc',doc:h.doc,names:names,force:!!force})};
    h.open=function(tries){return new Promise(function(ok,no){
      var done=false,p;try{p=newPeer(PREFIX+code)}catch(e){return no(e)}
      h.peer=p;
      var timer=setTimeout(function(){if(!done){done=true;try{p.destroy()}catch(e){}no(err('unavailable','Could not reach the connection service. Try again in a moment.'))}},15000);
      p.on('open',function(){if(!done){done=true;clearTimeout(timer);ok()}});
      p.on('disconnected',function(){if(!h.dead&&!p.destroyed)setTimeout(function(){try{if(!h.dead&&!p.destroyed&&p.disconnected)p.reconnect()}catch(e){}},1500)});
      p.on('connection',function(c){h.accept(c)});
      p.on('error',function(e){
        if(done)return;done=true;clearTimeout(timer);try{p.destroy()}catch(_){}
        if(e&&e.type==='unavailable-id'&&tries>0)return setTimeout(function(){h.open(tries-1).then(ok,no)},2500);
        no(err(e&&e.type||'unavailable',e&&e.type==='unavailable-id'?'That match code is taken. Press Create match again.':'Could not reach the connection service. Try again in a moment.'));
      });
    })};
    h.accept=function(c){
      var who=null;
      setTimeout(function(){if(!who)try{c.close()}catch(e){}},15000);
      c.on('data',function(m){
        try{
          if(!m||typeof m!=='object'||!h.doc)return;
          if(m.t==='hello'){
            if(!/^p_[a-z0-9]{16}$/.test(m.uid||'')||m.uid===uid)return c.close();
            if(h.doc.guest&&h.doc.guest!==m.uid){c.send({t:'full'});return}
            who=m.uid;names[who]=cleanName(m.name);
            if(h.doc.guest===who){if(h.conn&&h.conn!==c)try{h.conn.close()}catch(e){}h.conn=c}
            c.send({t:'doc',doc:h.doc.guest===who?h.doc:{code:code,host:h.doc.host,guest:'',hostDeck:'',guestDeck:'',status:'waiting',ver:0,state:'',created:h.doc.created,updated:h.doc.updated},names:names});
            return;
          }
          if(!who)return;
          if(m.t==='ping'){c.send({t:'pong'});return}
          if(m.t==='patch')c.send(h.remote(who,c,m));
        }catch(e){console.error(e)}
      });
      c.on('close',function(){if(h.conn===c)h.conn=null});
    };
    h.remote=function(who,c,m){
      var p=m.patch||{},bad={t:'nack',id:m.id};
      if(typeof p!=='object')return bad;
      if(!h.doc.guest){
        var gd=checkDeck(p.guestDeck);
        if(p.guest!==who||!gd)return bad;
        h.doc.guest=who;h.doc.guestDeck=gd;h.doc.updated=Date.now();h.conn=c;
      }else{
        if(h.doc.guest!==who)return bad;
        if('state' in p){
          var st=checkState(p.state),v=int(p.ver);
          if(!st||v===null||(p.status!=='live'&&p.status!=='over'))return bad;
          if(v!==h.doc.ver+1){setTimeout(function(){h.push(true)},0);return{t:'ack',id:m.id}}
          h.doc.state=st;h.doc.ver=v;h.doc.status=p.status;h.doc.updated=Date.now();
        }
      }
      h.save();setTimeout(function(){h.emit();h.push()},0);
      return{t:'ack',id:m.id};
    };
    h.local=function(p){
      if(!h.doc)throw err('not_found','This match was cancelled.');
      var clash=('ver' in p)&&p.ver<=h.doc.ver&&h.doc.ver>0;
      Object.keys(p).forEach(function(k){h.doc[k]=p[k]});
      if(clash)h.doc.ver=p.ver;
      h.save();h.emit();h.push(clash);
    };
    h.close=function(){h.dead=true;if(h.peer)try{h.peer.destroy()}catch(e){}if(hosting===h)hosting=null};
  }

  /* ---- guest side: mirrors the host's document ---- */
  var guesting=null;
  function Guest(code){
    var g=this;g.code=code;g.doc=undefined;g.subs=[];g.conn=null;g.peer=null;g.dead=false;g.pending={};g.seq=0;g.first=null;g.fails=0;g.lastSeen=0;g.lost=false;
    g.emit=function(){g.subs.slice().forEach(function(f){try{f.next(snapOf(g.doc))}catch(e){console.error(e)}})};
    g.fail=function(e){g.subs.forEach(function(f){if(f.err)try{f.err(e)}catch(_){}})};
    g.settle=function(v,e){if(!g.first)return;var f=g.first;g.first=null;clearTimeout(f.timer);e?f.no(e):f.ok(v)};
    g.start=function(){return new Promise(function(ok,no){
      g.first={ok:ok,no:no,timer:setTimeout(function(){g.settle(null,err('unavailable','Could not connect to the other player. Their network or yours may block direct connections.'))},20000)};
      g.dial();
    })};
    g.dial=function(){
      if(g.dead)return;
      if(g.peer)try{g.peer.destroy()}catch(e){}
      var p;try{p=g.peer=newPeer()}catch(e){return g.settle(null,e)}
      p.on('open',function(){
        if(g.dead||g.peer!==p)return;
        var c=g.conn=p.connect(PREFIX+code,{reliable:true});
        c.on('open',function(){c.send({t:'hello',uid:uid,name:myName()})});
        c.on('data',function(m){if(g.conn===c)g.recv(m)});
        c.on('close',function(){if(g.conn===c)g.retry()});
      });
      p.on('error',function(e){
        if(g.dead||g.peer!==p)return;
        if(g.first&&e&&e.type==='peer-unavailable'){g.settle(null);return}
        if(g.first){g.settle(null,err(e&&e.type||'unavailable','Could not reach the connection service. Try again in a moment.'));return}
        g.retry();
      });
    };
    g.retry=function(){
      if(g.dead||g.first||g.waiting)return;
      g.conn=null;g.fails++;g.lost=true;g.waiting=true;
      Object.keys(g.pending).forEach(function(k){g.pending[k].no(err('unavailable','Connection lost.'));delete g.pending[k]});
      if(g.fails===1)note('Connection lost. Reconnecting…');
      if(g.fails===15)g.fail(err('unavailable','Lost contact with the other player.'));
      setTimeout(function(){g.waiting=false;g.dial()},Math.min(2000*g.fails,10000));
    };
    g.recv=function(m){
      if(!m||typeof m!=='object')return;
      g.lastSeen=Date.now();
      if(m.t==='full'){g.settle({code:code,host:'x',guest:'taken',hostDeck:'',guestDeck:'',status:'live',ver:0,state:''});return}
      if(m.t==='ack'||m.t==='nack'){var w=g.pending[m.id];if(w){delete g.pending[m.id];m.t==='ack'?w.ok():w.no(err('rejected','The other player\'s game did not accept that. Make sure you both have the latest page (reload).'))}return}
      if(m.t!=='doc')return;
      if(m.doc===null){g.doc=null;g.settle(null);g.emit();return}
      var d=checkDoc(m.doc);
      if(!d){g.settle(null,err('rejected','The match data did not look right, so it was not loaded.'));return}
      if(m.names&&typeof m.names==='object'&&has(m.names,d.host))names[d.host]=cleanName(m.names[d.host]);
      if(g.lost){g.lost=false;g.fails=0;note('Reconnected.');force()}
      else if(m.force)force();
      g.doc=d;g.settle(d);g.emit();
    };
    function force(){try{PVP.ver=-1}catch(e){}}
    g.patch=function(p){return new Promise(function(ok,no){
      if(!g.conn||!g.conn.open)return no(err('unavailable','Not connected to the other player right now. Your move will need to be made again once you reconnect.'));
      var id=++g.seq;g.pending[id]={ok:ok,no:no};
      g.conn.send({t:'patch',id:id,patch:p});
      setTimeout(function(){if(g.pending[id]){delete g.pending[id];no(err('unavailable','The other player did not respond.'))}},15000);
    })};
    g.beat=setInterval(function(){
      if(g.dead||!g.conn||!g.conn.open)return;
      try{g.conn.send({t:'ping'})}catch(e){}
      if(g.lastSeen&&Date.now()-g.lastSeen>20000){var c=g.conn;try{c.close()}catch(e){}g.retry()}
    },5000);
    g.close=function(){g.dead=true;clearInterval(g.beat);if(g.peer)try{g.peer.destroy()}catch(e){}if(guesting===g)guesting=null};
  }
  function note(t){try{toast(t)}catch(e){}}

  /* ---- the interface the game calls ---- */
  function matchRef(code){
    function role(){return hosting&&hosting.code===code?hosting:guesting&&guesting.code===code?guesting:null}
    return{id:code,path:'matches/'+code,
      get:function(){
        var r=role();if(r&&r.doc!==undefined)return Promise.resolve(snapOf(r.doc));
        var mine=loadHosted(code);
        if(mine&&mine.host===uid){
          if(hosting)hosting.close();
          var h=hosting=new Host(code,mine);
          return h.open(8).then(function(){return snapOf(h.doc)},function(e){h.close();throw e});
        }
        if(matchRef.creating)return Promise.resolve(snapOf(null));
        if(guesting)guesting.close();
        var g=guesting=new Guest(code);
        return g.start().then(function(d){if(!d||d.guest==='taken')g.close();return snapOf(d)},function(e){g.close();throw e});
      },
      set:function(d){
        if(hosting)hosting.close();
        var h=hosting=new Host(code,JSON.parse(JSON.stringify(d)));
        return h.open(0).then(function(){h.save()},function(e){h.close();throw e});
      },
      update:function(p){
        var r=role();
        if(!r)return Promise.reject(err('not_found','This match is no longer open.'));
        if(r===hosting)return Promise.resolve().then(function(){r.local(p)});
        return r.patch(p);
      },
      delete:function(){
        var r=role();lsDel(hostKey(code));
        if(r&&r===hosting){if(r.conn&&r.conn.open)r.conn.send({t:'doc',doc:null});r.doc=null;setTimeout(function(){r.close()},300)}
        return Promise.resolve();
      },
      onSnapshot:function(next,onErr){
        var r=role();if(!r){if(onErr)onErr(err('not_found','This match is no longer open.'));return function(){}}
        var f=r===hosting?next:{next:next,err:onErr};r.subs.push(f);
        setTimeout(function(){if(r.subs.indexOf(f)>=0&&r.doc!==undefined)next(snapOf(r.doc))},0);
        return function(){
          r.subs=r.subs.filter(function(x){return x!==f});
          if(r===guesting)r.close();
        };
      }
    };
  }
  function localRef(path){
    var none=function(){return Promise.resolve()};
    return{id:path.split('/').pop(),path:path,get:function(){return Promise.resolve(snapOf(null))},set:none,update:none,delete:none,onSnapshot:function(){return function(){}}};
  }
  var db={doc:function(p){return p.indexOf('matches/')===0?matchRef(p.slice(8)):localRef(p)}};
  var user={
    id:function(){return Promise.resolve(uid)},
    me:function(){return Promise.resolve({id:uid,name:myName(),isOwner:false,canEdit:false})},
    name:function(){return Promise.resolve(myName())},
    isOwner:function(){return Promise.resolve(false)},
    canEdit:function(){return Promise.resolve(false)},
    can:function(){return Promise.resolve(true)},
    profiles:function(ids){var o={};ids.forEach(function(id){o[id]={id:id,name:id===uid?myName():(names[id]||''),isMe:id===uid}});return Promise.resolve(o)}
  };
  window.claude={use:function(n){return Promise.resolve(n==='db'?db:n==='user'?user:null)}};
  window.MR_HOSTED=true;
  window.addEventListener('pagehide',function(e){if(e.persisted)return;if(hosting)try{hosting.peer.destroy()}catch(_){}if(guesting)try{guesting.peer.destroy()}catch(_){}});

  function askName(){
    var wrap=document.createElement('div');
    wrap.className='overlay';wrap.id='name-ask';
    wrap.innerHTML='<form class="res-card" style="text-align:left;justify-items:stretch"><p class="eyebrow">Welcome to the Rite</p><h2 style="font-size:40px">Your name</h2><p>This is how your opponent will see you in 1v1 matches.</p><label class="hint" for="host-name-input">Display name</label><input id="host-name-input" class="vs-input" style="width:100%;letter-spacing:.04em;text-transform:none" maxlength="24" autocomplete="nickname" required><button class="btn gold" type="submit">Enter</button></form>';
    document.body.appendChild(wrap);
    var input=wrap.querySelector('input');setTimeout(function(){input.focus()},50);
    wrap.querySelector('form').addEventListener('submit',function(ev){
      ev.preventDefault();var n=cleanName(input.value);if(!n)return;
      lsSet('mr-p2p-name',n);names[uid]=n;wrap.remove();
      try{PVP.names[uid]=n;if(CUR_SCREEN==='versus')renderVersus()}catch(e){}
    });
  }
  function start(){
    try{
      saveErr=function(e){return e&&e.p2p?e.message:'Could not reach the other player. Try again in a moment.'};
      var _create=createMatch;
      createMatch=function(){matchRef.creating=true;return Promise.resolve(_create()).finally(function(){matchRef.creating=false})};
      var sub=document.getElementById('vs-status');
      if(sub){var p=document.createElement('p');p.className='hint';p.style.margin='8px 0 0';p.textContent='Matches connect your browser straight to your opponent\'s, so they can see your internet (IP) address. Keep this tab open while you play: the match lives in the host\'s browser.';sub.parentNode.insertBefore(p,sub.nextSibling)}
    }catch(e){console.error(e)}
    if(!myName())askName();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
