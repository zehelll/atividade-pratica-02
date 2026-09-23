import { MigrationInterface, QueryRunner } from 'typeorm';

export class OrcamentoCentrosCusto1789700000000 implements MigrationInterface {
  name = 'OrcamentoCentrosCusto1789700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "centros_custo" (
        "id" SERIAL NOT NULL,
        "codigo" character varying(30) NOT NULL,
        "saldo_disponivel" numeric(14,2) NOT NULL,
        "versao" integer NOT NULL DEFAULT 1,
        "criado_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "atualizado_em" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_centros_custo_codigo" UNIQUE ("codigo"),
        CONSTRAINT "CK_centros_custo_saldo_nao_negativo" CHECK ("saldo_disponivel" >= 0),
        CONSTRAINT "CK_centros_custo_versao_positiva" CHECK ("versao" > 0),
        CONSTRAINT "PK_centros_custo" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "solicitacoes"
      ADD "valor_estimado" numeric(14,2) NOT NULL DEFAULT 0,
      ADD "centro_custo_id" integer
    `);

    await queryRunner.query(`
      INSERT INTO "centros_custo" ("codigo", "saldo_disponivel")
      SELECT DISTINCT "centroCusto", 0
      FROM "solicitacoes"
      WHERE "centroCusto" IS NOT NULL
    `);

    await queryRunner.query(`
      UPDATE "solicitacoes" s
      SET "centro_custo_id" = c."id"
      FROM "centros_custo" c
      WHERE c."codigo" = s."centroCusto"
    `);

    await queryRunner.query(`
      ALTER TABLE "solicitacoes"
      ALTER COLUMN "centro_custo_id" SET NOT NULL,
      ADD CONSTRAINT "FK_solicitacoes_centro_custo"
        FOREIGN KEY ("centro_custo_id") REFERENCES "centros_custo"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
      ADD CONSTRAINT "CK_solicitacoes_valor_estimado_nao_negativo"
        CHECK ("valor_estimado" >= 0)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "solicitacoes" DROP CONSTRAINT "CK_solicitacoes_valor_estimado_nao_negativo"`);
    await queryRunner.query(`ALTER TABLE "solicitacoes" DROP CONSTRAINT "FK_solicitacoes_centro_custo"`);
    await queryRunner.query(`ALTER TABLE "solicitacoes" DROP COLUMN "centro_custo_id"`);
    await queryRunner.query(`ALTER TABLE "solicitacoes" DROP COLUMN "valor_estimado"`);
    await queryRunner.query(`DROP TABLE "centros_custo"`);
  }
}
