# Como Testar Autenticação x-api-key

## Teste 1 (esperado 401):

curl -i https://sr-backend-api.onrender.com/api/test -H "Content-Type: application/json" -d '{"ping":1}'

## Teste 2 (esperado 200):

curl -i https://sr-backend-api.onrender.com/api/test -H "Content-Type: application/json" -H "x-api-key: <SUA_CHAVE>" -d '{"ping":1}'

## Teste 3 (esperado 200 e cria ticket):

curl -i https://sr-backend-api.onrender.com/api/tickets -H "Content-Type: application/json" -H "x-api-key: <SUA_CHAVE>" -d '{"tipoServico":"teste-integracao","origem":"curl","nome":"Teste API","cpf":"00000000000","email":"teste@teste.com","celularWhatsApp":"11999999999"}'

## Teste 4 (esperado 200 e lista tickets):

curl -i https://sr-backend-api.onrender.com/api/tickets -H "x-api-key: <SUA_CHAVE>"
