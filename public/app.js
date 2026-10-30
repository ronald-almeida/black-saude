import { validate, formatDocument, formatPhone } from './validation.js';
const $ = selector => document.querySelector(selector);
const form = $('#checkout-form');
const pay = $('#pay-button');
const dialog = $('#pix-dialog');
const touched = new Set();
let busy = false;
let transaction = null;
let transactionCustomer = '';
let pollTimer;
let pollSession = 0;
let terminal = false;
let pollFailures = 0;
const data = () => ({ email: $('#email').value.trim(), name: $('#name').value.trim(), phone: $('#phone').value, document: $('#document').value, terms: $('#terms').checked });
function refresh() {
  const errors = validate(data());
  for (const field of ['email', 'name', 'phone', 'document']) {
    const invalid = touched.has(field) && !!errors[field];
    $(`[data-field="${field}"]`).classList.toggle('invalid', invalid);
    $(`#${field}`).setAttribute('aria-invalid', String(invalid));
    $(`#${field}-error`).textContent = invalid ? errors[field] : '';
  }
  pay.disabled = busy || Object.keys(errors).length > 0;
  pay.classList.toggle('busy', busy);
  pay.textContent = busy ? 'Gerando seu Pix…' : transaction && transactionCustomer === JSON.stringify(data()) ? 'Ver código Pix' : 'Gerar código QR';
}
form.addEventListener('input', event => {
  const input = event.target;
  if (input.id === 'document') input.value = formatDocument(input.value);
  if (input.id === 'phone') input.value = formatPhone(input.value);
  refresh();
});
for (const name of ['email', 'name', 'phone', 'document']) $(`#${name}`).addEventListener('blur', () => { touched.add(name); refresh(); });
$('#terms').addEventListener('change', refresh);
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => document.getElementById(button.dataset.close).close()));
$('#terms-open').addEventListener('click', () => $('#terms-dialog').showModal());
document.querySelectorAll('dialog').forEach(modal => modal.addEventListener('click', event => {
  const rect = modal.getBoundingClientRect();
  if (event.target === modal && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) modal.close();
}));
dialog.addEventListener('close', () => { pollSession++; clearTimeout(pollTimer); pay.focus(); });
function status(message, state = '') { $('#payment-status').textContent = message; $('#payment-status').className = `payment-status ${state}`; }
async function poll() {
  if (!dialog.open || !transaction || terminal) return;
  // Only the gateway can determine expiry. Browser clocks and provider date formats
  // must never invalidate a code or cause a duplicate charge.
  const current = transaction;
  const session = pollSession;
  const isCurrent = () => dialog.open && transaction === current && session === pollSession;
  try {
    const response = await fetch('/api/status', { headers: { Authorization: `Bearer ${current.token}` }, cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('status');
    const result = await response.json();
    if (!isCurrent()) return;
    if (!['PENDING', 'PAID', 'CANCELLED', 'REFUNDED'].includes(result.status)) throw new Error('unknown status');
    pollFailures = 0;
    if (result.status === 'PAID') { status('Pagamento confirmado!', 'paid'); terminal = true; $('#copy-button').hidden = true; return; }
    if (['CANCELLED', 'REFUNDED'].includes(result.status)) {
      status(result.status === 'REFUNDED' ? 'Pagamento estornado.' : 'Pix cancelado ou expirado. Gere um novo código.', 'expired');
      terminal = true; $('#copy-button').disabled = true; transaction = null; refresh(); return;
    }
    status('Aguardando pagamento');
  } catch {
    if (!isCurrent()) return;
    pollFailures++; if (pollFailures >= 3) status('Consulta indisponível no momento. Confira o pagamento no seu banco.');
  }
  if (isCurrent() && !terminal) pollTimer = setTimeout(poll, Math.min(10000 * (pollFailures + 1), 60000));
}
function showPix() {
  pollSession++;
  $('#pix-code').value = transaction.code;
  $('#qr-image').src = transaction.qrImage || '';
  $('.qr-wrap').hidden = !transaction.qrImage;
  const date = Date.parse(transaction.expiresAt);
  $('#expiry').textContent = Number.isFinite(date) ? `Válido até ${new Date(date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}` : '';
  $('#copy-status').textContent = '';
  $('#copy-button span').textContent = 'Copiar código Pix';
  $('#copy-button').disabled = false;
  $('#copy-button').hidden = terminal;
  if (!terminal) status('Aguardando pagamento');
  dialog.showModal();
  $('#copy-button').focus();
  clearTimeout(pollTimer);
  if (!terminal) pollTimer = setTimeout(poll, 5000);
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (busy) return;
  ['email','name','phone','document'].forEach(field => touched.add(field));
  refresh();
  if (Object.keys(validate(data())).length) return;
  const customer = data();
  if (transaction && transactionCustomer === JSON.stringify(customer)) { showPix(); return; }
  busy = true; refresh(); $('#request-error').hidden = true;
  try {
    const response = await fetch('/api/pix', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(customer), signal: AbortSignal.timeout(55000) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Não foi possível gerar o Pix. Tente novamente.');
    if (!result.code || result.amount !== 34700) throw new Error('Não foi possível validar o Pix. Tente mais tarde.');
    transaction = result; transactionCustomer = JSON.stringify(customer); terminal = false; pollFailures = 0;
    showPix();
  } catch (error) {
    $('#request-error').textContent = error.name === 'TimeoutError' || error instanceof TypeError ? 'Não recebemos a confirmação da operadora. Verifique sua conexão e aguarde antes de tentar novamente.' : error.message;
    $('#request-error').hidden = false;
  } finally { busy = false; refresh(); }
});
$('#copy-button').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('#pix-code').value);
    $('#copy-button span').textContent = 'Código copiado!';
    $('#copy-status').textContent = 'Agora cole no aplicativo do seu banco.';
  } catch {
    $('#pix-code').focus(); $('#pix-code').select();
    $('#copy-status').textContent = 'Selecione e copie o código acima para usar no seu banco.';
  }
});
refresh();
