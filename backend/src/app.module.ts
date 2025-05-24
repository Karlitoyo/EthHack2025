import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CountryModule } from './country/country.module';
import { CitizenModule } from './citizen/citizen.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Country } from './country/country.entity';
import { Citizen } from './citizen/citizen.entity';
import { ConfigModule } from '@nestjs/config';
import { CountryController } from './country/country.controller';
import { CitizenController } from './citizen/citizen.controller';
import { ZkSnarkModule } from './zk-snark/zk-snark.module';
import { ZkSnarkController } from './zk-snark/zk-snark.controller';
import { MerkleController } from './merkle/merkle.controller';
import { MerkleModule } from './merkle/merkle.module';
import { ZkProofLogController } from './ethereum/ethereum.controller';
import { ZkProofLogService } from './ethereum/ethereum.service';
import { Ethereum } from './ethereum/ethereum';
import { EthereumModule } from './ethereum/ethereum.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB,
      entities: [Country, Citizen],
      synchronize: true,
    }),
    CountryModule,
    CitizenModule,
    ZkSnarkModule,
    ConfigModule.forRoot(),
    MerkleModule,
    EthereumModule,
  ],
  controllers: [
    AppController,
    CountryController,
    CitizenController,
    ZkSnarkController,
    MerkleController,
    ZkProofLogController,
  ],
  providers: [AppService, ZkProofLogService, Ethereum],
})
export class AppModule {}
