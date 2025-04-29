import { Module } from '@nestjs/common';
import { ZkProofLogController } from './ethereum.controller';
import { ZkProofLogService } from './ethereum.service';
@Module({
    controllers: [ZkProofLogController],
    providers: [ZkProofLogService],
    exports: [ZkProofLogService],
    imports: []
})
export class EthereumModule {}
