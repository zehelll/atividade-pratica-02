import 'dotenv/config';
import dataSource from '../data-source';
import { Solicitacao } from '../../solicitacoes/solicitacao.entity';
import { CentroCusto } from '../../centros-custo.entity';

const dados = [
  {
    titulo: 'Aquisição de monitor dentro do orçamento',
    prioridade: 'normal' as const,
    valorEstimado: '400.00',
  },
  {
    titulo: 'Substituição de servidor acima do orçamento',
    prioridade: 'urgente' as const,
    valorEstimado: '1500.00',
  },
];

async function executar() {
  await dataSource.initialize();
  const centroRepository = dataSource.getRepository(CentroCusto);
  const solicitacaoRepository = dataSource.getRepository(Solicitacao);
  const matricula = process.env.STUDENT_ID ?? '20261234';
  const codigo = `CC-${matricula.slice(-4)}`;

  let centro = await centroRepository.findOneBy({ codigo });
  if (!centro) {
    centro = await centroRepository.save(
      centroRepository.create({
        codigo,
        saldoDisponivel: '1000.00',
      }),
    );
  }

  for (const item of dados) {
    const existente = await solicitacaoRepository.findOneBy({
      titulo: item.titulo,
      centroCustoId: centro.id,
    });

    if (!existente) {
      await solicitacaoRepository.save(
        solicitacaoRepository.create({
          titulo: item.titulo,
          centroCusto: centro.codigo,
          centroCustoId: centro.id,
          valorEstimado: item.valorEstimado,
          prioridade: item.prioridade,
          status: 'pendente',
        }),
      );
    }
  }

  await dataSource.destroy();
}

executar().catch(async (erro) => {
  console.error(erro);

  if (dataSource.isInitialized) {
    await dataSource.destroy();
  }

  process.exitCode = 1;
});