/**
 * The shared office.js stub for e2e smokes. Served in place of the real CDN
 * script via page.route, it fakes exactly what the app touches: document
 * settings, selection text/OOXML, insert operations (recorded on
 * window.__ops), body.search over a fake document string, and the dialog
 * messaging used by the builder page.
 */

/**
 * @param {object} [opts]
 * @param {string} [opts.selectionText] what getSelectedText returns
 * @param {string} [opts.docBody] fake document text searched for {{markers}}
 * @param {boolean} [opts.darkTheme] Office theme background
 */
export function paneStub(opts = {}) {
  const selection = JSON.stringify(opts.selectionText ?? "Sample selection body text.");
  const doc = JSON.stringify(opts.docBody ?? "");
  const background = opts.darkTheme ? "#252525" : "#ffffff";
  return `window.__settings={};window.__ops=[];window.__seltext=${selection};window.__doc=${doc};
window.Office={onReady:function(cb){var i={host:null};if(cb)cb(i);return Promise.resolve(i);},
  AsyncResultStatus:{Succeeded:"succeeded"},
  EventType:{DialogMessageReceived:"dmr",DialogEventReceived:"der"},
  context:{document:{settings:{get:function(k){return window.__settings[k]||null;},set:function(k,v){window.__settings[k]=v;},saveAsync:function(cb){if(cb)cb({});}}},
    officeTheme:{bodyBackgroundColor:"${background}"},
    ui:{displayDialogAsync:function(url,o,cb){window.__dialogUrl=url;cb({status:"succeeded",value:{addEventHandler:function(){},close:function(){}}});}}}};
function mkRange(){return {
  load:function(){},
  get text(){return window.__seltext;},
  getOoxml:function(){return {value:"<pkg>"+window.__seltext+"</pkg>"};},
  insertText:function(t,loc){window.__ops.push({op:"text",t:t,loc:loc});return mkRange();},
  insertOoxml:function(x,loc){window.__ops.push({op:"ooxml",x:x,loc:loc});return mkRange();},
  insertTable:function(r,c,loc,values){window.__ops.push({op:"table",values:values,loc:loc});return mkRange();},
  select:function(m){window.__ops.push({op:"select",m:m});}
};}
window.Word={InsertLocation:{replace:"Replace",after:"After",before:"Before"},SelectionMode:{end:"End"},
run:function(cb){return Promise.resolve(cb({
  document:{getSelection:mkRange,
    body:{search:function(marker){
      return {load:function(){},
        get items(){
          if((window.__doc||"").indexOf(marker)===-1){return [];}
          var range=mkRange();
          range.insertText=function(t,loc){window.__ops.push({op:"text",marker:marker,t:t,loc:loc});return mkRange();};
          range.insertTable=function(r,c,loc,values){window.__ops.push({op:"table",marker:marker,values:values,loc:loc});return mkRange();};
          return [range];
        }};
    }}},
  sync:function(){return Promise.resolve();}}));}};`;
}

/** Stub for the builder page: only dialog messaging exists there. */
export function builderStub() {
  return `window.__msg=null;
window.Office={onReady:function(cb){if(cb)cb({host:null});return Promise.resolve({host:null});},
  context:{ui:{messageParent:function(m){window.__msg=m;}}}};`;
}
