import { Controller, Get, NotFoundException, Param, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { CentroCusto } from './centros-custo.entity';

@Controller('centros-custo')
@UseGuards(JwtAuthGuard)
export class CentrosCustoController {
  constructor(
    @InjectRepository(CentroCusto)
    private readonly repository: Repository<CentroCusto>,
  ) {}

  @Get(':codigo')
  async buscarPorCodigo(@Param('codigo') codigo: string) {
    const centro = await this.repository.findOneBy({ codigo });
    if (!centro) {
      throw new NotFoundException('Centro de custo não encontrado');
    }

    return {
      codigo: centro.codigo,
      saldoDisponivel: centro.saldoDisponivel,
      versao: centro.versao,
    };
  }
}
