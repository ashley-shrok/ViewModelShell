import{V as r,B as a}from"./browser-ChueOy62.js";const t=document.getElementById("app"),s=new a(t),l=new r({endpoint:"/api/requester",actionEndpoint:"/api/requester/action",adapter:s,onLoading(e){document.body.classList.toggle("is-loading",e)},onError(e){console.error("Shell error:",e);const n=e.message.replace(/[&<>"']/g,o=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[o]??o);t.insertAdjacentHTML("afterbegin",`<div class="vms-error" role="alert">
        ${n}
        <button onclick="this.parentElement.remove()">&#x2715;</button>
      </div>`)}});l.load();
