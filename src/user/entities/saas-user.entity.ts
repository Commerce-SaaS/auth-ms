import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';

@Entity()
@Index(['email'], { unique: true }) 
export class SaasUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  email: string;
  
  @Column()
  passwordHash: string;

  @Column()
  name: string;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}