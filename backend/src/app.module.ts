import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HospitalsModule } from './hospitals/hospitals.module';
import { PatientsModule } from './patients/patients.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Hospital } from './hospitals/hospital.entity';
import { Patient } from './patients/patient.entity';
import { ConfigModule } from '@nestjs/config';
import { HospitalsController } from './hospitals/hospitals.controller';
import { PatientsController } from './patients/patients.controller';
import { ZkSnarkModule } from './zk-snark/zk-snark.module';
import { ZkSnarkController } from './zk-snark/zk-snark.controller';
import { MerkleController } from './merkle/merkle.controller';
import { MerkleModule } from './merkle/merkle.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB,
      entities: [Hospital, Patient],
      synchronize: true,
    }),
    HospitalsModule,
    PatientsModule,
    ZkSnarkModule,
    ConfigModule.forRoot(),
    MerkleModule,
  ],
  controllers: [
    AppController,
    HospitalsController,
    PatientsController,
    ZkSnarkController,
    MerkleController,
  ],
  providers: [AppService],
})
export class AppModule {}
