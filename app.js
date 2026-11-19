(() => {
      'use strict';
      const STORAGE_KEY = 'digitalni-servisni-knizka:data:v1';
      const presets = [
        ['Výměna motorového oleje',15000],['Výměna olejového filtru',15000],
        ['Výměna vzduchového filtru',30000],['Výměna kabinového filtru',15000],
        ['Výměna palivového filtru',60000],['Výměna brzdové kapaliny',null],
        ['Výměna rozvodů',90000],['Výměna pneumatik',null],['Technická kontrola',null],['Jiný servis',null]
      ];
      const fmt = new Intl.NumberFormat('cs-CZ');
      const money = new Intl.NumberFormat('cs-CZ',{style:'currency',currency:'CZK',maximumFractionDigits:0});
      const dateNow = new Date();
      const today = `${dateNow.getFullYear()}-${String(dateNow.getMonth()+1).padStart(2,'0')}-${String(dateNow.getDate()).padStart(2,'0')}`;
      const $ = (selector) => document.querySelector(selector);
      let vehicles = [];
      let records = [];
      let activeId = null;
      let searchTerm = '';
      let notice = '';
      let noticeType = 'success';
      let storageError = '';

      function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
      }
      function load() {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (!raw) return;
          const saved = JSON.parse(raw);
          if (!saved || !Array.isArray(saved.vehicles) || !Array.isArray(saved.records)) throw new Error('invalid');
          vehicles = saved.vehicles;
          const ids = new Set(vehicles.map((vehicle) => vehicle.id));
          records = saved.records.filter((record) => ids.has(record.vehicle_id));
        } catch {
          storageError = 'Uložená data se nepodařilo načíst. Prohlížeč může mít úložiště vypnuté nebo poškozené.';
        }
        activeId = vehicles[0]?.id ?? null;
      }
      function persist(nextVehicles, nextRecords) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({vehicles:nextVehicles,records:nextRecords}));
          vehicles = nextVehicles;
          records = nextRecords;
          storageError = '';
          notice = 'Změny jsou uložené v tomto prohlížeči.';
          noticeType = 'success';
          return true;
        } catch {
          notice = 'Uložení se nezdařilo. Zkontrolujte volné místo a oprávnění pro ukládání dat webu.';
          noticeType = 'error';
          render();
          return false;
        }
      }
      function currentVehicle() { return vehicles.find((vehicle) => vehicle.id === activeId) ?? null; }
      function newId() { return globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
      function vehicleRecords() { return records.filter((record) => record.vehicle_id === activeId).sort((a,b) => b.service_date.localeCompare(a.service_date)); }
      function latestRecordIds(list) {
        const latest = new Map();
        for (const record of [...list].sort((a,b) => b.service_date.localeCompare(a.service_date) || b.created_at.localeCompare(a.created_at))) {
          if (!latest.has(record.service_type)) latest.set(record.service_type,record.id);
        }
        return latest;
      }
      function render() {
        const nav = $('#vehicle-nav');
        nav.innerHTML = vehicles.map((vehicle) => `<button class="vehicle-choice ${vehicle.id===activeId?'selected':''}" data-action="select-vehicle" data-id="${escapeHtml(vehicle.id)}"><span class="vehicle-icon" aria-hidden="true">🚘</span><span class="vehicle-label"><strong>${escapeHtml(vehicle.make)} ${escapeHtml(vehicle.model)}</strong><small>${escapeHtml(vehicle.plate)}</small></span>${vehicle.id===activeId?'<span class="active-mark"></span>':''}</button>`).join('');
        const vehicle = currentVehicle();
        $('#breadcrumb').textContent = vehicle ? `${vehicle.make} ${vehicle.model}` : 'Přehled';
        const content = $('#content');
        let output = '';
        if (storageError || notice) {
          const text = storageError || notice;
          const type = storageError ? 'error' : noticeType;
          output += `<div class="notice ${type}" role="${type==='error'?'alert':'status'}"><span>${escapeHtml(text)}</span><button data-action="dismiss-notice" aria-label="Zavřít oznámení">✕</button></div>`;
        }
        if (!vehicle) {
          output += `<section class="welcome"><div class="empty-symbol" aria-hidden="true">🚘</div><div class="eyebrow"><span class="dot"></span> ZAČNĚME</div><h1>Vaše garáž čeká.</h1><p>Přidejte první vozidlo a vytvořte si přehlednou servisní historii. Vše se uloží přímo v tomto prohlížeči.</p><button class="btn primary" data-action="add-vehicle">＋ Přidat první vozidlo</button></section>`;
          content.innerHTML = output;
          return;
        }
        const list = vehicleRecords();
        const latest = latestRecordIds(list);
        const dueItems = list.filter((record) => latest.get(record.service_type)===record.id && record.interval_km!==null)
          .map((record) => ({record,target:record.odometer_km+record.interval_km})).sort((a,b) => a.target-b.target);
        const overdue = dueItems.filter((item) => item.target<vehicle.odometer_km).length;
        const next = dueItems.find((item) => item.target>=vehicle.odometer_km);
        const remainingKm = next ? next.target - vehicle.odometer_km : null;
        const dueState = overdue || (remainingKm !== null && remainingKm <= 2000)
          ? 'urgent'
          : next && remainingKm <= next.record.interval_km / 2
            ? 'soon'
            : 'normal';
        const spent = list.reduce((sum,record) => sum+(record.cost??0),0);
        const shown = list.filter((record) => `${record.service_type} ${record.note}`.toLocaleLowerCase('cs').includes(searchTerm.toLocaleLowerCase('cs')));
        output += `<section class="heading"><div><div class="eyebrow"><span class="dot"></span> PŘEHLED VOZIDLA</div><h1>${escapeHtml(vehicle.make)} ${escapeHtml(vehicle.model)} <span class="year">${vehicle.year}</span></h1><p>${escapeHtml(vehicle.engine)} <i></i> ${escapeHtml(vehicle.plate)} <i></i> VIN ${escapeHtml(vehicle.vin)}</p></div><div class="actions"><button class="btn secondary" data-action="edit-vehicle">✎ Upravit vozidlo</button><button class="btn danger" data-action="delete-vehicle" aria-label="Smazat vozidlo">⌫</button></div></section>`;
        output += `<section class="stats"><article class="stat"><div class="stat-top"><span>Aktuální nájezd</span><span class="stat-icon">◉</span></div><strong>${fmt.format(vehicle.odometer_km)} km</strong><button class="quick-odometer" data-action="update-odometer">＋ Rychle aktualizovat km</button></article><article class="stat"><div class="stat-top"><span>Servisní záznamy</span><span class="stat-icon blue">⚒</span></div><strong>${list.length} <small>záznamů</small></strong><small>Celkem v servisní historii</small></article><article class="stat"><div class="stat-top"><span>Celkem za servis</span><span class="stat-icon amber">Kč</span></div><strong>${money.format(spent)}</strong><small>Součet evidovaných nákladů</small></article><article class="stat due-card due-${dueState}"><div class="stat-top"><span>${overdue?'Servis po termínu':'Další servis'}</span><span class="stat-icon lilac">◷</span></div><strong>${overdue?`${overdue} ${overdue===1?'úkon':'úkony'}`:next?`${fmt.format(next.target)} km`:'—'}</strong><small>${overdue?'Dle zadaných intervalů':next?`${escapeHtml(next.record.service_type)} · zbývá ${fmt.format(remainingKm)} km`:'Bez nastaveného intervalu'}</small></article></section>`;
        output += `<section class="history"><div class="section-title"><div><div class="eyebrow"><span class="dot"></span> VŠE NA JEDNOM MÍSTĚ</div><h2>Servisní historie</h2></div><button class="btn primary" data-action="add-service">＋ Přidat záznam</button></div>`;
        if (list.length) output += `<label class="search-wrap"><span aria-hidden="true">⌕</span><input id="search" type="search" placeholder="Hledat v záznamech…" value="${escapeHtml(searchTerm)}" aria-label="Hledat v záznamech"></label>`;
        if (!shown.length) {
          output += `<div class="empty"><div class="empty-symbol" aria-hidden="true">⚒</div><h3>${searchTerm?'Nic jsme nenašli':'Zatím tu nic není'}</h3><p>${searchTerm?'Zkuste změnit hledaný výraz.':'Zaznamenejte první servis a mějte historii svého auta vždy přehledně po ruce.'}</p>${searchTerm?'':'<button class="btn secondary" data-action="add-service">＋ Přidat první záznam</button>'}</div>`;
        } else {
          output += `<div class="table-wrap"><table class="table"><thead><tr><th>SERVISNÍ ÚKON</th><th>DATUM</th><th>NÁJEZD</th><th>CENA</th><th>DALŠÍ SERVIS</th><th></th></tr></thead><tbody>`;
          for (const record of shown) {
            const target = record.interval_km===null ? null : record.odometer_km+record.interval_km;
            const remainingForRecord = target===null ? null : target-vehicle.odometer_km;
            const dueStateForRecord = remainingForRecord!==null && remainingForRecord<=2000
              ? 'due-urgent'
              : remainingForRecord!==null && remainingForRecord<=record.interval_km/2
                ? 'due-soon'
                : '';
            const dueLabel = target===null ? '<span class="muted">Bez intervalu</span>' : latest.get(record.service_type)!==record.id ? '<span class="muted">Novější servis</span>' : `<span class="badge ${dueStateForRecord}"><span class="dot"></span>${remainingForRecord<0?'Po termínu':`${fmt.format(target)} km`}</span>`;
            output += `<tr><td><span class="record-name"><span class="record-icon" aria-hidden="true">⚒</span><span class="record-title"><strong>${escapeHtml(record.service_type)}</strong>${record.note?`<small>${escapeHtml(record.note)}</small>`:''}</span></span></td><td>${new Date(`${record.service_date}T12:00:00`).toLocaleDateString('cs-CZ')}</td><td>${fmt.format(record.odometer_km)} km</td><td>${record.cost===null?'—':money.format(record.cost)}</td><td>${dueLabel}</td><td><span class="row-actions"><button class="icon-btn" data-action="edit-service" data-id="${escapeHtml(record.id)}" aria-label="Upravit záznam">✎</button><button class="icon-btn" data-action="delete-service" data-id="${escapeHtml(record.id)}" aria-label="Smazat záznam">⌫</button></span></td></tr>`;
          }
          output += '</tbody></table></div>';
        }
        output += '</section><p class="disclaimer"><span aria-hidden="true">ⓘ</span> Přednastavené intervaly jsou pouze orientační. Vždy ověřte doporučení výrobce vašeho vozidla.</p>';
        content.innerHTML = output;
      }
      function showDialog(title, subtitle, html) {
        $('#dialog-title').textContent = title;
        $('#dialog-subtitle').textContent = subtitle;
        $('#dialog-body').innerHTML = html;
        $('#dialog').showModal();
      }
      function closeDialog() { $('#dialog').close(); }
      function vehicleForm(vehicle=null) {
        showDialog(vehicle?'Upravit vozidlo':'Přidat vozidlo','Základní údaje o vašem autě.',`
          <form id="vehicle-form" class="form-grid" novalidate>
            <div class="form-error" id="form-error" hidden></div>
            <label class="field">Značka<input name="make" maxlength="60" required value="${escapeHtml(vehicle?.make??'')}" placeholder="např. Škoda"></label>
            <label class="field">Model<input name="model" maxlength="80" required value="${escapeHtml(vehicle?.model??'')}" placeholder="např. Octavia"></label>
            <label class="field">Rok výroby<input name="year" type="number" min="1886" max="${dateNow.getFullYear()+1}" step="1" required value="${vehicle?.year??dateNow.getFullYear()}"></label>
            <label class="field">Motor<input name="engine" maxlength="80" required value="${escapeHtml(vehicle?.engine??'')}" placeholder="např. 2.0 TDI"></label>
            <label class="field">Aktuální nájezd (km)<input name="odometer_km" type="number" min="0" max="2000000000" step="1" required value="${vehicle?.odometer_km??0}"></label>
            <label class="field">SPZ<input name="plate" maxlength="12" required value="${escapeHtml(vehicle?.plate??'')}" placeholder="1A2 3456"></label>
            <label class="field full">VIN (17 znaků)<input name="vin" minlength="17" maxlength="17" pattern="[A-HJ-NPR-Za-hj-npr-z0-9]{17}" title="VIN má 17 znaků a neobsahuje I, O ani Q." required value="${escapeHtml(vehicle?.vin??'')}" placeholder="TMBXXXXXXXXXXXXXX"></label>
            <div class="modal-actions"><button type="button" class="btn secondary" data-action="close-dialog">Zrušit</button><button class="btn primary">${vehicle?'Uložit změny':'Přidat vozidlo'}</button></div>
          </form>`);
        $('#vehicle-form').addEventListener('submit',(event)=>{
          event.preventDefault();
          const form = event.currentTarget;
          const values = Object.fromEntries(new FormData(form).entries());
          const year=Number(values.year), odometer=Number(values.odometer_km), vin=String(values.vin).trim().toUpperCase();
          let problem='';
          if (!String(values.make).trim()||!String(values.model).trim()||!String(values.engine).trim()||!String(values.plate).trim()||!vin) problem='Vyplňte prosím všechna povinná pole.';
          else if (!Number.isInteger(year)||year<1886||year>dateNow.getFullYear()+1) problem='Zadejte platný rok výroby.';
          else if (!Number.isSafeInteger(odometer)||odometer<0||odometer>2000000000) problem='Nájezd musí být celé číslo od 0 do 2 000 000 000 km.';
          else if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) problem='VIN musí mít 17 znaků a nesmí obsahovat I, O ani Q.';
          if (problem) { showFormError(problem); return; }
          const saved={id:vehicle?.id??newId(),created_at:vehicle?.created_at??new Date().toISOString(),make:String(values.make).trim(),model:String(values.model).trim(),year,engine:String(values.engine).trim(),odometer_km:odometer,plate:String(values.plate).trim().toUpperCase(),vin};
          const next=vehicle?vehicles.map((item)=>item.id===vehicle.id?saved:item):[...vehicles,saved];
          if(persist(next,records)){activeId=saved.id;closeDialog();render();}
        });
      }
      function odometerForm() {
        const vehicle=currentVehicle();
        if(!vehicle)return;
        showDialog('Aktualizovat nájezd',`${vehicle.make} ${vehicle.model} · aktuálně ${fmt.format(vehicle.odometer_km)} km`,`
          <form id="odometer-form" class="form-grid" novalidate>
            <div class="form-error" id="form-error" hidden></div>
            <label class="field full">Nový aktuální nájezd (km)<input name="odometer_km" type="number" min="0" max="2000000000" step="1" inputmode="numeric" required value="${vehicle.odometer_km}"></label>
            <div class="modal-actions"><button type="button" class="btn secondary" data-action="close-dialog">Zrušit</button><button class="btn primary">Uložit nájezd</button></div>
          </form>`);
        $('#odometer-form').addEventListener('submit',(event)=>{
          event.preventDefault();
          const form=event.currentTarget;
          const odometer=Number(new FormData(form).get('odometer_km'));
          if(!Number.isSafeInteger(odometer)||odometer<0||odometer>2000000000){showFormError('Nájezd musí být celé číslo od 0 do 2 000 000 000 km.');return;}
          if(odometer<vehicle.odometer_km&&!confirm(`Nový nájezd ${fmt.format(odometer)} km je nižší než aktuální ${fmt.format(vehicle.odometer_km)} km. Opravdu chcete změnu uložit?`))return;
          const updated={...vehicle,odometer_km:odometer};
          const nextVehicles=vehicles.map((item)=>item.id===vehicle.id?updated:item);
          if(persist(nextVehicles,records)){closeDialog();render();}
        });
      }
      function serviceForm(record=null) {
        const vehicle=currentVehicle();
        if(!vehicle)return;
        const presetNames=presets.map(([name])=>name);
        const isCustom=record&&!presetNames.includes(record.service_type);
        const initialType=isCustom?'Jiný servis':record?.service_type??'';
        showDialog(record?'Upravit servisní záznam':'Přidat servisní záznam','Záznam bude uložen pouze k právě vybranému vozidlu.',`
          <form id="service-form" class="form-grid" novalidate>
            <div class="form-error" id="form-error" hidden></div>
            <label class="field full">Typ servisu<select name="service_type" id="service-type" required><option value="" disabled ${initialType?'':'selected'}>Vyberte úkon…</option>${presets.map(([name,km])=>`<option value="${escapeHtml(name)}" ${initialType===name?'selected':''}>${escapeHtml(name)}${km?` · orientačně ${fmt.format(km)} km`:''}</option>`).join('')}</select></label>
            <label class="field full" id="custom-field" ${initialType==='Jiný servis'?'':'hidden'}>Vlastní název<input name="custom_type" id="custom-type" maxlength="120" value="${escapeHtml(isCustom?record.service_type:'')}" placeholder="např. Výměna spojky" ${initialType==='Jiný servis'?'required':''}></label>
            <label class="field">Datum servisu<input name="service_date" type="date" max="${today}" required value="${record?.service_date??today}"></label>
            <label class="field">Nájezd při servisu (km)<input name="odometer_km" type="number" min="0" max="2000000000" step="1" required value="${record?.odometer_km??vehicle.odometer_km}"></label>
            <label class="field">Cena (Kč)<input name="cost" type="number" min="0" max="100000000" step="0.01" value="${record?.cost??''}" placeholder="Nepovinné"></label>
            <label class="field full">Poznámka<textarea name="note" maxlength="2000" rows="3" placeholder="Co bylo provedeno? Použité díly, doporučení servisu…">${escapeHtml(record?.note??'')}</textarea></label>
            <div class="interval-box"><label class="checkline"><input type="checkbox" name="use_interval" id="use-interval" ${record?.interval_km!==null&&record?.interval_km!==undefined?'checked':''}><span><strong>Sledovat další interval výměny</strong><small>Vypočítáme cílový nájezd dalšího servisu.</small></span></label>
              <div id="interval-fields" class="interval-fields" ${record?.interval_km!==null&&record?.interval_km!==undefined?'':'hidden'}>
                <label>Interval (km)<input name="interval_km" id="interval-km" type="number" min="1" max="2000000000" step="1" value="${record?.interval_km??15000}"></label>
                <small class="hint" id="interval-hint">Intervaly jsou orientační. Ověřte doporučení výrobce.</small>
                <div class="target" id="target-preview">Další servis při <strong>— km</strong></div>
              </div>
            </div>
            <div class="modal-actions"><button type="button" class="btn secondary" data-action="close-dialog">Zrušit</button><button class="btn primary">${record?'Uložit změny':'Uložit záznam'}</button></div>
          </form>`);
        const form=$('#service-form'), typeSelect=$('#service-type'), check=$('#use-interval'), intervalInput=$('#interval-km'), odometerInput=form.elements.odometer_km;
        function refreshTarget(){const n=Number(odometerInput.value)+Number(intervalInput.value);$('#target-preview').innerHTML=`Další servis při <strong>${Number.isSafeInteger(n)?`${fmt.format(n)} km`:'—'}</strong>`;}
        function refreshType(){const custom=typeSelect.value==='Jiný servis';$('#custom-field').hidden=!custom;$('#custom-type').required=custom;const found=presets.find(([name])=>name===typeSelect.value);if(found?.[1]){intervalInput.value=String(found[1]);check.checked=true;}else if(found){check.checked=false;}$('#interval-fields').hidden=!check.checked;$('#interval-hint').textContent=found?.[1]?`Orientační návrh pro ${found[0].toLocaleLowerCase('cs')}. Ověřte dle výrobce.`:'Intervaly závisejí na vozidle. Můžete zadat vlastní hodnotu.';refreshTarget();}
        typeSelect.addEventListener('change',refreshType);
        check.addEventListener('change',()=>{$('#interval-fields').hidden=!check.checked;refreshTarget();});
        intervalInput.addEventListener('input',refreshTarget);odometerInput.addEventListener('input',refreshTarget);refreshType();
        form.addEventListener('submit',(event)=>{
          event.preventDefault();const values=Object.fromEntries(new FormData(form).entries());const km=Number(values.odometer_km), cost=values.cost===''?null:Number(values.cost), interval=Number(values.interval_km), finalType=values.service_type==='Jiný servis'?String(values.custom_type).trim():String(values.service_type);
          let problem='';
          if(!finalType)problem='Zadejte název servisního úkonu.';
          else if(!Number.isSafeInteger(km)||km<0||km>2000000000)problem='Nájezd musí být celé číslo od 0 do 2 000 000 000 km.';
          else if(cost!==null&&(!Number.isFinite(cost)||cost<0||cost>100000000))problem='Cena musí být nezáporné číslo.';
          else if(values.use_interval!==undefined&&(!Number.isSafeInteger(interval)||interval<1||interval>2000000000))problem='Interval musí být celé číslo od 1 do 2 000 000 000 km.';
          else if(!values.service_date||values.service_date>today)problem='Zadejte platné datum, které není v budoucnosti.';
          if(problem){showFormError(problem);return;}
          const saved={id:record?.id??newId(),vehicle_id:vehicle.id,created_at:record?.created_at??new Date().toISOString(),service_type:finalType,service_date:String(values.service_date),odometer_km:km,cost,note:String(values.note??'').trim(),interval_km:values.use_interval!==undefined?interval:null};
          const next=(record?records.map((item)=>item.id===record.id?saved:item):[saved,...records]).sort((a,b)=>b.service_date.localeCompare(a.service_date));
          if(persist(vehicles,next)){closeDialog();render();}
        });
      }
      function showFormError(message){const area=$('#form-error');area.textContent=message;area.hidden=false;}
      function act(action,id) {
        if(action==='add-vehicle')vehicleForm();
        if(action==='select-vehicle'){activeId=id;searchTerm='';$('#sidebar').classList.remove('open');$('#scrim').hidden=true;render();}
        if(action==='edit-vehicle')vehicleForm(currentVehicle());
        if(action==='update-odometer')odometerForm();
        if(action==='delete-vehicle'){
          const vehicle=currentVehicle();if(!vehicle||!confirm(`Opravdu chcete smazat vozidlo ${vehicle.make} ${vehicle.model} a všechny jeho servisní záznamy?`))return;
          const nextVehicles=vehicles.filter((item)=>item.id!==vehicle.id),nextRecords=records.filter((item)=>item.vehicle_id!==vehicle.id);
          if(persist(nextVehicles,nextRecords)){activeId=nextVehicles[0]?.id??null;render();}
        }
        if(action==='add-service')serviceForm();
        if(action==='edit-service'){const record=records.find((item)=>item.id===id);if(record?.vehicle_id===activeId)serviceForm(record);}
        if(action==='delete-service'){
          const record=records.find((item)=>item.id===id);if(!record||record.vehicle_id!==activeId||!confirm(`Opravdu chcete smazat záznam „${record.service_type}“?`))return;
          const next=records.filter((item)=>item.id!==record.id);if(persist(vehicles,next))render();
        }
        if(action==='close-dialog')closeDialog();
        if(action==='dismiss-notice'){notice='';storageError='';render();}
      }
      document.addEventListener('click',(event)=>{const button=event.target.closest('[data-action]');if(button)act(button.dataset.action,button.dataset.id);});
      $('#add-vehicle').addEventListener('click',()=>vehicleForm());
      $('#close-dialog').addEventListener('click',closeDialog);
      $('#dialog').addEventListener('click',(event)=>{if(event.target===$('#dialog'))closeDialog();});
      $('#menu-button').addEventListener('click',()=>{$('#sidebar').classList.add('open');$('#scrim').hidden=false;});
      $('#scrim').addEventListener('click',()=>{$('#sidebar').classList.remove('open');$('#scrim').hidden=true;});
      $('#content').addEventListener('input',(event)=>{if(event.target.id==='search'){const start=event.target.selectionStart;searchTerm=event.target.value;const field=event.target;render();const next=$('#search');next.focus();next.setSelectionRange(start,start);}});
      load();
      render();
    })();