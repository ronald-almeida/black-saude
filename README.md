# Black Saúde 360 — checkout Pix

Checkout responsivo da oferta enviada, preço fixo de **R$ 347,00** no servidor. Fonte Inter, banner original, validação de CPF/CNPJ, e-mail, nome e telefone, botão verde com dados válidos e aceite dos termos, modal com QR Code e Pix copia e cola.

## Executar

Node.js 22 ou superior, sem dependências externas de execução.

```sh
npm test
npm run dev
npm run build
```

O servidor local abre em http://127.0.0.1:4173. Configure `BLACKCAT_API_KEY` no ambiente do processo se precisar usar o gateway localmente. Não inclua chaves no código, na pasta pública ou no Git.

## Vercel

Projeto `black-saude`, conectado a `ronald-almeida/black-saude`, branch `main`. Build: `npm run build`; saída: `dist`; framework: Other. A variável **BLACKCAT_API_KEY** deve ser Sensitive e estar no ambiente Production. Após alterar a variável, faça novo deployment.

## Pagamentos

`POST /api/pix` valida novamente os dados, fixa o valor em 34700 centavos e cria uma venda real na Black Cat. `GET /api/status` consulta apenas uma transação autorizada por token HMAC. `GET /api/health` testa a autenticação no endpoint de vendedor e retorna somente disponibilidade, sem informações do vendedor.

Documentação: https://docs.blackcatoficial.com/

Não há banco de dados, localStorage, cookies ou histórico próprio de Pix. O código fica na memória da página; fechar/recarregar a página elimina esse estado. A Black Cat mantém os registros da transação. A verificação automática termina após confirmação ou expiração e pausa quando o modal fecha. Não há entrega de conteúdo automatizada neste repositório.

Os testes automatizados usam respostas simuladas e nunca criam cobranças reais. Uma compra real exige os dados do comprador. Os termos genéricos do checkout estão no modal de `public/index.html`; substitua pelo link oficial da oferta quando disponível.
