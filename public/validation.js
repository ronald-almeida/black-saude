export const digits = value => String(value ?? '').replace(/\D/g, '');
export function validDocument(value) {
  const n = digits(value);
  if (!/^(\d{11}|\d{14})$/.test(n) || /^(\d)\1+$/.test(n)) return false;
  const check = (base, weights) => {
    const sum = [...base].reduce((s, d, i) => s + Number(d) * weights[i], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  if (n.length === 11) {
    return check(n.slice(0, 9), [10,9,8,7,6,5,4,3,2]) === +n[9]
      && check(n.slice(0, 10), [11,10,9,8,7,6,5,4,3,2]) === +n[10];
  }
  return check(n.slice(0, 12), [5,4,3,2,9,8,7,6,5,4,3,2]) === +n[12]
    && check(n.slice(0, 13), [6,5,4,3,2,9,8,7,6,5,4,3,2]) === +n[13];
}
export function validate(data) {
  const errors = {};
  if (typeof data.email !== 'string' || data.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email.trim())) errors.email = 'Email inválido';
  if (typeof data.name !== 'string' || data.name.length > 150 || !/^[\p{L}][\p{L}'’-]{1,}(?:\s+[\p{L}][\p{L}'’-]*)+$/u.test(data.name.trim())) errors.name = 'Por favor, insira o nome e sobrenome.';
  if (!/^[1-9]{2}(?:[2-5]\d{7}|9\d{8})$/.test(digits(data.phone))) errors.phone = 'Digite um telefone válido';
  if (!validDocument(data.document)) errors.document = digits(data.document) ? 'Digite um CPF/CNPJ válido' : 'O CPF/CNPJ é obrigatório';
  if (data.terms !== true) errors.terms = 'Aceite os termos de uso para continuar.';
  return errors;
}
export function formatDocument(value) {
  const n = digits(value).slice(0,14);
  return n.length <= 11
    ? n.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
    : n.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}
export function formatPhone(value) {
  const n = digits(value).slice(0,11);
  if (n.length <= 2) return n;
  const rest = n.slice(2);
  return `(${n.slice(0,2)}) ${rest.length > 8 ? rest.replace(/(\d{5})(\d+)/, '$1-$2') : rest.replace(/(\d{4})(\d+)/, '$1-$2')}`;
}
