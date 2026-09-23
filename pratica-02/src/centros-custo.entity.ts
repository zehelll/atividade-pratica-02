import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

@Entity({ name: 'centros_custo' })
export class CentroCusto {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 30, unique: true })
  codigo!: string;

  @Column({ name: 'saldo_disponivel', type: 'numeric', precision: 14, scale: 2 })
  saldoDisponivel!: string;

  @VersionColumn({ name: 'versao', type: 'int' })
  versao!: number;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm!: Date;

  @UpdateDateColumn({ name: 'atualizado_em', type: 'timestamptz' })
  atualizadoEm!: Date;
}
