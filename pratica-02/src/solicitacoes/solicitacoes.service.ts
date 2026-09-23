import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, DataSource } from 'typeorm';
import { CriarSolicitacaoDto } from './dto/criar-solicitacao.dto';
import { FiltrarSolicitacoesDto } from './dto/filtro-solicitacao.dto';
import { Solicitacao } from './solicitacao.entity';
import { Auditoria } from '../auditoria/auditoria.entity';
import { RejeitarSolicitacaoDto } from './dto/rejeitar-solicitacao.dto';
import { CentroCusto } from '../centros-custo.entity';

function subtrairValoresMonetarios(saldo: string, valor: string): string {
  const paraCentavos = (quantia: string) => {
    const [inteiros, centavos = ''] = quantia.split('.');
    return BigInt(inteiros) * 100n + BigInt(centavos.padEnd(2, '0').slice(0, 2));
  };

  const resultado = paraCentavos(saldo) - paraCentavos(valor);
  return `${resultado / 100n}.${(resultado % 100n).toString().padStart(2, '0')}`;
}

@Injectable()
export class SolicitacoesService {
  constructor(
    @InjectRepository(Solicitacao)
    private readonly repository: Repository<Solicitacao>,
    @InjectRepository(CentroCusto)
    private readonly centroCustoRepository: Repository<CentroCusto>,
    private readonly dataSource: DataSource,
  ) { }

  async listar(filtros: FiltrarSolicitacoesDto) {
    const where: FindOptionsWhere<Solicitacao> = {};
    if (filtros.status) {
      where.status = filtros.status;
    }

    if (filtros.centroCusto) {
      where.centroCusto = filtros.centroCusto;
    }

    if (filtros.prioridade) {
      where.prioridade = filtros.prioridade;
    }

    return this.repository.find({
      where,
      order: { id: 'ASC' },
    });
  }

  async buscarPorId(id: number) {
    const solicitacao = await this.repository.findOneBy({ id });
    if (!solicitacao) {
      throw new NotFoundException('Solicitação não encontrada');
    }
    return solicitacao;
  }

  async criar(dto: CriarSolicitacaoDto) {
    const centro = await this.centroCustoRepository.findOneBy({
      codigo: dto.centroCusto,
    });
    if (!centro) {
      throw new NotFoundException('Centro de custo não encontrado');
    }

    const solicitacao = this.repository.create({
      titulo: dto.titulo,
      centroCusto: centro.codigo,
      centroCustoId: centro.id,
      prioridade: dto.prioridade,
      valorEstimado: dto.valorEstimado.toFixed(2),
      status: 'pendente',
    });
    return this.repository.save(solicitacao);
  }

  async aprovar(
    id: number,
    versaoSolicitacaoEsperada: number,
    versaoCentroCustoEsperada: number,
    atorId: number,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const solicitacao = await manager.findOneBy(Solicitacao, { id });

      if (!solicitacao) {
        throw new NotFoundException('Solicitação não encontrada');
      }
      if (solicitacao.status !== 'pendente') {
        throw new ConflictException('Solicitação não está pendente');
      }

      const centro = await manager.findOneBy(CentroCusto, {
        id: solicitacao.centroCustoId,
      });
      if (!centro) {
        throw new NotFoundException('Centro de custo não encontrado');
      }

      const solicitacaoAtualizada = await manager
        .createQueryBuilder()
        .update(Solicitacao)
        .set({ status: 'aprovada', versao: () => 'versao + 1' })
        .where('id = :id', { id })
        .andWhere('versao = :versao', {
          versao: versaoSolicitacaoEsperada,
        })
        .andWhere('status = :status', { status: 'pendente' })
        .execute();

      if (solicitacaoAtualizada.affected !== 1) {
        throw new ConflictException(
          'A solicitação foi alterada; consulte novamente',
        );
      }

      const centroAtualizado = await manager
        .createQueryBuilder()
        .update(CentroCusto)
        .set({
          saldoDisponivel: () =>
            '"saldo_disponivel" - CAST(:valor AS numeric)',
          versao: () => 'versao + 1',
        })
        .where('id = :centroId', { centroId: centro.id })
        .andWhere('versao = :versaoCentro', {
          versaoCentro: versaoCentroCustoEsperada,
        })
        .andWhere('saldo_disponivel >= CAST(:valor AS numeric)', {
          valor: solicitacao.valorEstimado,
        })
        .execute();

      if (centroAtualizado.affected !== 1) {
        throw new ConflictException(
          'O centro de custo foi alterado ou não possui saldo suficiente',
        );
      }

      await manager.insert(Auditoria, {
        atorId,
        acao: 'SOLICITACAO_APROVADA',
        recursoTipo: 'solicitacao',
        recursoId: id,
        detalhes: {
          statusAnterior: 'pendente',
          statusAtual: 'aprovada',
          versaoSolicitacao: versaoSolicitacaoEsperada,
          versaoCentroCusto: versaoCentroCustoEsperada,
          centroCusto: centro.codigo,
          valorReservado: solicitacao.valorEstimado,
          saldoAnterior: centro.saldoDisponivel,
          saldoResultante: subtrairValoresMonetarios(
            centro.saldoDisponivel,
            solicitacao.valorEstimado,
          ),
          versaoCentroCustoResultante: versaoCentroCustoEsperada + 1,
        },
      });

      return manager.findOneByOrFail(Solicitacao, { id });
    });
  }

  async rejeitar(id: number, versaoEsperada: number, atorId: number, motivo: string) {
    return this.dataSource.transaction(async (manager) => {
      const solicitacao = await manager.findOneBy(Solicitacao, { id });

      if (!solicitacao) {
        throw new NotFoundException('Solicitação não encontrada');
      }
      if (solicitacao.status !== 'pendente') {
        throw new ConflictException('Solicitação não está pendente');
      }

      const resultado = await manager
        .createQueryBuilder()
        .update(Solicitacao)
        .set({ status: 'rejeitada', versao: () => 'versao + 1' })
        .where('id = :id', { id })
        .andWhere('versao = :versao', { versao: versaoEsperada })
        .andWhere('status = :status', { status: 'pendente' })
        .execute();

      if (resultado.affected !== 1) {
        throw new ConflictException(
          'A solicitação foi alterada; consulte novamente',
        );
      }
      await manager.insert(Auditoria, {
        atorId,
        acao: 'SOLICITACAO_REJEITADA',
        recursoTipo: 'solicitacao',
        recursoId: id,
        motivo: motivo,
        detalhes: {
          statusAnterior: 'pendente',
          statusAtual: 'rejeitada',
          versaoAnterior: versaoEsperada,
        },
      });

      return manager.findOneByOrFail(Solicitacao, { id });
    });
  }
}