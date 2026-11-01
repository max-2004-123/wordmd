'use strict';
const $=id=>document.getElementById(id), editor=$('editor');
const td=new TurndownService({headingStyle:'atx',codeBlockStyle:'fenced'});td.use(turndownPluginGfm.gfm);
marked.setOptions({gfm:true,breaks:true});
let dirty=false,range=null,saveTimer,outlineTimer;
const draftKey='wordmd-local-draft-v1';
function clean(html){return DOMPurify.sanitize(html,{FORBID_TAGS:['style','script','iframe','object','embed','form','input','button','textarea','select','link','meta'],FORBID_ATTR:['contenteditable','id']});}
function message(text){$('state').textContent=text;}
function remember(){const s=getSelection();if(s.rangeCount&&editor.contains(s.anchorNode)&&editor.contains(s.focusNode))range=s.getRangeAt(0).cloneRange();}
document.addEventListener('selectionchange',remember);
function restore(){editor.focus();if(range&&editor.contains(range.commonAncestorContainer)){const s=getSelection();s.removeAllRanges();s.addRange(range);}}
function command(cmd,value=null){restore();document.execCommand(cmd,false,value);remember();changed();}
document.querySelectorAll('[data-cmd]').forEach(b=>{b.onmousedown=e=>e.preventDefault();b.onclick=()=>command(b.dataset.cmd,b.dataset.value||null);});
for(const [id,cmd] of [['block','formatBlock'],['font','fontName'],['size','fontSize'],['color','foreColor']])$(id).onchange=e=>command(cmd,e.target.value);

const ribbon=$('ribbon'), ribbonTools=$('ribbonTools');
$('pinRibbon').onclick=()=>{const pinned=ribbon.classList.toggle('unpinned')===false;$('pinRibbon').setAttribute('aria-pressed',String(pinned));$('pinRibbon').textContent=pinned?'📌 固定':'📌 未固定';};
$('toggleRibbon').onclick=()=>{ribbonTools.hidden=!ribbonTools.hidden;$('toggleRibbon').setAttribute('aria-expanded',String(!ribbonTools.hidden));$('toggleRibbon').textContent=ribbonTools.hidden?'展開 ▼':'收合 ▲';};
function syncSize(){const s=getSelection();if(!s.rangeCount||!editor.contains(s.anchorNode)||!editor.contains(s.focusNode))return;const value=document.queryCommandValue('fontSize');if([...$('size').options].some(o=>o.value===value))$('size').value=value;}
document.addEventListener('selectionchange',syncSize);
for(const [id,step] of [['sizeDown',-1],['sizeUp',1]]){const button=$(id);button.onmousedown=e=>e.preventDefault();button.onclick=()=>{const size=$('size');size.selectedIndex=Math.max(0,Math.min(size.options.length-1,size.selectedIndex+step));command('fontSize',size.value);};}

function update(){const txt=editor.innerText||'';$('count').textContent=`${txt.replace(/\s/g,'').length.toLocaleString()} 字元`;clearTimeout(outlineTimer);outlineTimer=setTimeout(()=>{const box=$('outline');box.replaceChildren();editor.querySelectorAll('h1,h2,h3').forEach(h=>{const b=document.createElement('button');b.textContent=h.textContent||'未命名標題';b.style.paddingLeft=`${(Number(h.tagName[1])-1)*12+8}px`;b.onclick=()=>h.scrollIntoView({behavior:'smooth',block:'center'});box.append(b);});},200);}
function cache(){try{localStorage.setItem(draftKey,JSON.stringify({html:editor.innerHTML,name:$('name').value}));$('draft').textContent='草稿已備份於此瀏覽器';}catch{$('draft').textContent='草稿備份失敗，請儲存文件';}}
function changed(){dirty=true;message('有修改 · 請儲存文件');update();clearTimeout(saveTimer);saveTimer=setTimeout(cache,500);}
editor.addEventListener('input',changed);$('name').oninput=changed;
function load(html,name){editor.innerHTML=clean(html)||'<p><br></p>';$('name').value=name;range=null;dirty=false;update();cache();message('文件已開啟');}
function canReplace(){return !dirty||confirm('目前修改尚未儲存成檔案，確定捨棄並開啟其他文件？');}
$('new').onclick=()=>{if(canReplace()){load('<h1>文件標題</h1><p>從這裡開始撰寫你的內容。</p>','未命名文件');changed();}};
$('open').onclick=()=>{if(canReplace())$('file').click();};
async function openFile(file){if(!file)return;if(!/\.(md|markdown|txt|html?|htm)$/i.test(file.name)){alert('請選擇 Markdown、TXT 或 HTML 檔案。');return;}try{const text=await file.text();const html=/\.html?$/i.test(file.name)?text:/\.txt$/i.test(file.name)?'<p>'+escapeHTML(text).replace(/\n/g,'<br>')+'</p>':marked.parse(text);load(html,file.name.replace(/\.[^.]+$/,''));}catch(e){alert('讀取失敗：'+e.message);}}
$('file').onchange=async e=>{await openFile(e.target.files[0]);e.target.value='';};
document.addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('Files'))e.preventDefault();});
document.addEventListener('drop',e=>{if(e.dataTransfer.files.length){e.preventDefault();if(canReplace())openFile(e.dataTransfer.files[0]);}});
function escapeHTML(s){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function baseName(){return ($('name').value||'未命名文件').replace(/[\\/:*?"<>|]/g,'_');}
function htmlDocument(){return '<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><title>'+escapeHTML($('name').value)+'</title><style>body{max-width:794px;margin:40px auto;padding:30px;font-family:"Microsoft JhengHei",sans-serif;font-size:16px;line-height:1.8;color:#24304a}table{border-collapse:collapse;width:100%}td,th{border:1px solid #bdc8da;padding:9px}img{max-width:100%}pre{white-space:pre-wrap;background:#f0f2f6;padding:16px}blockquote{border-left:3px solid #8da5e8;padding:8px 18px}@media print{body{padding:0;margin:0}}</style></head><body>'+clean(editor.innerHTML)+'</body></html>';}
function download(data,name,type){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
async function save(){const data=htmlDocument();const snapshot=editor.innerHTML;const name=$('name').value;try{if(window.showSaveFilePicker){const handle=await showSaveFilePicker({suggestedName:baseName()+'.html',types:[{description:'完整格式 HTML 文件',accept:{'text/html':['.html']}}]});const stream=await handle.createWritable();await stream.write(data);await stream.close();if(editor.innerHTML===snapshot&&$('name').value===name)dirty=false;message(dirty?'已儲存先前版本 · 仍有修改':'已儲存完整格式');}else{download(data,baseName()+'.html','text/html;charset=utf-8');message('已送出下載 · 請確認檔案');}cache();}catch(e){if(e.name!=='AbortError')alert('儲存失敗：'+e.message);}}
$('save').onclick=save;
$('md').onclick=()=>{download(td.turndown(editor.innerHTML),baseName()+'.md','text/markdown;charset=utf-8');message('已匯出 Markdown（不含字型、色彩等排版）');};
$('print').onclick=()=>window.print();
$('sourceToggle').onclick=()=>{$('source').value=td.turndown(editor.innerHTML);$('sourcePanel').hidden=false;};
$('cancelSource').onclick=()=>{$('sourcePanel').hidden=true;};
$('applySource').onclick=()=>{if(!confirm('以 Markdown 重建文件？字型、顏色、對齊等 Markdown 不支援的格式可能消失。'))return;editor.focus();document.execCommand('selectAll');document.execCommand('insertHTML',false,clean(marked.parse($('source').value)));$('sourcePanel').hidden=true;range=null;changed();};
$('link').onclick=()=>{const url=prompt('輸入連結（https://…）');if(!url)return;if(!/^(https?:\/\/|mailto:)/i.test(url)){alert('請使用 https://、http:// 或 mailto: 連結。');return;}restore();if(getSelection().isCollapsed)command('insertHTML','<a href="'+escapeHTML(url)+'">'+escapeHTML(url)+'</a>');else command('createLink',url);};
$('table').onclick=()=>{const size=prompt('輸入列數 × 欄數，例如 3x3（最多 20x10）','3x3');if(!size)return;const m=size.match(/^(\d+)\s*[x×,]\s*(\d+)$/i);if(!m||+m[1]<1||+m[1]>20||+m[2]<1||+m[2]>10){alert('請輸入有效尺寸，例如 3x3，最多 20 列、10 欄。');return;}let html='<table><tbody>';for(let r=0;r<+m[1];r++){html+='<tr>';for(let c=0;c<+m[2];c++)html+=r===0?'<th>欄位 '+(c+1)+'</th>':'<td><br></td>';html+='</tr>';}command('insertHTML',html+'</tbody></table><p><br></p>');};
$('image').onclick=()=>{$('picture').click();};
$('picture').onchange=e=>{const f=e.target.files[0];if(!f)return;if(!/^image\/(png|jpeg|gif|webp)$/.test(f.type)||f.size>10*1024*1024){alert('請選擇 10 MB 以下的 PNG、JPEG、GIF 或 WebP 圖片。');e.target.value='';return;}const reader=new FileReader();reader.onload=()=>command('insertHTML','<img src="'+reader.result+'" alt="'+escapeHTML(f.name)+'"><p><br></p>');reader.readAsDataURL(f);e.target.value='';};
editor.addEventListener('paste',e=>{const html=e.clipboardData.getData('text/html');const text=e.clipboardData.getData('text/plain');if(html||text){e.preventDefault();command('insertHTML',html?clean(html):escapeHTML(text).replace(/\n/g,'<br>'));}});
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();save();}});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
const welcome='<h1>讓想法，成為一份好文件。</h1><p>歡迎使用 <strong>WordMD</strong>。這是一個可以直接編輯的文件空間，不需要先學會 Markdown 語法。</p><h2>從這裡開始</h2><p>點一下文字，就能像 Word 一樣打字、刪除與貼上。選取一段文字，再使用上方工具列調整<strong>粗體</strong>、<em>斜體</em>、字型與顏色。</p><ul><li>開啟已有的 Markdown、文字或 HTML 文件。</li><li>插入表格、圖片與連結，整理你的研究筆記。</li><li>按「儲存文件」保留完整格式，日後可以再次開啟編輯。</li></ul><h2>選擇適合的儲存方式</h2><table><tr><th>格式</th><th>適合用途</th></tr><tr><td>HTML 文件</td><td>保留字型、顏色、表格與圖片，作為編輯原稿。</td></tr><tr><td>Markdown</td><td>交換文字內容，保留標題、粗體、清單等基本格式。</td></tr><tr><td>PDF</td><td>透過列印視窗選擇「另存為 PDF」，分享定稿。</td></tr></table><blockquote>你的內容留在電腦裡。記得儲存檔案，讓重要的想法有一份正式備份。</blockquote>';
try{const draft=JSON.parse(localStorage.getItem(draftKey)||'null');if(draft&&typeof draft.html==='string'){load(draft.html,draft.name||'未命名文件');dirty=true;message('已還原草稿 · 請另存檔案');}else load(welcome,'我的第一份文件');}catch{load(welcome,'我的第一份文件');}
