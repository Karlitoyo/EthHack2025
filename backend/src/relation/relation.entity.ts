import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Family } from '../family/family.entity';

@Entity()
export class Relation {
  @PrimaryGeneratedColumn()
  id: string;

  @Column({ nullable: true })
  citizenId: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column()
  age: string;

  @Column({ nullable: true })
  address?: string;

  @Column({ nullable: true })
  dateOfBirth?: string;

  @Column({ nullable: true })
  relationship?: string;

  @Column({ nullable: true })
  email?: string;

  @Column({ nullable: true })
  contactNumber?: string;
  
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @ManyToOne(() => Family, family => family.relation)
  family: Family;
}