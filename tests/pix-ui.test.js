import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { validate, formatDocument, formatPhone } from '../public/validation.js';

const source = (await readFile(new URL('../public/app.js', import.meta.url), 'utf8')).replace(/^import[^\n]+\n/, '');
function checkout() {
  const elements = new Map();
  function element(selector) {
    if (!elements.has(selector)) elements.set(selector, {
      value: '', checked: false, disabled: false, hidden: false, open: false, textContent: '',
      listeners: {}, classList: { toggle() {} }, setAttribute() {}, focus() {}, select() {},
      addEventListener(event, listener) { this.listeners[event] = listener; },
      showModal() { this.open = true; },
      close() { this.open = false; this.listeners.close?.(); }
    });
    return elements.get(selector);
  }
  for (const [key, value] of Object.entries({ email:'teste@example.com', name:'Pessoa Teste', phone:'11999999999', document:'52998224725' })) element(`#${key}`).value = value;
  element('#terms').checked = true;
  const timers = new Map();
  let timerId = 0;
  const state = { creates:0, queries:0, copied:'', answer:async()=>({status:'PENDING'}) };
  vm.runInNewContext(source, {
    validate, formatDocument, formatPhone, AbortSignal,
    document: { querySelector:element, querySelectorAll:()=>[] },
    navigator: { clipboard: { writeText:async value=>{ state.copied=value; } } },
    setTimeout: fn=>{ timers.set(++timerId,fn); return timerId; }, clearTimeout:id=>timers.delete(id),
    fetch:async url=>{
      if (url==='/api/pix') {
        state.creates++;
        // Reproduce a provider date behind the browser clock, with a pending payment.
        return {ok:true,json:async()=>({code:'000201-LOCAL-TEST',amount:34700,token:`test-${state.creates}`,expiresAt:'2000-01-01T00:00:00Z'})};
      }
      state.queries++;
      const answer=await state.answer();
      return {ok:true,json:async()=>answer};
    }
  });
  return { element, state,
    submit:()=>element('#checkout-form').listeners.submit({preventDefault(){}}),
    copy:()=>element('#copy-button').listeners.click(),
    poll:()=>{ const [id,fn]=timers.entries().next().value; timers.delete(id); return fn(); }
  };
}
test('copy and status poll keep a pending Pix usable despite an old expiresAt', async()=>{
  const ui=checkout(); await ui.submit(); await ui.copy(); await ui.poll();
  assert.equal(ui.state.queries,1, 'must consult gateway before deciding expiration');
  assert.equal(ui.state.copied,'000201-LOCAL-TEST');
  assert.equal(ui.element('#copy-button').disabled,false);
  assert.equal(ui.element('#payment-status').textContent,'Aguardando pagamento');
});
test('reopening a pending Pix does not create a duplicate based on browser time', async()=>{
  const ui=checkout(); await ui.submit(); ui.element('#pix-dialog').close(); await ui.submit();
  assert.equal(ui.state.creates,1);
  assert.equal(ui.element('#pix-code').value,'000201-LOCAL-TEST');
});
test('gateway cancellation disables the old code and permits a new charge', async()=>{
  const ui=checkout(); await ui.submit(); ui.state.answer=async()=>({status:'CANCELLED'}); await ui.poll();
  assert.equal(ui.element('#copy-button').disabled,true);
  assert.match(ui.element('#payment-status').textContent,/cancelado ou expirado/);
  ui.element('#pix-dialog').close(); await ui.submit(); assert.equal(ui.state.creates,2);
});
test('a failed status query preserves the code and does not invent expiration', async()=>{
  const ui=checkout(); await ui.submit(); ui.state.answer=async()=>{throw new Error('network');};
  await ui.poll(); await ui.poll(); await ui.poll(); await ui.copy();
  assert.equal(ui.element('#copy-button').disabled,false);
  assert.match(ui.element('#payment-status').textContent,/Consulta indisponível/);
  assert.equal(ui.state.creates,1);
});
test('a status response from a closed dialog cannot overwrite a new payment', async()=>{
  const ui=checkout(); await ui.submit();
  let resolveOld; ui.state.answer=()=>new Promise(resolve=>{ resolveOld=resolve; });
  const oldPoll=ui.poll();
  ui.element('#pix-dialog').close(); ui.element('#email').value='outro@example.com'; await ui.submit();
  resolveOld({status:'CANCELLED'}); await oldPoll;
  assert.equal(ui.element('#copy-button').disabled,false);
  assert.equal(ui.element('#payment-status').textContent,'Aguardando pagamento');
});
