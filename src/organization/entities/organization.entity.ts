import { User } from 'src/user/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  address?: string;

  @Column()
  ownerId: string;

//   @ManyToOne(() => User, (user) => user.organizations)
//   @JoinColumn({ name: 'ownerId' })
//   owner: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt?: Date;

  @Column({ nullable: true })
  logoUrl?: string;

  @Column()
  contactEmail: string;

  @Column({ nullable: true })
  contactPhone?: string;
}
