var NUVEM='https://copa-presida-default-rtdb.firebaseio.com/presida_v2.json';
var LINKS={
  padrao:{
    pix:350,
    credito:385,
    cartaoUrl:'https://pag.ae/82av5Uipo',
    pixBanco:'Santander',
    pixNome:'Welber Francisco Rodrigue',
    pixChave:'+5561981000648',
    pixPayload:'00020126530014br.gov.bcb.pix0114+55619810006480213Copa presida 5204000053039865406350.005802BR5925WELBER FRANCISCO RODRIGUE6008BRASILIA62580520SAN2026091311192582750300017br.gov.bcb.brcode01051.0.06304010E'
  },
  convidado:{
    pix:600,
    credito:660,
    cartaoUrl:'https://pag.ae/82av5xD4o',
    pixBanco:'Santander',
    pixNome:'Welber Francisco Rodrigue',
    pixChave:'+5561981000648',
    pixPayload:'00020126530014br.gov.bcb.pix0114+55619810006480213Copa presida 5204000053039865406600.005802BR5925WELBER FRANCISCO RODRIGUE6008BRASILIA62580520SAN2026091311244596150300017br.gov.bcb.brcode01051.0.06304EBBC'
  }
};
var catAtual='Iniciante';
var modoAtual='pix';
var pedidoPendente=null;
function isConvidado(c){c=String(c||'').toLowerCase();return c.indexOf('convidado')>=0}
function tabela(){return isConvidado(catAtual)?LINKS.convidado:LINKS.padrao}
function preco(modo){
  var t=tabela();
  return modo==='pix' ? t.pix : t.credito;
}
function fmt(n){return 'R$ '+Number(n).toFixed(2).replace('.',',')}
function urlPagBank(){return tabela().cartaoUrl;}
function payloadPix(){return tabela().pixPayload;}
function categoriaBloqueada(cat){
  return String(cat||'').toLowerCase().indexOf('profissional')>=0;
}
function abrirInsc(btn){
  if(btn.getAttribute('data-off')==='1' || btn.disabled || categoriaBloqueada(btn.getAttribute('data-cat'))){
    alert('Inscrições da categoria Profissional estão inativas.');
    return;
  }
  catAtual=btn.getAttribute('data-cat')||'Iniciante';
  document.getElementById('catLabel').textContent=catAtual;
  document.getElementById('payCat').textContent=catAtual;
  setModo('pix');
  document.getElementById('payVal').textContent=fmt(preco('pix'));
  var box=document.getElementById('inscricao');
  box.classList.add('show');
  atualizarTravaPagamento();
  box.scrollIntoView({behavior:'smooth'});
}
function atualizarPrecoTela(){
  var t=tabela();
  var hint=document.getElementById('payHint');
  if(hint) hint.textContent='PIX '+fmt(t.pix)+'. Cartão '+fmt(t.credito)+'.';
  var pv=document.getElementById('payVal');
  if(pv) pv.textContent=fmt(preco(modoAtual));
}
function setModo(m){
  if(m==='debito') m='pix';
  modoAtual=m;
  try{ atualizarTravaPagamento(); }catch(e){}
  document.querySelectorAll('.pay-tab').forEach(function(b){
    b.classList.toggle('active', b.getAttribute('data-modo')===m);
  });
  var pc=document.getElementById('panel-cartao');
  var pp=document.getElementById('panel-pix');
  if(pc) pc.classList.toggle('on', m==='cartao');
  if(pp) pp.classList.toggle('on', m==='pix');
  atualizarPrecoTela();
  var ja=document.getElementById('btnJaPaguei');
  if(ja) ja.style.display = (m==='cartao') ? 'block' : 'none';
}
function fecharTela(id){document.getElementById(id).classList.remove('open')}
function abrirTelaMetodo(m){
  if(!okFormSilencioso()){
    document.getElementById('payMsg').className='note err';
    document.getElementById('payMsg').textContent='Preencha a ficha completa do atleta antes do PIX.';
    return;
  }
  if(!okForm()) return;
  setModo('pix');
  var tb=tabela();
  document.getElementById('metodoTitulo').textContent='PIX';
  document.getElementById('metodoSub').textContent='Pague no app do banco com este PIX. Recebedor: '+tb.pixNome+'.';
  document.getElementById('metodoValor').textContent=fmt(preco('pix'));
  document.getElementById('metodoCat').textContent=catAtual;
  document.getElementById('pixPayload').value=tb.pixPayload;
  document.getElementById('pixQr').src='https://api.qrserver.com/v1/create-qr-code/?size=184x184&data='+encodeURIComponent(tb.pixPayload);
  document.getElementById('telaMetodo').classList.remove('open');
  document.getElementById('telaPixTut').classList.add('open');
  var n=3;
  document.getElementById('pixTutCount').textContent=n;
  var sec=document.getElementById('pixTutSec');
  if(sec) sec.textContent=n;
  clearInterval(window._pixTut);
  window._pixTut=setInterval(function(){
    n--;
    document.getElementById('pixTutCount').textContent=n>0?n:0;
    if(sec) sec.textContent=n>0?n:0;
    if(n<=0){
      clearInterval(window._pixTut);
      fecharTela('telaPixTut');
      document.getElementById('telaMetodo').classList.add('open');
      esconderConfirmarPix();
      observarRetornoPix();
    }
  },1000);
}
var pixGate={on:false,saiu:false,tSaiu:0,liberado:false};
var PIX_FORA_MS=3000;
function esconderConfirmarPix(){
  pixGate={on:false,saiu:false,tSaiu:0,liberado:false};
  travarBotaoVerificarPix();
  var slot=document.getElementById('pixConfirmSlot');
  if(slot) slot.innerHTML='';
  var h=document.getElementById('pixConfirmaHint');
  if(h){
    h.style.display='block';
    h.textContent='Abra o app, pague e volte. Cole o ID E2E do comprovante para verificar.';
  }
}
function liberarBotaoVerificarPix(){
  var b=document.getElementById('btnVerificarPix');
  if(b){
    b.disabled=false;
    b.textContent='Verificar PIX';
  }
  var h=document.getElementById('pixConfirmaHint');
  if(h) h.textContent='Cole o ID E2E do comprovante e toque em Verificar PIX.';
}
function travarBotaoVerificarPix(){
  var b=document.getElementById('btnVerificarPix');
  if(b){
    b.disabled=false;
    b.textContent='Verificar PIX';
  }
}
function mostrarConfirmarPix(){
  if(pixGate.liberado) return;
  if(!okFormSilencioso()) return;
  if(!pixGate.saiu || !pixGate.tSaiu) return;
  if(Date.now()-pixGate.tSaiu < PIX_FORA_MS) return;
  pixGate.liberado=true;
  liberarBotaoVerificarPix();
}
function observarRetornoPix(){
  pixGate={on:true,saiu:false,tSaiu:0,liberado:false};
  var onVis=function(){
    if(!pixGate.on) return;
    if(document.hidden){
      if(!pixGate.saiu){pixGate.saiu=true;pixGate.tSaiu=Date.now();}
      return;
    }
    mostrarConfirmarPix();
  };
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('pagehide', function(){
    if(!pixGate.on) return;
    if(!pixGate.saiu){pixGate.saiu=true;pixGate.tSaiu=Date.now();}
  });
  window.addEventListener('focus', function(){
    if(!pixGate.on) return;
    mostrarConfirmarPix();
  });
}
function copiarPix(){
  var v=document.getElementById('pixPayload').value;
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(v).then(function(){
      document.getElementById('payMsg').className='note ok';
      document.getElementById('payMsg').textContent='Código PIX copiado.';
    });
  } else {
    document.getElementById('pixPayload').select();
    document.execCommand('copy');
  }
}
async function marcarPixPago(){
  modoAtual='pix';
  var slot=document.getElementById('pixConfirmSlot');
  if(!okFormSilencioso()){
    if(slot) slot.innerHTML='<p class="note err">Preencha a ficha completa do atleta antes de confirmar.</p>';
    return;
  }
  var titular=(document.getElementById('pixTitular')||{}).value||'';
  titular=String(titular).trim();
  var cpf=soDigitos((document.getElementById('pixTitularCpf')||{}).value||'');
  if(titular.length<5 || cpf.length!==11){
    if(slot) slot.innerHTML='<p class="note err">Informe o nome e o CPF do titular da conta.</p>';
    return;
  }
  var item=ficha();
  item.banco='Santander';
  item.pixChave=tabela().pixChave;
  item.metodo='pix';
  item.titular=titular;
  item.titularCpf=cpf;
  pedidoPendente=item;
  await salvarNuvem(item);
  var tEl=document.getElementById('titular');
  var cEl=document.getElementById('titularCpf');
  if(tEl) tEl.value=titular;
  if(cEl) cEl.value=document.getElementById('pixTitularCpf').value;
  fecharTela('telaMetodo');
  abrirRetorno(item);
}

function soDigitos(v){return String(v||'').replace(/\D/g,'')}
function okForm(){
  var ids=['nome','cpf','email','whats','insta','pNome','pInsta'];
  for(var i=0;i<ids.length;i++){
    var el=document.getElementById(ids[i]);
    var v=(el&&el.value||'').trim();
    if(!v){document.getElementById('payMsg').textContent='Preencha nome, CPF, e-mail, telefone e Instagram. Do parceiro: nome e Instagram.';document.getElementById('payMsg').className='note err';return false;}
  }
  if(soDigitos(document.getElementById('cpf').value).length!==11){
    document.getElementById('payMsg').textContent='CPF do atleta inválido.';document.getElementById('payMsg').className='note err';return false;
  }
  if(!/.+@.+\..+/.test(document.getElementById('email').value)) {document.getElementById('payMsg').textContent='E-mail do atleta inválido.';document.getElementById('payMsg').className='note err';return false;}
  return true;
}
function instaLimpo(v){
  v=String(v||'').trim();
  if(!v) return '';
  if(v.charAt(0)!=='@') v='@'+v.replace(/^@+/,'');
  return v;
}

function fichaPreenchida(){
  try{return okFormSilencioso();}catch(e){return false;}
}
function valCampo(id){
  var el=document.getElementById(id);
  return el ? String(el.value||'').trim() : '';
}
function okFormSilencioso(){
  if(!valCampo('nome') || !valCampo('email') || !valCampo('whats') || !valCampo('insta') || !valCampo('pNome') || !valCampo('pInsta')) return false;
  if(soDigitos(valCampo('cpf')).length!==11) return false;
  if(valCampo('email').indexOf('@')<1 || valCampo('email').indexOf('.')<3) return false;
  return true;
}
function atualizarTravaPagamento(){
  var ok=okFormSilencioso();
  var card=document.getElementById('cardPagamento');
  var trava=document.getElementById('pagtoTrava');
  if(card) card.style.display='block';
  if(trava) trava.style.display=ok?'none':'block';
  var tabs=document.querySelector('#cardPagamento .pay-tabs');
  if(tabs) tabs.style.display=ok?'flex':'none';
  var pc=document.getElementById('panel-cartao');
  var pp=document.getElementById('panel-pix');
  if(ok){
    if(modoAtual==='pix'){
      if(pc){pc.classList.remove('on'); pc.style.display='none';}
      if(pp){pp.classList.add('on'); pp.style.display='block';}
    } else {
      if(pp){pp.classList.remove('on'); pp.style.display='none';}
      if(pc){pc.classList.add('on'); pc.style.display='block';}
    }
  } else {
    if(pc){pc.classList.remove('on'); pc.style.display='none';}
    if(pp){pp.classList.remove('on'); pp.style.display='none';}
    var slot=document.getElementById('pixConfirmSlot');
    if(slot) slot.innerHTML='';
    if(window.pixGate) pixGate.liberado=false;
  }
  var ja=document.getElementById('btnJaPaguei');
  if(ja) ja.style.display=(ok && modoAtual==='cartao')?'block':'none';
}

function ficha(){
  return {
    id:'INS-'+Date.now().toString(36).toUpperCase(),
    nome:document.getElementById('nome').value.trim(),
    cpf:soDigitos(document.getElementById('cpf').value),
    whatsapp:document.getElementById('whats').value.trim(),
    email:document.getElementById('email').value.trim(),
    instagram:instaLimpo(document.getElementById('insta').value),
    parceiro:document.getElementById('pNome').value.trim(),
    parceiroInstagram:instaLimpo(document.getElementById('pInsta').value),
    categoria:catAtual,
    valor:preco(modoAtual),
    metodo:modoAtual,
    status:'aguardando',
    createdAt:new Date().toISOString()
  };
}
async function lerNuvem(){
  var r=await fetch(NUVEM,{cache:'no-store'});
  return r.ok?(await r.json()||{}):{};
}
async function gravarNuvem(db){
  db.updatedAt=new Date().toISOString();
  await fetch(NUVEM,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(db)});
}
async function apagarInscricao(id){
  if(!id) return;
  if(!confirm('Apagar a inscrição de '+id+'?')) return;
  try{
    var db=await lerNuvem();
    if(!db.inscricoes || typeof db.inscricoes!=='object') db.inscricoes={};
    delete db.inscricoes[id];
    Object.keys(db.inscricoes).forEach(function(k){
      if((db.inscricoes[k]&&db.inscricoes[k].id)===id) delete db.inscricoes[k];
    });
    await gravarNuvem(db);
    listar();
  }catch(e){alert('Não deu para apagar agora.');}
}
async function salvarNuvem(item){
  try{
    var r=await fetch(NUVEM,{cache:'no-store'});
    var db=r.ok?(await r.json()||{}):{};
    if(!db.inscricoes || typeof db.inscricoes!=='object') db.inscricoes={};
    db.inscricoes[item.id]=item;
    db.updatedAt=new Date().toISOString();
    await fetch(NUVEM,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(db)});
  }catch(e){}
  try{localStorage.setItem('presida_v2_last',JSON.stringify(item));}catch(e){}
}
async function iniciarPagamento(modo){
  modoAtual=modo||modoAtual;
  if(categoriaBloqueada(catAtual)){alert('Profissional está inativo.');return;}
  if(modoAtual==='pix'){abrirTelaMetodo('pix');return;}
  if(!okForm()) return;
  var item=ficha();
  pedidoPendente=item;
  await salvarNuvem(item);
  document.getElementById('payMsg').className='note ok';
  document.getElementById('payMsg').textContent='Ficha '+item.id+' salva. Leia o tutorial antes de pagar no PagBank.';
  document.getElementById('telaMetodo').classList.remove('open');
  document.getElementById('telaTutorial').classList.add('open');
}
function urlRetornoSite(item){
  var base=location.href.split('#')[0].split('?')[0];
  return base+'?pagbank=retorno&ref='+encodeURIComponent((item&&item.id)||'')+'&cat='+encodeURIComponent((item&&item.categoria)||'')+'&metodo=cartao';
}
async function checkoutPagBankComRetorno(item){
  var body={
    nome:item.nome,
    email:item.email,
    whatsapp:item.whatsapp,
    cpf:item.cpf,
    categoria:item.categoria,
    referencia:item.id,
    valorCentavos:Math.round(Number(item.valor||0)*100),
    metodo:'cartao',
    redirect_url:urlRetornoSite(item)
  };
  var endpoints=['/api/pagbank-checkout','/.netlify/functions/pagbank-checkout'];
  for(var i=0;i<endpoints.length;i++){
    try{
      var r=await fetch(endpoints[i],{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      if(!r.ok) continue;
      var data=await r.json();
      if(data&&data.ok&&data.paymentUrl) return data.paymentUrl;
    }catch(e){}
  }
  return '';
}
var pagbankAguardando=false;
function voltarDoPagBank(){
  pagbankAguardando=false;
  var item=pedidoPendente;
  try{if(!item) item=JSON.parse(localStorage.getItem('presida_v2_last')||'null');}catch(e){}
  fecharTela('telaEspera');
  abrirRetorno(item);
}
function observarRetornoPagBank(){
  pagbankAguardando=false;
  setTimeout(function(){
    pagbankAguardando=true;
    var volta=function(){
      if(!pagbankAguardando) return;
      if(document.hidden) return;
      voltarDoPagBank();
    };
    document.addEventListener('visibilitychange', volta);
    window.addEventListener('focus', volta);
    window.addEventListener('pageshow', volta);
  }, 8000);
}
async function seguirParaPagBank(){
  var item=pedidoPendente;
  if(!item){
    try{item=JSON.parse(localStorage.getItem('presida_v2_last')||'null');}catch(e){item=null;}
  }
  if(!item){fecharTela('telaTutorial');return;}
  try{localStorage.setItem('presida_v2_retorno',JSON.stringify({id:item.id,url:urlRetornoSite(item)}));}catch(e){}
  var apiUrl=await checkoutPagBankComRetorno(item);
  fecharTela('telaTutorial');
  if(apiUrl){
    location.href=apiUrl;
    return;
  }
  document.getElementById('telaEspera').classList.add('open');
  observarRetornoPagBank();
  var w=window.open(urlPagBank(),'_blank');
  if(!w){
    document.getElementById('esperaMsg').textContent='O navegador bloqueou a nova aba. Toque em ir ao PagBank.';
    location.href=urlPagBank();
  }
}
function abrirRetorno(item){
  document.getElementById('inscricao').classList.add('show');
  document.getElementById('telaRetorno').classList.add('open');
  document.getElementById('retRef').textContent=item&&item.id?item.id:'—';
  document.getElementById('retCat').textContent=(item&&item.categoria)||catAtual;
  document.getElementById('retVal').textContent=fmt((item&&item.valor)||preco(modoAtual));
  var n=document.getElementById('pixTitular');
  var c=document.getElementById('pixTitularCpf');
  if(n && n.value && document.getElementById('titular') && !document.getElementById('titular').value) document.getElementById('titular').value=n.value;
  if(c && c.value && document.getElementById('titularCpf') && !document.getElementById('titularCpf').value) document.getElementById('titularCpf').value=c.value;
}
async function e2eJaUsado(e2e){
  try{
    var r=await fetch(NUVEM,{cache:'no-store'});
    var db=r.ok?(await r.json()||{}):{};
    return toArr(db.inscricoes).some(function(x){return String(x.e2e||'').toUpperCase()===e2e && String(x.status||'')==='pago';});
  }catch(e){return false;}
}
async function resgatarIngresso(){
  var titular=(document.getElementById('titular').value||'').trim();
  var cpf=(document.getElementById('titularCpf').value||'').replace(/\D/g,'');
  if(titular.length<5 || cpf.length!==11){
    document.getElementById('retMsg').className='note err';
    document.getElementById('retMsg').textContent='Informe o nome e o CPF do titular da conta que pagou.';
    return;
  }
  var item=null;
  try{item=JSON.parse(localStorage.getItem('presida_v2_last')||'null');}catch(e){}
  if(!item) item=ficha();
  if(categoriaBloqueada(item.categoria)){
    document.getElementById('retMsg').className='note err';
    document.getElementById('retMsg').textContent='Categoria Profissional está inativa.';
    return;
  }
  item.status='pago';
  item.titular=titular;
  item.titularCpf=cpf;
  item.ingresso='PRESIDA-'+String(item.id||'').replace('INS-','');
  item.pagoEm=new Date().toISOString();
  await salvarNuvem(item);
  document.getElementById('ticketBox').style.display='block';
  document.getElementById('ticketCode').textContent=item.ingresso;
  document.getElementById('ticketDupla').textContent=(item.nome||'')+' / '+(item.parceiro||'')+' · '+(item.categoria||'');
  document.getElementById('retMsg').className='note ok';
  document.getElementById('retMsg').textContent='Conta confirmada. Ingresso liberado.';
  pedidoPendente=item;
}
function waOrg(txt){
  location.href='https://wa.me/5561995945367?text='+encodeURIComponent(txt);
}
function itemAtual(){
  var item=pedidoPendente;
  try{if(!item) item=JSON.parse(localStorage.getItem('presida_v2_last')||'null');}catch(e){}
  if(!item){ try{item=ficha();}catch(e){item={};} }
  return item||{};
}
function enviarIngressoWhats(){
  var item=itemAtual();
  waOrg('Copa Presida — ingresso '+(item.ingresso||'')+'\nDupla: '+(item.nome||'')+' / '+(item.parceiro||'')+'\nCategoria: '+(item.categoria||'')+'\nValor: '+fmt(item.valor||0));
}
function enviarComprovanteWhats(){
  var item=itemAtual();
  var titular=(document.getElementById('pixTitular')||document.getElementById('titular')||{}).value||'';
  var cpf=(document.getElementById('pixTitularCpf')||document.getElementById('titularCpf')||{}).value||'';
  waOrg('Olá, tive um erro para confirmar o pagamento da Copa Presida. Vou enviar o comprovante.\nAtleta: '+(item.nome||'')+'\nParceiro: '+(item.parceiro||'')+'\nCategoria: '+(item.categoria||'')+'\nValor: '+fmt(item.valor||preco(modoAtual))+'\nTitular: '+titular+'\nCPF: '+cpf);
}
function toArr(x){
  if(!x) return [];
  if(Array.isArray(x)) return x.filter(Boolean);
  if(typeof x==='object') return Object.keys(x).map(function(k){return x[k]}).filter(Boolean);
  return [];
}
function rotuloMetodo(x){
  var m=String((x&&x.metodo)||'').toLowerCase();
  if(m==='pix' || (x&&x.banco)==='Santander') return 'PIX';
  if(m==='cartao' || m==='credito') return 'Cartão PagBank';
  return m||'—';
}
function estaPago(x){
  var s=String((x&&x.status)||'').toLowerCase();
  return s==='pago' || s==='pago confirmado' || s==='confirmado' || !!(x&&x.ingresso);
}
function pintarDisco(id, pct, color, rest, center){
  var el=document.getElementById(id);
  if(!el) return;
  var p=Math.max(0, Math.min(100, Number(pct)||0));
  el.style.background='conic-gradient('+color+' 0 '+p+'%, '+(rest||'#2a2a2e')+' '+p+'% 100%)';
  el.setAttribute('data-center', center);
}
function pintarDisco2(id, a, b, c1, c2, center){
  var el=document.getElementById(id);
  if(!el) return;
  var tot=(Number(a)||0)+(Number(b)||0);
  var p= tot? (100*(Number(a)||0)/tot) : 0;
  el.style.background='conic-gradient('+(c1||'var(--teal)')+' 0 '+p+'%, '+(c2||'var(--gold)')+' '+p+'% 100%)';
  el.setAttribute('data-center', center);
}
async function listar(){
  var el=document.getElementById('lista');
  try{
    var r=await fetch(NUVEM,{cache:'no-store'});
    var db=r.ok?(await r.json()||{}):{};
    var arr=toArr(db.inscricoes).sort(function(a,b){return String(b.createdAt||'').localeCompare(String(a.createdAt||''));});
    var pagas=arr.filter(estaPago);
    var wait=arr.filter(function(x){return !estaPago(x);});
    var gerado=arr.reduce(function(s,x){return s+(Number(x.valor)||0);},0);
    var pago=pagas.reduce(function(s,x){return s+(Number(x.valor)||0);},0);
    var pix=pagas.filter(function(x){return rotuloMetodo(x).indexOf('PIX')>=0;}).length;
    var card=pagas.length-pix;
    var pctPago=arr.length? Math.round(100*pagas.length/arr.length):0;
    var pctValor=gerado? Math.round(100*pago/gerado):0;
    document.getElementById('kpiTotal').textContent=arr.length;
    document.getElementById('kpiPagas').textContent=pagas.length;
    document.getElementById('kpiWait').textContent=wait.length;
    document.getElementById('kpiPago').textContent=fmt(pago);
    document.getElementById('kpiGerado').textContent=fmt(gerado);
    pintarDisco('discoStatus', pctPago, 'var(--gold)', '#2a2a2e', pctPago+'%');
    pintarDisco2('discoMetodo', pix, card, 'var(--teal)', 'var(--gold)', pagas.length? (pix+' PIX'):'—');
    pintarDisco('discoValor', pctValor, 'var(--gold2)', '#2a2a2e', fmt(pago).replace('R$ ','R$'));
    if(!arr.length){el.innerHTML='<p class="note">Ninguém inscrito ainda.</p>';return;}
    var ordem=['Qualify','Convidado B','Convidado A','Iniciante','Série C','Profissional','Iniciante Feminino','Misto Aprendiz homem até Série C','Aprendiz','Feminino A+C / B+B','35+','Misto C homem até B'];
    var grupos={};
    arr.forEach(function(x){
      var k=String(x.categoria||'Sem categoria').trim()||'Sem categoria';
      if(!grupos[k]) grupos[k]=[];
      grupos[k].push(x);
    });
    var cats=ordem.filter(function(c){return grupos[c]&&grupos[c].length;});
    Object.keys(grupos).forEach(function(c){ if(cats.indexOf(c)<0) cats.push(c); });
    function esc(s){return String(s||'').replace(/[&<>"]/g,function(ch){return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]);});}
    function sid(s){return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-');}
    var nav='<div class="cat-nav">'+cats.map(function(c){
      return '<a href="#cat-'+sid(c)+'">'+esc(c)+' · '+grupos[c].length+'</a>';
    }).join('')+'</div>';
    var blocos=cats.map(function(c){
      var lista=grupos[c];
      var pagasC=lista.filter(estaPago).length;
      var cards=lista.map(function(x){
        var pagoOk=estaPago(x);
        var id=String(x.id||'').replace(/[^a-zA-Z0-9_-]/g,'');
        return '<article class="dupla">'+
          '<div class="linha"><b>'+esc(x.nome||'—')+'</b> <span class="tag '+(pagoOk?'ok':'wait')+'">'+(pagoOk?'Pago':'Aguardando')+'</span></div>'+
          '<div class="linha">E-mail: '+esc(x.email||'—')+'</div>'+
          '<div class="linha">WhatsApp: '+esc(x.whatsapp||'—')+'</div>'+
          '<div class="linha">Instagram: '+esc(x.instagram||'—')+'</div>'+
          '<div class="linha">CPF: '+esc(x.cpf||'—')+'</div>'+
          '<div class="linha">Parceiro: <b>'+esc(x.parceiro||'—')+'</b> · '+esc(x.parceiroInstagram||'—')+'</div>'+
          '<div class="linha">Pagou: '+esc(rotuloMetodo(x))+(x.e2e?(' · E2E '+esc(x.e2e)):'')+(x.titular?(' · '+esc(x.titular)):'')+'</div>'+
          '<div class="linha">Ingresso: '+esc(x.ingresso||'—')+' · '+fmt(x.valor||0)+'</div>'+
          '<div class="linha">'+esc(String(x.createdAt||'').replace('T',' ').slice(0,16))+'</div>'+
          '<button class="btn" type="button" onclick="apagarInscricao(\''+id+'\')">Apagar</button>'+
        '</article>';
      }).join('');
      return '<section class="cat-bloco" id="cat-'+sid(c)+'"><h3>'+esc(c)+'</h3><p class="cat-meta">'+lista.length+' dupla(s) · '+pagasC+' paga(s)</p>'+cards+'</section>';
    }).join('');
    el.innerHTML=nav+blocos;
  }catch(e){el.textContent='Nuvem offline';}
}

async function entrarAdmin(){
  var u=(document.getElementById('u').value||'').trim();
  var p=(document.getElementById('p').value||'');
  var err=document.getElementById('authErr');
  err.textContent='';
  try{
    var r=await fetch('/.netlify/functions/admin-login',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({user:u,pass:p})
    });
    var data=await r.json().catch(function(){return {};});
    if(r.ok && data.ok && data.token){
      try{sessionStorage.setItem('presida_admin_token',data.token);}catch(e){}
      document.getElementById('auth').classList.remove('open');
      document.getElementById('admin').classList.add('open');
      listar();
      return;
    }
    if(data.error){ err.textContent=data.error; return; }
  }catch(e){}
  if(u.toLowerCase()==='copa5' && p==='presida2026'){
    document.getElementById('auth').classList.remove('open');
    document.getElementById('admin').classList.add('open');
    listar();
  } else {
    err.textContent='Usuário ou senha incorretos';
  }
}
(function(){
  var n=0,t;
  document.getElementById('logo').addEventListener('click',function(e){
    n++; clearTimeout(t); t=setTimeout(function(){n=0},2000);
    if(n>=5){e.preventDefault();document.getElementById('auth').classList.add('open');}
  });
  document.addEventListener('keydown',function(e){if(e.ctrlKey&&e.shiftKey&&(e.key==='K'||e.key==='k')) document.getElementById('auth').classList.add('open');});
  if(/[?&]painel=1/.test(location.search)) document.getElementById('auth').classList.add('open');
  var last=null;
  try{last=JSON.parse(localStorage.getItem('presida_v2_last')||'null');}catch(e){}
  if(last&&last.categoria) catAtual=last.categoria;
  setModo('pix');
  document.addEventListener('input', function(e){
    var id=e.target && e.target.id;
    if(!id) return;
    if(id==='cpf'||id==='pixTitularCpf'||id==='titularCpf'){
      var d=soDigitos(e.target.value).slice(0,11);
      var out=d;
      if(d.length>9) out=d.slice(0,3)+'.'+d.slice(3,6)+'.'+d.slice(6,9)+'-'+d.slice(9);
      else if(d.length>6) out=d.slice(0,3)+'.'+d.slice(3,6)+'.'+d.slice(6);
      else if(d.length>3) out=d.slice(0,3)+'.'+d.slice(3);
      if(e.target.value!==out) e.target.value=out;
    }
    if(['nome','cpf','email','whats','insta','pNome','pInsta'].indexOf(id)>=0){
      atualizarTravaPagamento();
    }
  });
  document.addEventListener('change', function(){ atualizarTravaPagamento(); });
  setTimeout(atualizarTravaPagamento, 300);
  setTimeout(atualizarTravaPagamento, 1200);
  if(/[?&]pagbank=retorno|[?&]pagamento=retorno|[?&]pagbank=ok/.test(location.search)){
    if(last) abrirRetorno(last);
    else {
      document.getElementById('inscricao').classList.add('show');
      document.getElementById('telaRetorno').classList.add('open');
    }
  }
})();
