// Fuso padrão dos testes: horário de Brasília. Testes de fuso alteram process.env.TZ localmente.
module.exports = async () => {
  process.env.TZ = 'America/Sao_Paulo';
};
