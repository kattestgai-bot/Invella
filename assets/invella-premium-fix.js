/* editor-layout-hotfix-v15 */
(function(){'use strict';
function restore(){var n=document.getElementById('invEditorNav');if(n)n.remove();document.querySelectorAll('#app .controls > *').forEach(function(x){if(x.id!=='invEditorNav'){x.style.display='';x.removeAttribute('data-inv-section')}})}
function route(){restore();var q=new URLSearchParams(location.search),id=q.get('id');if(q.get('view')==='edit'&&id)sessionStorage.setItem('invella_edit_id',id)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',route);else route();setInterval(restore,250);
})();