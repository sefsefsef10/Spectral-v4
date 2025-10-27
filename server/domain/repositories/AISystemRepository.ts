/**
 * AISystem Repository Interface
 * 
 * Defines how the application layer interacts with AI system persistence.
 * Infrastructure layer will implement this interface using Drizzle ORM.
 */

import { AISystem } from '../entities/AISystem';

export interface AISystemRepository {
  // Query operations
  findById(id: string): Promise<AISystem | null>;
  findByHealthSystemId(healthSystemId: string): Promise<AISystem[]>;
  countByHealthSystemId(healthSystemId: string): Promise<number>;
  
  // Command operations
  save(aiSystem: AISystem): Promise<AISystem>;
  update(aiSystem: AISystem): Promise<AISystem>;
  delete(id: string): Promise<void>;
}
